import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Readable } from 'stream';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY no está configurada en el entorno. La funcionalidad de transcripción real no estará disponible.');
}

// Cliente de OpenAI con configuración mejorada
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
    maxRetries: 2,                // Reintentar hasta 2 veces (menos para evitar bloqueos)
    timeout: 30000,               // Timeout más corto (30 segundos)
});

export interface TranscriptionResult {
    text: string;
    error?: string;
    usedMock?: boolean;           // Indica si se usó el mock
}

/**
 * Servicio para manejar transcripciones de audio usando OpenAI Whisper
 */
export class WhisperService {
    /**
     * Verifica si un formato de audio es óptimo para Whisper
     * @param filePath Ruta del archivo a verificar
     * @returns true si el formato es óptimo, false si no lo es
     */
    static isOptimalFormat(filePath: string): boolean {
        // Formatos recomendados por OpenAI: mp3, mp4, mpeg, mpga, m4a, wav, webm
        const optimalExtensions = ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm'];
        const extension = path.extname(filePath).toLowerCase();
        return optimalExtensions.includes(extension);
    }

    /**
     * Convierte un archivo webm a mp3 si es necesario (función dummy que se podría implementar)
     * @param filePath Ruta del archivo a convertir
     * @returns Ruta del archivo convertido o el mismo si no se necesita conversión
     */
    static async convertToOptimalFormat(filePath: string): Promise<string> {
        const extension = path.extname(filePath).toLowerCase();

        // Si ya es un formato óptimo, devolver el mismo archivo
        if (['.mp3', '.wav', '.m4a'].includes(extension)) {
            return filePath;
        }

        // En una implementación real, aquí convertiríamos el archivo
        // Por ahora, simplemente devolvemos el mismo archivo
        console.log(`Formato ${extension} no es óptimo, pero se usará tal cual`);
        return filePath;
    }

    /**
     * Verifica el tamaño y formato del archivo para Whisper
     * @param filePath Ruta del archivo a verificar
     * @returns Mensaje con información o undefined si todo está bien
     */
    static checkAudioFile(filePath: string): string | undefined {
        if (!fs.existsSync(filePath)) {
            return `El archivo ${filePath} no existe`;
        }

        // Verificar el tamaño
        const stats = fs.statSync(filePath);
        const fileSizeMB = stats.size / (1024 * 1024);

        // OpenAI limita a 25MB
        if (fileSizeMB > 25) {
            return `El archivo es demasiado grande (${Math.round(fileSizeMB)}MB). Máximo 25MB.`;
        }

        // Advertencia si el formato no es óptimo
        if (!this.isOptimalFormat(filePath)) {
            console.warn(`El formato de archivo no es óptimo para Whisper. Formatos recomendados: mp3, mp4, mpeg, mpga, m4a, wav, webm`);
        }

        // Si el archivo es demasiado pequeño, podría no contener suficiente audio
        if (stats.size < 1024) { // menos de 1KB
            return `El archivo es demasiado pequeño (${stats.size} bytes). Podría estar vacío o corrupto.`;
        }

        return undefined; // Todo bien
    }

    /**
     * Fragmenta el archivo de audio en partes más pequeñas si es necesario
     * (Implementación dummy de ejemplo)
     * @param filePath Ruta del archivo de audio
     * @returns Array con rutas a los fragmentos (o el archivo original si no se fragmenta)
     */
    static async splitAudioIfNeeded(filePath: string): Promise<string[]> {
        const stats = fs.statSync(filePath);
        const fileSizeMB = stats.size / (1024 * 1024);

        // Si el archivo es pequeño, no es necesario fragmentarlo
        if (fileSizeMB < 10) {
            return [filePath];
        }

        // En una implementación real, aquí fragmentaríamos el archivo
        // Por ahora, simplemente devolvemos el mismo archivo
        console.log('El archivo es grande, en una implementación real se fragmentaría');
        return [filePath];
    }

