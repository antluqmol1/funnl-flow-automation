import express, { Request, Response, NextFunction } from 'express';
import { MCPClient } from '../../mcpClient';
import { spawn } from 'child_process';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { WhisperService } from '../services/whisperService';
import cors from 'cors';
import { supabase } from '../lib/supabase';
import { initMCP, promiseWithTimeout } from '../lib/utils';

const router = express.Router();

// Configurar CORS específico para esta ruta
router.use(cors({
    origin: ['http://localhost:8080', 'http://localhost:3001', '*'],
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Ruta de prueba para verificar que la API está funcionando
router.get('/test', (req: Request, res: Response) => {
    res.json({ message: "La API del asistente está funcionando correctamente" });
});

// Configurar almacenamiento temporal para archivos de audio
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Determinar la extensión óptima para la API de Whisper
        let extension = 'mp3'; // Formato preferido para Whisper

        // Mantener el formato original si ya es uno óptimo
        if (file.mimetype === 'audio/webm') {
            extension = 'webm';
        } else if (file.mimetype === 'audio/wav') {
            extension = 'wav';
        } else if (file.mimetype === 'audio/mp4' || file.mimetype === 'audio/m4a') {
            extension = 'm4a';
        }

        const filename = `${uuidv4()}-${Date.now()}.${extension}`;
        console.log(`Nuevo archivo: ${filename} (tipo: ${file.mimetype})`);
        cb(null, filename);
    }
});

// Filtro para aceptar solo archivos de audio
const fileFilter = (req: any, file: any, cb: any) => {
    // Verificar que sea un archivo de audio
    if (file.mimetype.startsWith('audio/')) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten archivos de audio'), false);
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB máximo según límites de OpenAI
    fileFilter
});

/**
 * Procesa consultas de texto con el asistente AI
 */
