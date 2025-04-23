import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    checkTranscriptionStatus,
    requestTranscription as requestTranscriptionApi,
    cancelTranscription as cancelTranscriptionApi,
    TranscriptionStatus as ServiceStatus,
    TranscriptionSegment
} from '@/services/whisperService';
import { useEffect, useRef } from 'react';

export interface TranscriptionStatus {
    transcription: string | null;
    status: ServiceStatus | 'loading';
    progress?: number;
    summary?: string;
    keyPoints?: string[];
    segments?: TranscriptionSegment[];
    error?: string;
}

// Clave para almacenar en caché las consultas de transcripción
const getTranscriptionQueryKey = (recordingId: string) =>
    ['transcription', recordingId];

interface UseTranscriptionQueryOptions {
    polling?: boolean;
    pollingInterval?: number;
    onSuccess?: (data: TranscriptionStatus) => void;
    onError?: (error: Error) => void;
}

/**
 * Hook para gestionar transcripciones con React Query
 */
export function useTranscriptionQuery(
    recordingId: string,
    options: UseTranscriptionQueryOptions = {}
) {
    const {
        polling = true,
        pollingInterval = 5000,
        onSuccess,
        onError
    } = options;

    const queryClient = useQueryClient();
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Consulta para obtener el estado de la transcripción
    const {
        data = {
            transcription: null,
            status: 'idle' as const,
            progress: 0
        },
        isLoading,
        isFetching,
        isError,
        error,
        refetch
    } = useQuery({
        queryKey: getTranscriptionQueryKey(recordingId),
        queryFn: async () => {
            const result = await checkTranscriptionStatus(recordingId);

            // Formatear respuesta para que coincida con nuestro tipo TranscriptionStatus
            return {
                transcription: result.transcription || null,
                status: result.status || (result.completed ? 'completed' : 'processing'),
                progress: result.progress || 0,
                summary: result.summary,
                keyPoints: result.key_points,
                segments: result.segments,
                error: result.error
            } as TranscriptionStatus;
        },
        // Configuración de polling
        refetchInterval: polling ? (function () {
            const defaultVal = pollingInterval;
            return defaultVal;
        })() : false,
        refetchOnWindowFocus: true,
        enabled: Boolean(recordingId),
        staleTime: 0 // Siempre considerar los datos obsoletos para que se actualicen
    });

    // Implementar polling manual para evitar problemas con refetchInterval y tipos
    useEffect(() => {
        if (!polling) return;

        let timer: NodeJS.Timeout | null = null;

        if (data.status !== 'completed' && data.status !== 'error') {
            timer = setTimeout(() => {
                refetch();
            }, pollingInterval);
        }

        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [data.status, polling, pollingInterval, refetch]);

    // Manejar callbacks externos
    useEffect(() => {
        if (data && onSuccess) {
            onSuccess(data);
        }
    }, [data, onSuccess]);

    useEffect(() => {
        if (error && onError) {
            onError(error as Error);
        }
    }, [error, onError]);

    // Mutación para solicitar una nueva transcripción
    const requestTranscriptionMutation = useMutation({
        mutationFn: async ({
            recordingId,
            signedUrl,
        }: {
            recordingId: string;
            signedUrl: string;
        }) => {
            return await requestTranscriptionApi(recordingId, signedUrl);
        },
        onSuccess: () => {
            // Invalidar la consulta para forzar una revalidación
            queryClient.invalidateQueries({ queryKey: getTranscriptionQueryKey(recordingId) });

            // Iniciar un polling manual para actualizar inmediatamente
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                refetch();
            }, 1000); // Esperar 1 segundo antes de consultar
        }
    });

    // Mutación para cancelar una transcripción
    const cancelTranscriptionMutation = useMutation({
        mutationFn: async (recordingId: string) => {
            return await cancelTranscriptionApi(recordingId);
        },
        onSuccess: () => {
            // Invalidar la consulta para forzar una revalidación
            queryClient.invalidateQueries({ queryKey: getTranscriptionQueryKey(recordingId) });
            refetch();
        }
    });

    // Limpiar el temporizador cuando el componente se desmonte
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, []);

    return {
        // Datos y estado de la consulta
        data,
        isLoading,
        isFetching,
        isError,
        error,
        refetch,

        // Mutaciones
        requestTranscriptionMutation,
        requestLoading: requestTranscriptionMutation.isPending,
        requestError: requestTranscriptionMutation.error,

        cancelTranscriptionMutation,
        cancelLoading: cancelTranscriptionMutation.isPending,
        cancelError: cancelTranscriptionMutation.error,
    };
}

export default useTranscriptionQuery; 