    /**
     * Transcribe un archivo de audio usando OpenAI Whisper API
     * @param filePath Ruta del archivo de audio a transcribir
     * @returns Resultado de la transcripción
     */
    static async transcribeAudio(filePath: string): Promise<TranscriptionResult> {
        try {
            // Verificar que el archivo existe y tiene el formato correcto
            const fileCheck = this.checkAudioFile(filePath);
            if (fileCheck) {
                throw new Error(fileCheck);
            }

            // Verificar que tenemos la API key
            if (!OPENAI_API_KEY) {
                throw new Error('OPENAI_API_KEY no está configurada. No se puede usar la API de Whisper.');
            }

            console.log(`Transcribiendo audio: ${filePath}`);
            console.log(`Tamaño del archivo: ${fs.statSync(filePath).size} bytes`);

            // Convertir a formato óptimo si es necesario
            const optimizedFilePath = await this.convertToOptimalFormat(filePath);

            // Preparar el archivo para enviarlo a la API
            const fileStream = fs.createReadStream(optimizedFilePath);

            try {
                // Llamar a la API de OpenAI según la documentación
                console.log('Llamando a la API de OpenAI Whisper...');
                const response = await openai.audio.transcriptions.create({
                    file: fileStream,
                    model: "whisper-1",
                    language: "es",
                    response_format: "json",
                    temperature: 0,       // Menor temperatura para mayor precisión
                    prompt: "Transcribe el siguiente audio en español. El audio puede contener preguntas o instrucciones."
                });

                // Cerrar el stream después de usarlo
                fileStream.close();

                if (!response.text || response.text.trim() === '') {
                    console.warn('La API de Whisper devolvió una transcripción vacía');
                    return {
                        text: '',
                        error: 'Transcripción vacía devuelta por la API',
                        usedMock: false
                    };
                }

                console.log('Transcripción completada:', response.text);

                return {
                    text: response.text,
                    usedMock: false
                };
            } catch (apiError: any) {
                // Cerrar el stream en caso de error
                fileStream.close();
                throw apiError; // Relanzar para manejo en el catch exterior
            }
        } catch (error: any) {
            console.error('Error al transcribir audio:', error);

            // Verificar si el error está relacionado con problemas de red
            const isNetworkError = error.message && (
                error.message.includes('ECONNRESET') ||
                error.message.includes('ETIMEDOUT') ||
                error.message.includes('ECONNABORTED') ||
                error.message.includes('ENOTFOUND') ||
                error.message.includes('Connection error') ||
                error.message.includes('network') ||
                error.message.includes('timeout')
            );

            // Proporcionar información más detallada sobre el error
            let errorMessage = error instanceof Error ? error.message : 'Error desconocido';

            if (isNetworkError) {
                errorMessage = `Error de red al conectar con OpenAI: ${errorMessage}`;
            }

            // Manejar errores específicos de la API de OpenAI
            if (error.status) {
                errorMessage += ` (Status: ${error.status})`;
            }

            // Si hay un mensaje de error de la API
            if (error.response && error.response.data && error.response.data.error) {
                errorMessage += `: ${error.response.data.error.message}`;
            }

            return {
                text: '',
                error: errorMessage,
                usedMock: false
            };
        }
    }

    /**
     * Implementación de simulación para pruebas o cuando la API no está disponible
     * @param filePath Ruta del archivo de audio (no se usa en la simulación)
     * @returns Resultado simulado de la transcripción
     */
    static async mockTranscribeAudio(filePath: string): Promise<TranscriptionResult> {
        console.log(`[MOCK] Transcribiendo audio: ${filePath}`);

        // Array de respuestas simuladas para dar variedad
        const mockResponses = [
            "Busca los contactos que se añadieron esta semana y cuéntame cuántos son",
            "¿Puedes mostrarme las ventas del último trimestre?",
            "Necesito información sobre los nuevos productos",
            "¿Quién es el cliente que más ha comprado este mes?"
        ];

        // Seleccionar una respuesta aleatoria
        const mockText = mockResponses[Math.floor(Math.random() * mockResponses.length)];

        // Simular un retardo como lo haría la API real
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log(`[MOCK] Transcripción generada: "${mockText}"`);
        return {
            text: mockText,
            usedMock: true
        };
    }

    /**
     * Intenta usar la API real, pero si falla recurre al mock automáticamente.
     * @param filePath Ruta del archivo de audio a transcribir
     * @returns Resultado de la transcripción, ya sea real o simulada
     */
    static async fallbackToMock(filePath: string): Promise<TranscriptionResult> {
        console.log('Intentando usar la API de Whisper con fallback automático...');

        try {
            // Verificar el archivo antes de intentar la transcripción
            const fileCheck = this.checkAudioFile(filePath);
            if (fileCheck) {
                console.warn(`Problema con el archivo: ${fileCheck}. Usando mock.`);
                return await this.mockTranscribeAudio(filePath);
            }

            // Verificar API key
            if (!OPENAI_API_KEY) {
                console.warn('OPENAI_API_KEY no configurada. Usando mock.');
                return await this.mockTranscribeAudio(filePath);
            }

            // Intentar con fragmentación si el archivo es grande
            const fileParts = await this.splitAudioIfNeeded(filePath);

            if (fileParts.length === 1) {
                // Si no se fragmentó, usar el método estándar
                const result = await this.transcribeAudio(filePath);

                // Si hay un error o no hay texto, usar el mock
                if (result.error || !result.text) {
                    console.warn('La API de Whisper falló o no devolvió texto. Usando mock como fallback.');
                    return await this.mockTranscribeAudio(filePath);
                }

                return result;
            } else {
                // Si se fragmentó, transcribir cada parte (no implementado realmente)
                console.log('Procesando archivo fragmentado (simulado)');
                return await this.mockTranscribeAudio(filePath);
            }
        } catch (error) {
            // Verificar si es un error de conexión específico ECONNRESET
            const isConnectionReset = error instanceof Error &&
                (error.message.includes('ECONNRESET') ||
                    error.message.includes('Connection error') ||
                    error.message.toLowerCase().includes('network') ||
                    error.message.toLowerCase().includes('timeout'));

            if (isConnectionReset) {
                console.warn('Error de conexión detectado (ECONNRESET). Es posible que haya problemas de red o que la API de OpenAI esté experimentando dificultades.');
            }

            console.warn('Error al usar la API de Whisper. Usando mock como fallback:', error);
            return await this.mockTranscribeAudio(filePath);
        }
    }
}

export default WhisperService; 