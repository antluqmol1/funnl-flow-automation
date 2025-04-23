import React, { useState } from 'react';
import { Recording } from '@/services/supabaseService';
import { useTranscriptionQuery } from '@/hooks/useTranscriptionQuery';
import { TranscriptionStatus as ServiceStatus } from '@/services/whisperService';
import { Calendar, Clock, ChevronRight, Trash2, AlertCircle, Download, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { deleteRecording, getTemporaryDownloadUrl } from '@/services/supabaseStorage';
import { Badge } from '@/components/ui/badge';

interface RecordingItemProps {
  recording: Recording;
  onDelete?: () => void;
}

const RecordingItem: React.FC<RecordingItemProps> = ({ recording, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    data: transcriptionData,
    isLoading: isLoadingStatus,
  } = useTranscriptionQuery(recording.id, {
    polling: true,
    pollingInterval: 10000,
  });

  const getDisplayName = () => {
    if (recording.title && recording.title.trim() !== '') return recording.title;
    return `Grabación ${recording.id.substring(0, 8)}...`;
  };

  const formatDuration = (durationString: string | null) => {
    if (!durationString) return '--:--';
    try {
        const seconds = parseInt(durationString, 10);
        if (isNaN(seconds)) return durationString;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    } catch {
        return durationString;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return { relativeTime: 'Fecha desconocida', exactDate: '' };
    try {
      const date = new Date(dateString);
      const relativeTime = formatDistanceToNow(date, { addSuffix: true, locale: es });
      const exactDate = format(date, 'dd/MM/yyyy HH:mm');
      return { relativeTime, exactDate };
    } catch (e) {
      return { relativeTime: 'Fecha inválida', exactDate: '' };
    }
  };

  const handleDownload = async () => {
    const filePath = recording.file_path;
    if (!filePath) {
        setError('Ruta de archivo no disponible para descarga.');
        console.warn("Intento de descarga sin file_path en recording:", recording.id);
        return;
    }
    try {
      setError(null);
      const { url, error: downloadError } = await getTemporaryDownloadUrl(filePath);
      
      if (downloadError || !url) {
        throw new Error(downloadError?.message || 'No se pudo generar la URL de descarga');
      }
      
      const fileName = filePath.split('/').pop() || `grabacion_${recording.id}.webm`;
      
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error al descargar archivo:', err);
      setError(err instanceof Error ? err.message : 'No se pudo descargar el archivo');
    }
  };

  const handleDelete = async () => {
    const filePath = recording.file_path;
    if (!recording.id || !filePath) {
      setError('Información de grabación incompleta para eliminar.');
      return;
    }
    
    setIsDeleting(true);
    setError(null);
    
    try {
      const { success, error: deleteError } = await deleteRecording(recording.id, filePath);
      
      if (!success || deleteError) {
        throw deleteError || new Error('Error al eliminar la grabación');
      }
      
      if (onDelete) onDelete();
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Error al eliminar grabación:', err);
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la grabación');
    } finally {
      setIsDeleting(false);
    }
  };

  const { relativeTime, exactDate } = formatDate(recording.created_at);

  const getStatusBadge = () => {
    const status: ServiceStatus | 'loading' | undefined = transcriptionData?.status;
    
    if (isLoadingStatus && !status) return <Badge variant="outline"><Loader2 className="h-3 w-3 animate-spin mr-1"/> Cargando...</Badge>;
    
    switch (status) {
      case 'idle':
        return <Badge variant="outline">Pendiente</Badge>;
      case 'processing':
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 animate-spin mr-1"/> Procesando...</Badge>;
      case 'completed':
        return <Badge variant="success">Completado</Badge>;
      case 'error':
        const errorMessage = transcriptionData?.error || 'Error';
        return <Badge variant="destructive" title={errorMessage}>Error</Badge>;
      case 'loading':
         return <Badge variant="outline"><Loader2 className="h-3 w-3 animate-spin mr-1"/> Cargando...</Badge>;
      default:
        return <Badge variant="outline">Desconocido</Badge>; 
    }
  };

  if (showDeleteConfirm) {
    return (
      <div className="funnl-item border-red-200 bg-red-50">
        <h3 className="font-medium text-red-800">¿Eliminar esta grabación?</h3>
        <p className="text-sm text-red-600 mt-1 mb-3">Esta acción no se puede deshacer</p>
        
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            className="flex-1" 
            onClick={() => setShowDeleteConfirm(false)}
            disabled={isDeleting}
          >
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            size="sm"
            className="flex-1" 
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin mr-1"/> Eliminando...</> : 'Confirmar'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="funnl-item">
      {error && (
        <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-center">
          <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
          {error}
        </div>
      )}
      
      <div className="flex justify-between items-start">
        <Link to={`/recording/${recording.id}`} className="flex-grow">
            <h3 className="font-medium text-gray-800 hover:text-funnl-primary transition-colors truncate pr-2">
                {getDisplayName()}
            </h3>
        </Link>
        <div className="flex space-x-1 flex-shrink-0">
          {getStatusBadge()}
        </div>
      </div>
      
      <div className="flex items-center mt-2 text-sm text-gray-500">
        <Calendar className="h-3 w-3 mr-1" />
        <span className="mr-3" title={exactDate}>{relativeTime}</span>
        <Clock className="h-3 w-3 mr-1" />
        <span>{formatDuration(recording.duration)}</span>
      </div>
      
      <div className="mt-3 flex justify-between">
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={handleDownload}
            disabled={!recording.file_path}
          >
            <Download className="h-3 w-3 mr-1" />
            Descargar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={!recording.file_path}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Eliminar
          </Button>
        </div>
        
        <Link 
          to={`/recording/${recording.id}`} 
          className="flex items-center text-sm text-funnl-primary font-medium"
        >
          Ver Detalles
          <ChevronRight className="h-4 w-4 ml-1" />
        </Link>
      </div>
    </div>
  );
};

export default RecordingItem;