router.post('/query', (req: Request, res: Response, next: NextFunction) => {
    (async () => {
        try {
            const { query } = req.body;

            if (!query) {
                return res.status(400).json({ error: 'La consulta es obligatoria' });
            }

            console.log(`Procesando consulta: "${query}"`);

            // Asegurarse de que el cliente MCP está inicializado
            const client = await initMCP();

            // Procesar la consulta
            const response = await client.processQuery(query);
            console.log(`Respuesta obtenida: "${response}"`);

            return res.json({ response });
        } catch (error) {
            console.error('Error procesando consulta:', error);
            return res.status(500).json({
                error: 'Error al procesar la consulta',
                details: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    })().catch(next);
});

/**
 * Procesa archivos de audio, los transcribe con Whisper y envía al asistente
 */
router.post('/audio', upload.single('audio'), (req: Request, res: Response, next: NextFunction) => {
    console.log('------------- INICIO DE SOLICITUD DE AUDIO -------------');
    console.log('Recibida solicitud en /audio');
    console.log('Method:', req.method);
    console.log('URL:', req.originalUrl);
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Content-Length:', req.headers['content-length']);

    // Establecer headers de CORS temprano
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Configurar un timeout para toda la solicitud (90 segundos)
    const TIMEOUT_MS = 90000;
    let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
        console.error('Timeout alcanzado para la solicitud de audio');
        if (!res.headersSent) {
            res.status(504).json({
                error: 'Timeout al procesar el audio',
                success: false,
                details: 'La solicitud tardó demasiado tiempo en completarse'
            });
        }
    }, TIMEOUT_MS);

    // Función para limpiar el timeout cuando la respuesta se envía
    const clearRequestTimeout = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    };

    // Asegurarse de que se limpia el timeout cuando se envía la respuesta
    res.on('finish', clearRequestTimeout);
    res.on('close', clearRequestTimeout);

    // Verificar si tenemos un archivo
    if (!req.file) {
        console.error('No se recibió ningún archivo.');
        console.log('Body de la solicitud:', req.body);
        console.log('Headers de la solicitud:', req.headers);
        clearRequestTimeout();
        return res.status(400).json({
            error: 'No se recibió archivo de audio',
            success: false,
            transcription: "" // Campo vacío para evitar errores en el cliente
        });
    }

    console.log('Archivo recibido:');
    console.log('- Nombre:', req.file.originalname);
    console.log('- Tamaño:', req.file.size, 'bytes');
    console.log('- Tipo MIME:', req.file.mimetype);
    console.log('- Ruta temporal:', req.file.path);

    // Si el archivo está vacío, rechazar
    if (req.file.size === 0) {
        console.error('El archivo recibido está vacío (0 bytes)');
        if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        clearRequestTimeout();
        return res.status(400).json({
            error: 'El archivo de audio está vacío',
            success: false,
            transcription: ""
        });
    }

    // Verificar que el archivo existe en el sistema de archivos
    if (!fs.existsSync(req.file.path)) {
        console.error(`El archivo no existe en la ruta: ${req.file.path}`);
        clearRequestTimeout();
        return res.status(500).json({
            error: 'Error interno al procesar el archivo',
            success: false,
            transcription: ""
        });
    }

    (async () => {
        // Asegurarnos de tener la ruta del archivo
        if (!req.file || !req.file.path) {
            clearRequestTimeout();
            return res.status(400).json({
                error: 'No se recibió archivo de audio válido',
                success: false,
                transcription: ""
            });
        }

        // Ahora sabemos que filePath es un string y nunca será undefined
        const filePath: string = req.file.path;

        try {
            // Verificar que el archivo existe y no está vacío
            if (!fs.existsSync(filePath)) {
                throw new Error(`El archivo no existe en la ruta: ${filePath}`);
            }

            const stats = fs.statSync(filePath);
            if (stats.size === 0) {
                throw new Error('El archivo está vacío (0 bytes)');
            }

            console.log(`Procesando archivo de audio: ${filePath}`);
            console.log(`Tamaño del archivo: ${stats.size} bytes`);

            // Enviar una respuesta temprana de "procesando" para mantener viva la conexión
            // y evitar problemas de timeout en el cliente
            if (!res.headersSent) {
                res.writeHead(202, {
                    'Content-Type': 'application/json',
                    'Transfer-Encoding': 'chunked'
                });
                res.write(JSON.stringify({
                    status: 'processing',
                    message: 'Procesando el audio, esto puede tomar hasta 60 segundos'
                }));
            }

            // Transcribir el audio con un timeout específico
            let transcriptionResult;
            try {
                // Usamos un timeout más corto para la transcripción específicamente
                transcriptionResult = await promiseWithTimeout(
                    WhisperService.fallbackToMock(filePath),
                    60000, // 60 segundos máximo para la transcripción
                    'La transcripción tomó demasiado tiempo'
                );

                // Informar si se usó el mock
                if (transcriptionResult.usedMock) {
                    console.log('AVISO: Se utilizó la transcripción simulada debido a problemas con la API.');
                }
            } catch (transcriptionError: any) {
                console.error('Error en la transcripción:', transcriptionError);

                // Limpiar recurso
                if (filePath && fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }

                console.log('------------- FIN DE SOLICITUD DE AUDIO (ERROR TRANSCRIPCIÓN) -------------');
                clearRequestTimeout();

                // Si ya enviamos los headers, enviamos el error como parte del cuerpo
                if (res.headersSent) {
                    res.write(JSON.stringify({
                        error: 'Error en la transcripción',
                        details: transcriptionError instanceof Error ? transcriptionError.message : 'Error desconocido',
                        success: false,
                        transcription: "Error al transcribir audio"
                    }));
                    res.end();
                    return;
                }

                return res.status(500).json({
                    error: 'Error en la transcripción',
                    details: transcriptionError instanceof Error ? transcriptionError.message : 'Error desconocido',
                    success: false,
                    transcription: "Error al transcribir audio"
                });
            }

            if (transcriptionResult.error) {
                console.error('Error en la transcripción:', transcriptionResult.error);

                // Limpiar recurso
                if (filePath && fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }

                console.log('------------- FIN DE SOLICITUD DE AUDIO (ERROR RESULTADO) -------------');
                clearRequestTimeout();

                // Si ya enviamos los headers, enviamos el error como parte del cuerpo
                if (res.headersSent) {
                    res.write(JSON.stringify({
                        error: 'Error en la transcripción',
                        details: transcriptionResult.error,
                        success: false,
                        transcription: "Error en resultado de transcripción"
                    }));
                    res.end();
                    return;
                }

                return res.status(500).json({
                    error: 'Error en la transcripción',
                    details: transcriptionResult.error,
                    success: false,
                    transcription: "Error en resultado de transcripción"
                });
            }

            const transcription = transcriptionResult.text;
            if (!transcription || transcription.trim() === '') {
                console.error('Transcripción vacía');

                // Limpiar recurso
                if (filePath && fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }

                console.log('------------- FIN DE SOLICITUD DE AUDIO (TRANSCRIPCIÓN VACÍA) -------------');
                clearRequestTimeout();

                // Si ya enviamos los headers, enviamos el error como parte del cuerpo
                if (res.headersSent) {
                    res.write(JSON.stringify({
                        error: 'La transcripción está vacía',
                        details: 'No se pudo extraer texto del audio',
                        success: false,
                        transcription: ""
                    }));
                    res.end();
                    return;
                }

                return res.status(400).json({
                    error: 'La transcripción está vacía',
                    details: 'No se pudo extraer texto del audio',
                    success: false,
                    transcription: ""
                });
            }

            console.log('Transcripción obtenida:', transcription);

            try {
                // Procesar la transcripción con el asistente
                const client = await initMCP();
                console.log('Enviando transcripción al MCP client...');

                if (!client) {
                    throw new Error('El cliente MCP no está inicializado');
                }

                // Obtener respuesta con timeout
                const response = await promiseWithTimeout(
                    client.processQuery(transcription),
                    30000, // 30 segundos máximo para procesar la consulta
                    'El procesamiento de la consulta tomó demasiado tiempo'
                );

                console.log('Respuesta del MCP client:', response);

                // Construir el resultado final
                const result = {
                    response,
                    transcription,
                    success: true
                };

                console.log('Enviando respuesta al cliente:', result);

                // Limpiar recurso antes de enviar la respuesta
                if (filePath && fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log('Archivo de audio eliminado:', filePath);
                }

                console.log('------------- FIN DE SOLICITUD DE AUDIO (ÉXITO) -------------');
                clearRequestTimeout();

                // Si ya enviamos los headers, enviamos la respuesta final como parte del cuerpo
                if (res.headersSent) {
                    res.write(JSON.stringify(result));
                    res.end();
                    return;
                }

                return res.status(200).json(result);

            } catch (mcpError: any) {
                console.error('Error al procesar la transcripción con MCP:', mcpError);

                // Limpiar recurso
                if (filePath && fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }

                // Si hay un error con MCP pero tenemos la transcripción, la devolvemos
                console.log('------------- FIN DE SOLICITUD DE AUDIO (ERROR MCP) -------------');
                clearRequestTimeout();

                // Si ya enviamos los headers, enviamos el error como parte del cuerpo
                if (res.headersSent) {
                    res.write(JSON.stringify({
                        error: 'Error al procesar la transcripción',
                        details: mcpError instanceof Error ? mcpError.message : 'Error desconocido',
                        transcription, // Devolvemos la transcripción aunque haya error
                        success: false
                    }));
                    res.end();
                    return;
                }

                return res.status(500).json({
                    error: 'Error al procesar la transcripción',
                    details: mcpError instanceof Error ? mcpError.message : 'Error desconocido',
                    transcription, // Devolvemos la transcripción aunque haya error
                    success: false
                });
            }
        } catch (error: any) {
            console.error('Error procesando audio:', error);

            // Limpiar recurso
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            console.log('------------- FIN DE SOLICITUD DE AUDIO (ERROR GENERAL) -------------');
            clearRequestTimeout();

            // Si ya enviamos los headers, enviamos el error como parte del cuerpo
            if (res.headersSent) {
                res.write(JSON.stringify({
                    error: 'Error al procesar el audio',
                    details: error instanceof Error ? error.message : 'Error desconocido',
                    success: false,
                    transcription: "Error general en procesamiento"
                }));
                res.end();
                return;
            }

            return res.status(500).json({
                error: 'Error al procesar el audio',
                details: error instanceof Error ? error.message : 'Error desconocido',
                success: false,
                transcription: "Error general en procesamiento"
            });
        }
    })().catch((error: any) => {
        console.error('Error no manejado en la ruta /audio:', error);
        console.log('------------- FIN DE SOLICITUD DE AUDIO (ERROR NO MANEJADO) -------------');
        clearRequestTimeout();

        // Si ya enviamos los headers, enviamos el error como parte del cuerpo
        if (res.headersSent) {
            res.write(JSON.stringify({
                error: 'Error interno del servidor',
                details: error instanceof Error ? error.message : 'Error desconocido',
                success: false,
                transcription: "Error no manejado"
            }));
            res.end();
            return;
        }

        return res.status(500).json({
            error: 'Error interno del servidor',
            details: error instanceof Error ? error.message : 'Error desconocido',
            success: false,
            transcription: "Error no manejado"
        });
    });
});

// Añadir un nuevo endpoint para verificar si el servidor está activo
router.get('/status', (req, res) => {
    console.log('Recibida solicitud de verificación de estado');
    res.json({ status: 'ok', message: 'Servidor en línea' });
});

export default router; 