import { useState, useEffect, useRef, useCallback } from 'react';
import { checkTranscriptionStatus, TranscriptionResponse } from '@/services/whisperService';
import { getLocalTranscription, saveTranscriptionLocally } from '@/services/transcriptionStorage';

interface UseTranscriptionPollingOptions {
    recordingId: string;
    interval?: number;
    maxDuration?: number;
    useCache?: boolean;
    onProgress?: (progress: number) => void;
    onCompleted?: (data: TranscriptionResponse) => void;
    onError?: (error: any) => void;
}

interface UseTranscriptionPollingResult {
    data: TranscriptionResponse | null;
    isPolling: boolean;
    progress: number;
    error: any;
    startPolling: () => void;
    stopPolling: () => void;
    forceCheck: () => Promise<void>;
}

/**
 * Hook personalizado para realizar polling de estado de transcripción
 * con soporte para caché local, control fino, y estimaciones de tiempo
 */
export function useTranscriptionPolling({
    recordingId,
    interval = 3000,
    maxDuration = 600000, // 10 minutos
    useCache = true,
    onProgress,
    onCompleted,
    onError
}: UseTranscriptionPollingOptions): UseTranscriptionPollingResult {
    const [data, setData] = useState<TranscriptionResponse | null>(null);
    const [isPolling, setIsPolling] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    const [error, setError] = useState<any>(null);

    // Referencias para mantener estado entre renderizados
    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const checksRef = useRef<number>(0);
    const backoffRef = useRef<number>(interval);
    const isPollingRef = useRef<boolean>(false);

    // Cancelar el intervalo al desmontar
    useEffect(() => {
        return () => {
            if (pollingRef.current) {
                clearTimeout(pollingRef.current);
            }
        };
    }, []);

    // Función para verificar el estado
    const checkStatus = useCallback(async () => {
        if (!recordingId) return;

        try {
            setError(null);

            // Intentar obtener de caché primero si está habilitada
            if (useCache) {
                const cachedData = await getLocalTranscription(recordingId);
                if (cachedData && cachedData.status === 'completed') {
                    setData(cachedData);
                    setProgress(100);
                    setIsPolling(false);
                    isPollingRef.current = false;
                    onCompleted?.(cachedData);
                    return;
                }
            }

            // Obtener datos actualizados
            const result = await checkTranscriptionStatus(recordingId);

            // Incrementar contador de verificaciones
            checksRef.current += 1;

            // Calcular tiempo transcurrido desde el inicio
            const elapsed = startTimeRef.current
                ? Date.now() - startTimeRef.current
                : 0;

            // Calcular progreso (basado en tiempo transcurrido o valor del servidor)
            let newProgress = result.progress || 0;

            // Si no hay progreso reportado, usar una estimación basada en el tiempo
            if (newProgress === 0 && startTimeRef.current) {
                // Progreso estimado basado en tiempo transcurrido (máximo 95%)
                const estimatedProgress = Math.min(0.95, elapsed / maxDuration) * 100;
                newProgress = Math.max(newProgress, estimatedProgress);
            }

            // Ajustar intervalo de polling basado en estado
            if (result.status === 'completed' || result.status === 'error') {
                // Detener polling
                if (pollingRef.current) {
                    clearTimeout(pollingRef.current);
                    pollingRef.current = null;
                }
                setIsPolling(false);
                isPollingRef.current = false;

                // Establecer progreso al 100% si está completo
                if (result.status === 'completed') {
                    newProgress = 100;

                    // Guardar en caché local si está completo
                    if (useCache) {
                        await saveTranscriptionLocally(recordingId, result);
                    }

                    onCompleted?.(result);
                } else {
                    // Manejar error
                    const errorMessage = result.error || 'Error desconocido en la transcripción';
                    setError(errorMessage);
                    onError?.(errorMessage);
                }
            } else if (result.status === 'processing') {
                // Ajustar backoff según progreso
                // Si avanza rápido, reducir intervalo, si avanza lento, aumentarlo
                const progressRate = newProgress / Math.max(1, checksRef.current); // Progreso por verificación

                if (progressRate > 3) {
                    // Avanza rápido, reducir intervalo (mínimo 2 segundos)
                    backoffRef.current = Math.max(2000, interval * 0.7);
                } else if (progressRate < 0.5 && checksRef.current > 3) {
                    // Avanza lento, aumentar intervalo (máximo 10 segundos)
                    backoffRef.current = Math.min(10000, backoffRef.current * 1.5);
                }
            }

            // Actualizar estado
            setData(result);
            setProgress(newProgress);
            onProgress?.(newProgress);

        } catch (err) {
            console.error('Error al verificar estado de transcripción:', err);
            setError(err);
            onError?.(err);

            // Implementar backoff exponencial en caso de error
            backoffRef.current = Math.min(15000, backoffRef.current * 2);

            // Detener si hay demasiados errores
            if (checksRef.current > 10) {
                setIsPolling(false);
                isPollingRef.current = false;
                if (pollingRef.current) {
                    clearTimeout(pollingRef.current);
                    pollingRef.current = null;
                }
            }
        }
    }, [recordingId, interval, maxDuration, useCache, onProgress, onCompleted, onError]);

    // Función para iniciar el polling
    const startPolling = useCallback(() => {
        // Limpiar cualquier intervalo existente
        if (pollingRef.current) {
            clearTimeout(pollingRef.current);
        }

        // Resetear estado
        startTimeRef.current = Date.now();
        checksRef.current = 0;
        backoffRef.current = interval;
        setProgress(0);
        setIsPolling(true);
        isPollingRef.current = true;

        // Verificar inmediatamente
        checkStatus();

        // Configurar intervalo dinámico
        const schedulePoll = () => {
            if (!isPollingRef.current) return;

            pollingRef.current = setTimeout(() => {
                checkStatus().finally(() => {
                    // Continuar el polling solo si aún estamos en modo polling
                    if (isPollingRef.current) {
                        schedulePoll();
                    }
                });
            }, backoffRef.current);
        };

        schedulePoll();
    }, [checkStatus, interval]);

    // Función para detener el polling
    const stopPolling = useCallback(() => {
        setIsPolling(false);
        isPollingRef.current = false;
        if (pollingRef.current) {
            clearTimeout(pollingRef.current);
            pollingRef.current = null;
        }
    }, []);

    // Función para forzar una verificación inmediata
    const forceCheck = useCallback(async () => {
        await checkStatus();
    }, [checkStatus]);

    return {
        data,
        isPolling,
        progress,
        error,
        startPolling,
        stopPolling,
        forceCheck
    };
} 