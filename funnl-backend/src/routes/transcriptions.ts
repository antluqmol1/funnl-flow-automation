import express, { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase'; // Importar cliente Supabase global (para auth.getUser)
import { createClient } from '@supabase/supabase-js'; // <-- Añadir import para crear cliente específico
import { WhisperService } from '../services/whisperService'; // Importar WhisperService
import { MCPClient } from '../../mcpClient'; // Importar MCPClient
import { initMCP, promiseWithTimeout } from '../lib/utils'; // <- CORREGIR RUTA
import fs from 'fs';
import path from 'path';
import multer from 'multer'; // Necesario para el tipo 'file' aunque no lo usemos directamente aquí
import fetch from 'node-fetch'; // <-- Importar node-fetch
import os from 'os';
import { Readable } from 'stream'; // Importar Readable
// import { generateSummaryAndKeyPoints as generateAiAnalysis } from '../services/aiService'; // Comentado - Módulo no encontrado

const router = express.Router();

// // Configurar almacenamiento temporal para archivos de audio (COPIADO DE ASSISTANT.TS - Quizás no necesario aquí si no usamos upload)
// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         const uploadDir = path.join(__dirname, '../../uploads');
//         if (!fs.existsSync(uploadDir)) {
//             fs.mkdirSync(uploadDir, { recursive: true });
//         }
//         cb(null, uploadDir);
//     },
//     filename: (req, file, cb) => {
//         // ... (lógica de nombre de archivo)
//         const extension = path.extname(file.originalname) || '.tmp';
//         const filename = `${uuidv4()}-${Date.now()}${extension}`;
//         cb(null, filename);
//     }
// });
// const upload = multer({ storage });

// Helper para descargar desde URL y guardar temporalmente usando Buffer
async function downloadAudioFromUrl(url: string): Promise<string> {
    try {
        console.log(`[DownloadHelper] Intentando descargar desde: ${url.substring(0, 100)}...`);
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[DownloadHelper] Error HTTP ${response.status} al descargar: ${errorText}`);
            throw new Error(`Error HTTP ${response.status} al descargar audio desde URL firmada`);
        }

        const audioBuffer = await response.buffer();
        console.log(`[DownloadHelper] Audio descargado como buffer, tamaño: ${audioBuffer.length} bytes`);

        // --- INICIO: Extraer extensión original de la URL ---
        let originalExtension = '.tmp'; // Default
        try {
            const parsedUrl = new URL(url);
            // Decodificar el pathname para manejar espacios o caracteres especiales en nombres de archivo
            const decodedPathname = decodeURIComponent(parsedUrl.pathname);
            originalExtension = path.extname(decodedPathname);
            // Validar si la extensión es una de las esperadas por Whisper para evitar errores
            const validExtensions = ['.flac', '.m4a', '.mp3', '.mp4', '.mpeg', '.mpga', '.oga', '.ogg', '.wav', '.webm'];
            if (!validExtensions.includes(originalExtension.toLowerCase())) {
                console.warn(`[DownloadHelper] Extensión extraída (${originalExtension}) no parece válida para Whisper. Usando .webm como fallback.`);
                originalExtension = '.webm'; // Fallback a un formato común si la extensión no es válida
            }
            console.log(`[DownloadHelper] Extensión original extraída: ${originalExtension}`);
        } catch (e) {
            console.error("[DownloadHelper] Error al parsear URL o extraer extensión, usando .tmp:", e);
            originalExtension = '.tmp'; // Mantener .tmp si hay error
        }
        // --- FIN: Extraer extensión original --- 

        // Crear un nombre de archivo temporal CON la extensión original
        const tempDir = os.tmpdir();
        // Usar la extensión extraída
        const tempFilePath = path.join(tempDir, `recording-${Date.now()}${originalExtension}`);
        console.log(`[DownloadHelper] Guardando en archivo temporal: ${tempFilePath}`);

        fs.writeFileSync(tempFilePath, audioBuffer);
        console.log(`[DownloadHelper] Archivo guardado con éxito: ${tempFilePath}`);

        return tempFilePath;
    } catch (error) {
        console.error('[DownloadHelper] Error en downloadAudioFromUrl:', error);
        throw error;
    }
}

/**
 * Ruta para INICIAR el procesamiento de una transcripción para una grabación específica por ID
 * Método: POST
 * Ruta: /:recordingId/process 
 * Body: { "signedUrl": "..." }
 */
router.post('/:recordingId/process', (req: Request, res: Response, next: NextFunction) => {
    (async () => {
        let user: { id: string } | null = null;
        let tempFilePath: string | null = null;
        const { recordingId } = req.params;
        const { signedUrl } = req.body;
        const authHeader = req.headers.authorization;
        let token: string | undefined = undefined; // Definir token aquí

        console.log(`[Routes][Transcriptions] Solicitud POST /process recibida para recordingId: ${recordingId}`);

        // --- 1. Validaciones --- 
        if (!signedUrl) {
            return res.status(400).json({ error: 'Falta signedUrl en el body' });
        }
        if (!recordingId) {
            return res.status(400).json({ error: 'Falta recordingId en los parámetros' });
        }
        if (!authHeader) {
            return res.status(401).json({ error: 'Falta cabecera de autorización' });
        }
        token = authHeader.split(' ')[1]; // Asignar token aquí
        if (!token) {
            return res.status(401).json({ error: 'Token de autorización mal formado' });
        }

        try {
            // --- 2. Validar Usuario (usando cliente global) --- 
            console.log(`[Routes][Transcriptions] Validando token para ${recordingId}...`);
            const { data: userData, error: userError } = await supabase.auth.getUser(token);
            if (userError || !userData?.user) {
                console.error(`[Routes][Transcriptions] Error de autenticación para ${recordingId}:`, userError);
                return res.status(401).json({ error: 'Token inválido o usuario no encontrado', details: userError?.message });
            }
            user = userData.user;
            console.log(`[Routes][Transcriptions] Token validado para usuario: ${user.id}.`);
            console.log(`[Routes][Transcriptions] BACKEND User ID validado: >>> ${user.id} <<<`);

            // Crear un cliente específico para este usuario/solicitud
            const supabaseUserClient = createClient(
                process.env.VITE_SUPABASE_URL!,
                process.env.VITE_SUPABASE_ANON_KEY!, // Usar ENV vars del backend
                { global: { headers: { Authorization: `Bearer ${token}` } } } // Pasa el token
            );

            // --- 3. Actualizar Estado Inicial en DB (usando cliente de usuario) --- 
            console.log(`[Routes][Transcriptions] Actualizando estado a 'processing' para ${recordingId}...`);
            const { data: initialUpdateData, error: updateStatusError } = await supabaseUserClient // <-- USA CLIENTE DE USUARIO
                .from('meeting_recordings')
                .update({ status: 'processing', updated_at: new Date().toISOString() })
                .eq('id', recordingId)
                .eq('user_id', user.id) // <-- Reactivado
                .select();

            if (updateStatusError) {
                console.error(`[Routes][Transcriptions] Error explícito al actualizar estado inicial para ${recordingId}:`, updateStatusError);
                return res.status(500).json({ error: 'No se pudo iniciar el proceso (error al actualizar estado inicial)', details: updateStatusError.message });
            } else if (!initialUpdateData || initialUpdateData.length === 0) {
                console.error(`[Routes][Transcriptions] La actualización de estado inicial para ${recordingId} no afectó ninguna fila. Verifique recordingId y user_id.`);
                return res.status(404).json({ error: 'No se encontró la grabación o no pertenece al usuario para iniciar el proceso.' });
            }
            console.log(`[Routes][Transcriptions] Estado inicial actualizado a 'processing' con éxito para ${recordingId}.`);

            // Devolver respuesta temprana (Accepted)
            res.status(202).json({ message: "Proceso de transcripción iniciado", recordingId });
            console.log(`[Routes][Transcriptions] Respuesta 202 enviada para ${recordingId}. Iniciando descarga y transcripción en segundo plano.`);

            // --- 4. Descargar Audio desde URL Firmada --- 
            console.log(`[Routes][Transcriptions] Descargando audio desde URL firmada para ${recordingId}...`);
            tempFilePath = await downloadAudioFromUrl(signedUrl);
            console.log(`[Routes][Transcriptions] Audio descargado y guardado temporalmente en: ${tempFilePath} para ${recordingId}`);

            // --- 5. Transcribir --- 
            console.log(`[Routes][Transcriptions] Enviando audio a WhisperService para ${recordingId}...`);
            const transcriptionResult = await WhisperService.transcribeAudio(tempFilePath);
            if (transcriptionResult.error || !transcriptionResult.text) {
                console.error(`[Routes][Transcriptions] WhisperService devolvió un error o transcripción vacía para ${recordingId}: ${transcriptionResult.error}`);
                throw new Error(transcriptionResult.error || 'La transcripción resultó vacía');
            }
            const transcription = transcriptionResult.text;
            console.log(`[Routes][Transcriptions] Transcripción obtenida para ${recordingId} (longitud: ${transcription.length})`);

            // --- 6. Generar Resumen y Puntos Clave (Usando MCP) ---
            let summary: string | null = null;
            let keyPoints: string[] = []; // Inicializar como array vacío
            console.log(`[Routes][Transcriptions] Solicitando análisis AI vía MCP para ${recordingId}...`);
            try {
                // Obtener instancia del cliente MCP
                const mcpClient = await initMCP();

                // Llamar a la herramienta directamente
                const aiAnalysisResult = await mcpClient.callMCPToolDirectly(
                    'analyze_meeting_transcription',
                    { transcription_text: transcription } // Pasar argumento
                );

                // Verificar si hubo error devuelto por la herramienta
                if (aiAnalysisResult && aiAnalysisResult.error) {
                    console.error(`[Routes][Transcriptions] Error devuelto por herramienta MCP analyze_meeting_transcription para ${recordingId}:`, aiAnalysisResult.error);
                    // Decidir si continuar sin análisis o marcar como error parcial?
                    // Por ahora, continuamos sin análisis
                } else if (aiAnalysisResult && aiAnalysisResult.summary && Array.isArray(aiAnalysisResult.key_points)) {
                    summary = aiAnalysisResult.summary;
                    keyPoints = aiAnalysisResult.key_points;
                    console.log(`[Routes][Transcriptions] Análisis AI vía MCP obtenido con éxito para ${recordingId}`);
                } else {
                    console.warn(`[Routes][Transcriptions] Respuesta inesperada o incompleta de herramienta MCP analyze_meeting_transcription para ${recordingId}:`, aiAnalysisResult);
                }
            } catch (aiError) {
                console.error(`[Routes][Transcriptions] Error al llamar a la herramienta MCP analyze_meeting_transcription para ${recordingId}:`, aiError);
                // Continuar sin análisis en caso de error de comunicación con MCP
            }

            // --- 7. Actualizar Registro Final en DB (usando cliente de usuario) --- 
            console.log(`[Routes][Transcriptions] Actualizando registro final en DB para ${recordingId}...`);
            const finalUpdatePayload = {
                status: 'completed' as const,
                transcription,
                summary: summary, // <-- Usar variable (puede ser null)
                key_points: keyPoints, // <-- Usar variable (puede ser array vacío)
                updated_at: new Date().toISOString(),
            };
            const { data: updateData, error: finalUpdateError } = await supabaseUserClient // <-- USA CLIENTE DE USUARIO
                .from('meeting_recordings')
                .update(finalUpdatePayload)
                .eq('id', recordingId)
                .eq('user_id', user.id) // <-- Reactivado y necesario
                .select();

            if (finalUpdateError) {
                console.error(`[Routes][Transcriptions] Error explícito al actualizar registro final para ${recordingId}:`, finalUpdateError);
            } else if (!updateData || updateData.length === 0) {
                console.warn(`[Routes][Transcriptions] La actualización final para ${recordingId} no afectó ninguna fila (inesperado si la actualización inicial funcionó).`);
                // ... (lógica opcional para marcar como failed si esto ocurre) ...
            } else {
                console.log(`[Routes][Transcriptions] Registro final actualizado con éxito para ${recordingId}. Datos actualizados:`, updateData);
            }

        } catch (error) {
            console.error(`[Routes][Transcriptions] Error en el proceso para ${recordingId}:`, error);
            // --- Actualizar a 'failed' (usando cliente de usuario si user existe) --- 
            if (user && recordingId && token) { // Añadir check de token por si acaso
                const supabaseUserClientForFail = createClient(
                    process.env.VITE_SUPABASE_URL!,
                    process.env.VITE_SUPABASE_ANON_KEY!,
                    { global: { headers: { Authorization: `Bearer ${token}` } } }
                );
                try {
                    console.log(`[Routes][Transcriptions] Intentando actualizar estado a 'failed' para ${recordingId} debido a error...`);
                    await supabaseUserClientForFail // <-- USA CLIENTE DE USUARIO
                        .from('meeting_recordings')
                        .update({ status: 'failed', updated_at: new Date().toISOString() })
                        .eq('id', recordingId)
                        .eq('user_id', user!.id);
                    console.log(`[Routes][Transcriptions] Estado actualizado a 'failed' para ${recordingId}.`);
                } catch (updateError) {
                    console.error(`[Routes][Transcriptions] No se pudo actualizar estado a 'failed' para ${recordingId}:`, updateError);
                }
            } else {
                console.error(`[Routes][Transcriptions] No se puede actualizar a 'failed', falta user (${!!user}), recordingId (${!!recordingId}) o token (${!!token}).`);
            }
        } finally {
            // --- 8. Limpieza --- 
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                try {
                    fs.unlinkSync(tempFilePath);
                    console.log(`[Routes][Transcriptions] Archivo temporal eliminado: ${tempFilePath} para ${recordingId}`);
                } catch (cleanupError) {
                    console.error(`[Routes][Transcriptions] Error al eliminar archivo temporal ${tempFilePath} para ${recordingId}:`, cleanupError);
                }
            }
        }
    })();
});

// Eliminar la función separada generateSummaryAndKeyPoints si ya no se usa
// async function generateSummaryAndKeyPoints(recordingId: string, transcriptionText: string) { ... }

// --- Podrían añadirse rutas GET /:recordingId/status etc. aquí --- 

export default router; 