import { supabase } from '@/lib/supabase';
import apiClient from '@/lib/axiosClient';
import axios from 'axios';

/**
 * Códigos de error para el servicio de transcripción
 */
export enum WhisperErrorCode {
    NOT_FOUND = 'not_found',
    INVALID_FORMAT = 'invalid_format',
    TOO_LARGE = 'too_large',
    RATE_LIMIT = 'rate_limit',
    PROCESSING_ERROR = 'processing_error',
    UNKNOWN = 'unknown'
}

/**
 * Interfaces para manejar las transcripciones
 */
export interface TranscriptionRequestOptions {
    audioBlob: Blob;
    language?: string;
    prompt?: string;
    generateSummary?: boolean;
    generateKeyPoints?: boolean;
    detectSpeakers?: boolean;
}

export interface TranscriptionSegment {
    id: string;
    start: number;
    end: number;
    text: string;
    speaker?: string;
    confidence?: number;
}

export type TranscriptionStatus = 'idle' | 'processing' | 'completed' | 'error';

export interface TranscriptionResponse {
    id: string;
    status: TranscriptionStatus;
    progress?: number;
    completed?: boolean;
    transcription?: string;
    summary?: string;
    key_points?: string[];
    segments?: TranscriptionSegment[];
    error?: string;
    message?: string;
}

