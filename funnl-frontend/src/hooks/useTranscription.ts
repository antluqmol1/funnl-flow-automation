import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useTranscriptionQuery } from './useTranscriptionQuery';
import { WhisperErrorCode, handleWhisperError } from '@/lib/whisper-service';
import { TranscriptionSegment } from '@/types/transcription';

// Intervalo de polling en milisegundos (5 segundos por defecto)
const DEFAULT_POLLING_INTERVAL = 5000;

interface UseTranscriptionOptions {
    // Habilitar polling automático
    polling?: boolean;
    // Intervalo de polling en ms
    pollingInterval?: number;
    // Callback cuando la transcripción está lista
    onTranscriptionReady?: (transcription: string) => void;
    // Callback cuando ocurre un error
    onError?: (error: Error, code?: WhisperErrorCode) => void;
}

interface UseTranscriptionReturn {
    // Datos de transcripción y estado para compatibility con useTranscriptionQuery
    data?: {
        transcription: string | null;
        summary: string | null;
        key_points: string[] | null;
        segments: TranscriptionSegment[] | null;
        status: 'idle' | 'processing' | 'completed' | 'error';
        progress_percentage: number;
        error?: string | null;
    };

    // Datos de transcripción
    transcription: string | null;
    summary: string | null;
    keyPoints: string[] | null;
    segments: TranscriptionSegment[] | null;

    // Estado
    status: 'idle' | 'loading' | 'processing' | 'completed' | 'error';
    progressPercentage: number;
    isLoading: boolean;
    isError: boolean;
    errorMessage: string | null;
    errorCode: WhisperErrorCode | null;

    // Acciones
    requestTranscription: (audioBlob: Blob, options?: {
        language?: string;
        prompt?: string;
        generateSummary?: boolean;
        generateKeyPoints?: boolean;
    }) => Promise<void>;
    cancelTranscription: () => Promise<void>;
    refreshTranscription: () => Promise<void>;

    // Para compatibilidad con el contexto
    error?: string | null;
    refetch: () => Promise<void>;
    requestNewTranscription: (options?: any) => Promise<void>;
    cancelCurrentTranscription: () => Promise<void>;

    // Utilidades
    copyToClipboard: (text: string, label?: string) => void;
    downloadTranscription: (filename?: string) => void;
}

export function useTranscription(
    recordingId: string,
    options: UseTranscriptionOptions = {}
): UseTranscriptionReturn {
    // Opciones
    const {
        polling = true,
        pollingInterval = DEFAULT_POLLING_INTERVAL,
        onTranscriptionReady,
        onError
    } = options;

    // Estados locales
    const [transcription, setTranscription] = useState<string | null>(null);
    const [summary, setSummary] = useState<string | null>(null);
    const [keyPoints, setKeyPoints] = useState<string[] | null>(null);
    const [segments, setSegments] = useState<TranscriptionSegment[] | null>(null);
    const [progressPercentage, setProgressPercentage] = useState<number>(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [errorCode, setErrorCode] = useState<WhisperErrorCode | null>(null);

    // Hooks de UI
    const { toast } = useToast();

    // Usar el hook de React Query
    const {
        data: transcriptionStatus,
        isLoading: isStatusLoading,
        isError: isStatusError,
        refetch: refetchStatus,

        requestTranscriptionMutation,
        cancelTranscriptionMutation,
    } = useTranscriptionQuery(recordingId, {
        polling,
        pollingInterval,
        onSuccess: (data) => {
            if (data.status === 'completed' && data.transcription) {
                setTranscription(data.transcription);
                setSummary(data.summary || null);
                setKeyPoints(data.keyPoints || null);
                setSegments(data.segments || null);
                setProgressPercentage(100);

                if (onTranscriptionReady && data.transcription) {
                    onTranscriptionReady(data.transcription);
                }
            } else if (data.status === 'processing') {
                setProgressPercentage(data.progress || 0);
            }
        },
        onError: (error) => {
            const { message, code } = handleWhisperError(error);
            setErrorMessage(message);
            setErrorCode(code);

            if (onError) {
                onError(error, code);
            }
        }
    });

    // Estado combinado
    const status = isStatusLoading
        ? 'loading'
        : isStatusError
            ? 'error'
            : transcriptionStatus?.status || 'idle';

    // Solicitar transcripción
    const requestTranscription = useCallback(async (
        audioBlob: Blob,
        requestOptions?: {
            language?: string;
            prompt?: string;
            generateSummary?: boolean;
            generateKeyPoints?: boolean;
        }
    ) => {
        try {
            setErrorMessage(null);
            setErrorCode(null);

            await requestTranscriptionMutation.mutateAsync({
                recordingId,
                audioBlob,
                ...requestOptions
            });

            // Iniciar con 0% de progreso
            setProgressPercentage(0);
        } catch (error) {
            const { message, code } = handleWhisperError(error as Error);
            setErrorMessage(message);
            setErrorCode(code);

            if (onError) {
                onError(error as Error, code);
            }
        }
    }, [recordingId, requestTranscriptionMutation, onError]);

    // Cancelar transcripción
    const cancelTranscription = useCallback(async () => {
        try {
            await cancelTranscriptionMutation.mutateAsync(recordingId);
            toast({
                title: "Transcripción cancelada",
                description: "La transcripción ha sido cancelada",
            });
        } catch (error) {
            const { message } = handleWhisperError(error as Error);
            toast({
                variant: "destructive",
                title: "Error al cancelar",
                description: message,
            });
        }
    }, [recordingId, cancelTranscriptionMutation, toast]);

    // Refrescar transcripción
    const refreshTranscription = useCallback(async () => {
        try {
            setErrorMessage(null);
            setErrorCode(null);
            await refetchStatus();
        } catch (error) {
            const { message, code } = handleWhisperError(error as Error);
            setErrorMessage(message);
            setErrorCode(code);
        }
    }, [refetchStatus]);

    // Copiar al portapapeles
    const copyToClipboard = useCallback((text: string, label = 'Texto') => {
        navigator.clipboard.writeText(text)
            .then(() => {
                toast({
                    title: "Copiado al portapapeles",
                    description: `${label} copiado al portapapeles`,
                });
            })
            .catch(() => {
                toast({
                    variant: "destructive",
                    title: "Error al copiar",
                    description: "No se pudo copiar al portapapeles",
                });
            });
    }, [toast]);

    // Descargar transcripción
    const downloadTranscription = useCallback((filename = 'transcripcion.txt') => {
        if (!transcription) return;

        const blob = new Blob([transcription], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
            title: "Descargando transcripción",
            description: "La transcripción se está descargando",
        });
    }, [transcription, toast]);

    // Agregar alias para compatibilidad
    const error = errorMessage;
    const refetch = refreshTranscription;
    const requestNewTranscription = requestTranscription;
    const cancelCurrentTranscription = cancelTranscription;

    return {
        // Datos
        data: {
            transcription,
            summary,
            key_points: keyPoints,
            segments,
            status: status === 'loading' ? 'processing' : status,
            progress_percentage: progressPercentage,
            error: errorMessage
        },
        transcription,
        summary,
        keyPoints,
        segments,

        // Estado
        status,
        progressPercentage,
        isLoading: isStatusLoading || status === 'loading' || status === 'processing',
        isError: isStatusError || status === 'error',
        errorMessage,
        errorCode,

        // Para compatibilidad
        error,
        refetch,
        requestNewTranscription,
        cancelCurrentTranscription,

        // Acciones
        requestTranscription,
        cancelTranscription,
        refreshTranscription,

        // Utilidades
        copyToClipboard,
        downloadTranscription,
    };
} 