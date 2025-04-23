import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle, FileText, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { requestTranscription, checkTranscriptionStatus, TranscriptionError } from '@/services/whisperService';
import { useToast } from '@/hooks/useToast';

interface TranscriptionStatusProps {
  recordingId: string;
  initialStatus?: string;
  onTranscriptionComplete?: () => void;
}

const TranscriptionStatus: React.FC<TranscriptionStatusProps> = ({
  recordingId,
  initialStatus = 'pending_transcription',
  onTranscriptionComplete
}) => {
  const [status, setStatus] = useState<string>(initialStatus);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [transcriptionText, setTranscriptionText] = useState<string | null>(null);
  const { toast } = useToast();

  // Verificar estado inicial
  useEffect(() => {
    if (initialStatus === 'processing' || initialStatus === 'transcribing') {
      checkStatus();
      // Configurar intervalo para verificar estado cada 10 segundos
      const interval = setInterval(checkStatus, 10000);
      return () => clearInterval(interval);
    }
  }, [recordingId, initialStatus]);

  // Verificar estado de la transcripción
  const checkStatus = async () => {
    try {
      setError(null);
      const result = await checkTranscriptionStatus(recordingId);
      
      if (result.error) {
        setError(result.error);
        return;
      }
      
      setStatus(result.status);
      
      if (result.completed) {
        setTranscriptionText(result.transcription || null);
        if (onTranscriptionComplete) {
          onTranscriptionComplete();
        }
        toast({
          title: 'Transcripción completada',
          description: 'La transcripción de la grabación ha finalizado correctamente',
          variant: 'default',
        });
      }
    } catch (err) {
      console.error('Error al verificar estado de transcripción:', err);
      setError('Error al verificar el estado de la transcripción');
    }
  };

  // Iniciar proceso de transcripción
  const startTranscription = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Solicitar transcripción sin necesidad de enviar audioBlob (ya está en el servidor)
      const response = await requestTranscription(recordingId, {
        audioBlob: new Blob(), // Blob vacío como placeholder
        generateSummary: true,
        generateKeyPoints: true
      });
      
      if (response.error) {
        // Manejar el error de forma segura independientemente del tipo
        if (typeof response.error === 'string') {
          setError(response.error);
        } else if (response.error && typeof response.error === 'object') {
          setError((response.error as TranscriptionError).message || 'Error desconocido');
        } else {
          setError('Error desconocido al iniciar la transcripción');
        }
        return;
      }
      
      setStatus('processing');
      toast({
        title: 'Transcripción iniciada',
        description: 'La grabación será procesada pronto. Este proceso puede tardar unos minutos.',
        variant: 'default',
      });
      
      // Configurar intervalo para verificar estado cada 10 segundos
      const interval = setInterval(checkStatus, 10000);
      
      // Limpiar intervalo después de 5 minutos (300000 ms)
      setTimeout(() => {
        clearInterval(interval);
      }, 300000);
      
    } catch (err) {
      console.error('Error al iniciar transcripción:', err);
      setError('Error al iniciar la transcripción');
    } finally {
      setIsLoading(false);
    }
  };

  // Renderizar diferentes estados
  const renderStatus = () => {
    switch (status) {
      case 'pending_transcription':
        return (
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
            <p className="text-amber-800 flex items-center mb-2">
              <AlertCircle className="h-4 w-4 mr-2" />
              Esta grabación aún no ha sido transcrita
            </p>
            <Button 
              onClick={startTranscription} 
              disabled={isLoading}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isLoading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Iniciando transcripción...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Transcribir Ahora
                </>
              )}
            </Button>
          </div>
        );
      
      case 'processing':
      case 'transcribing':
        return (
          <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
            <div className="flex items-center mb-2">
              <Spinner size="sm" className="text-blue-600 mr-2" />
              <p className="text-blue-800">Transcripción en proceso...</p>
            </div>
            <p className="text-blue-600 text-sm">
              Este proceso puede tardar varios minutos dependiendo de la duración del audio.
            </p>
            <Button 
              variant="outline"
              size="sm"
              onClick={checkStatus}
              className="mt-2 text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Verificar estado
            </Button>
          </div>
        );
      
      case 'completed':
        return (
          <div className="border border-green-200 bg-green-50 rounded-lg p-3">
            <p className="text-green-800 flex items-center">
              <Badge variant="success" className="mr-2">Completado</Badge>
              La transcripción se ha completado correctamente
            </p>
          </div>
        );
      
      case 'error':
        return (
          <div className="border border-red-200 bg-red-50 rounded-lg p-3">
            <p className="text-red-800 flex items-center mb-2">
              <AlertCircle className="h-4 w-4 mr-2" />
              Error en la transcripción
            </p>
            <Button 
              onClick={startTranscription} 
              disabled={isLoading}
              variant="outline"
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              Reintentar transcripción
            </Button>
          </div>
        );
      
      default:
        return (
          <div className="border border-gray-200 bg-gray-50 rounded-lg p-3">
            <p className="text-gray-600">Estado desconocido: {status}</p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={checkStatus}
              className="mt-2"
            >
              Verificar estado
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="my-4">
      <h3 className="text-sm font-medium mb-2">Estado de la transcripción</h3>
      {error && (
        <div className="text-sm text-red-600 mb-2">
          {error}
        </div>
      )}
      {renderStatus()}
    </div>
  );
};

export default TranscriptionStatus; 