export interface TranscriptionError {
    code: WhisperErrorCode;
    message: string;
    details?: any;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // ms

/**
 * Solicita el inicio de una transcripción para una grabación existente
 * @param recordingId ID de la grabación ya existente en Supabase
 * @param signedUrl URL firmada para la grabación
 * @returns Promise con el estado inicial del proceso
 */
export async function requestTranscription(
    recordingId: string,
    signedUrl: string
): Promise<TranscriptionResponse> {
    try {
        console.log(`[whisperService] Solicitando inicio de transcripción para ID: ${recordingId} usando URL firmada.`);

        const response = await apiClient.post(`/api/transcriptions/${recordingId}/process`,
            { signedUrl },
            {}
        );

        const responseData = response.data;
        console.log(`[whisperService] Respuesta recibida:`, responseData);

        return {
            id: responseData.id || recordingId,
            status: responseData.status || 'processing',
            progress: responseData.progress || 0,
            message: responseData.message || 'Procesamiento iniciado',
            completed: false,
            transcription: undefined,
            summary: undefined,
            key_points: undefined,
            segments: undefined,
            error: undefined,
        } as TranscriptionResponse;

    } catch (error: any) {
        console.error('[whisperService] Error en requestTranscription:', error);
        if (axios.isAxiosError(error) && error.response) {
            console.error(`[whisperService] Error ${error.response.status} al solicitar transcripción:`, error.response.data);
            const errorMsg = error.response.data?.message || error.response.data?.error || `Error ${error.response.status} al iniciar transcripción`;
            throw new Error(errorMsg);
        } else {
            throw error;
        }
    }
}

/**
 * Cancela una transcripción en curso
 */
export async function cancelTranscription(
    recordingId: string
): Promise<{ success: boolean }> {
    try {
        console.log(`[whisperService] Solicitando cancelación de transcripción para ID: ${recordingId}`);
        const response = await apiClient.post(`/api/transcriptions/${recordingId}/cancel`);

        return response.data;

    } catch (error: any) {
        console.error('[whisperService] Error al cancelar transcripción:', error);
        if (axios.isAxiosError(error) && error.response) {
            console.error(`[whisperService] Error ${error.response.status} al cancelar:`, error.response.data);
            const errorMsg = error.response.data?.message || error.response.data?.error || `Error ${error.response.status} al cancelar transcripción`;
            throw new Error(errorMsg);
        } else {
            throw error;
        }
    }
}

/**
 * Descarga la transcripción como archivo de texto
 */
export function downloadTranscription(
    recordingId: string,
    transcription: string,
    filename = 'transcripcion.txt'
): void {
    const element = document.createElement('a');
    const file = new Blob([transcription], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

/**
 * Maneja los errores de la API Whisper y los convierte a un formato estandarizado
 */
export function handleWhisperError(error: any): TranscriptionError {
    if (!error) {
        return {
            code: WhisperErrorCode.UNKNOWN,
            message: 'Error desconocido'
        };
    }

    if (error?.status === 404) {
        return {
            code: WhisperErrorCode.NOT_FOUND,
            message: 'Transcripción no encontrada'
        };
    }

    if (error?.message?.includes('timeout') || error?.message?.includes('network')) {
        return {
            code: WhisperErrorCode.UNKNOWN,
            message: 'Tiempo de espera agotado al contactar el servicio'
        };
    }

    if (error?.status === 413) {
        return {
            code: WhisperErrorCode.TOO_LARGE,
            message: 'El archivo de audio es demasiado grande'
        };
    }

    if (error?.status === 429) {
        return {
            code: WhisperErrorCode.RATE_LIMIT,
            message: 'Has excedido el límite de solicitudes'
        };
    }

    if (error?.code === 'PGRST301') {
        return {
            code: WhisperErrorCode.UNKNOWN,
            message: 'No tienes permiso para acceder a esta transcripción'
        };
    }

    return {
        code: WhisperErrorCode.UNKNOWN,
        message: error?.message || 'Error desconocido en el servicio de transcripción'
    };
}

/**
 * Verifica el estado actual de una transcripción
 * Puede usar API REST o Supabase según la implementación
 */
export async function checkTranscriptionStatus(
    recordingId: string
): Promise<TranscriptionResponse> {
    let attempts = 0;

    while (attempts < MAX_RETRIES) {
        try {
            const { data, error } = await supabase
                .from('meeting_recordings')
                .select('status, transcription, summary, key_points, segments, progress_percentage')
                .eq('id', recordingId)
                .maybeSingle();

            if (!data) {
                console.warn(`Registro no encontrado para ID ${recordingId} en checkTranscriptionStatus. Devolviendo estado idle.`);
                return {
                    id: recordingId,
                    status: 'idle',
                    progress: 0,
                    completed: false,
                    transcription: null,
                    summary: null,
                    key_points: null,
                    segments: null,
                    error: undefined
                };
            }

            if (error) {
                throw error;
            }

            let processedKeyPoints = data.key_points;
            if (processedKeyPoints) {
                try {
                    if (typeof processedKeyPoints === 'string') {
                        processedKeyPoints = JSON.parse(processedKeyPoints);
                    }
                    if (!Array.isArray(processedKeyPoints) && typeof processedKeyPoints === 'object') {
                        processedKeyPoints = Object.values(processedKeyPoints).map(p => String(p));
                    }
                } catch (err) {
                    console.error('Error al procesar puntos clave:', err);
                    processedKeyPoints = typeof data.key_points === 'string' ? [data.key_points] : data.key_points;
                }
            }

            let processedSegments = data.segments;
            if (processedSegments && typeof processedSegments === 'string') {
                try {
                    processedSegments = JSON.parse(processedSegments);
                } catch (err) {
                    console.error('Error al procesar segmentos:', err);
                    processedSegments = null;
                }
            }

            return {
                id: recordingId,
                status: data.status as TranscriptionStatus,
                progress: data.progress_percentage || 0,
                completed: data.status === 'completed',
                transcription: data.transcription || null,
                summary: data.summary || null,
                key_points: processedKeyPoints || null,
                segments: processedSegments || null,
                error: data.status === 'error' ? 'Error en la transcripción' : undefined
            };
        } catch (error) {
            console.warn(`Intento ${attempts + 1}/${MAX_RETRIES} fallido:`, error);
            attempts++;

            if (attempts >= MAX_RETRIES) {
                const processedError = handleWhisperError(error);
                return {
                    id: recordingId,
                    status: 'error',
                    completed: false,
                    transcription: null,
                    summary: null,
                    key_points: null,
                    segments: null,
                    error: processedError.message
                };
            }

            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, attempts - 1)));
        }
    }

    return {
        id: recordingId,
        status: 'error',
        completed: false,
        transcription: null,
        summary: null,
        key_points: null,
        segments: null,
        error: 'Error inesperado al verificar la transcripción'
    };
} 