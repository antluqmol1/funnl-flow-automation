import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import PageHeader from '@/components/layout/PageHeader';
import BottomNavbar from '@/components/layout/BottomNavbar';
import { ArrowLeft, Calendar, Clock, Download, AlertCircle, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import TranscriptionViewerV2 from '@/components/agent/TranscriptionViewerV2';
import { useTranscriptionQuery, TranscriptionStatus as HookTranscriptionStatus } from '@/hooks/useTranscriptionQuery';
import { TranscriptionProvider } from '@/contexts/TranscriptionContext';
import { getTemporaryDownloadUrl } from '@/services/supabaseStorage';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Recording, getRecordingById } from '@/services/supabaseService';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { requestTranscription } from '@/services/whisperService';

const RecordingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isRequestingTranscription, setIsRequestingTranscription] = useState(false);

  console.log(`[RecordingDetail] Renderizando para ID: ${id}`);
  
  const {
    data: transcriptionHookData,
    isLoading: isLoadingTranscriptionPolling,
    isError: isErrorTranscriptionPolling,
    error: transcriptionPollingError,
    requestTranscriptionMutation,
  } = useTranscriptionQuery(id || '', { 
      polling: true,
  });
  
  useEffect(() => {
    console.log(`[RecordingDetail][TranscriptionPolling] ID: ${id}, isLoading: ${isLoadingTranscriptionPolling}, isError: ${isErrorTranscriptionPolling}, Error: ${transcriptionPollingError}`);
    if (transcriptionHookData) {
        console.log(`[RecordingDetail][TranscriptionPolling] Datos recibidos. Status DB: ${transcriptionHookData.status}`);
        console.log('[RecordingDetail][TranscriptionPolling] Contenido completo de transcriptionHookData:', JSON.stringify(transcriptionHookData, null, 2));
    } else {
        console.log('[RecordingDetail][TranscriptionPolling] transcriptionHookData es null o undefined.');
    }
  }, [id, isLoadingTranscriptionPolling, isErrorTranscriptionPolling, transcriptionPollingError, transcriptionHookData]);
  
  const { 
    data: recordingData, 
    isLoading: isLoadingRecording, 
    isError: isErrorRecording, 
    error: recordingQueryError, 
    status: recordingQueryStatus
  } = useQuery<Recording | null, Error>({
    queryKey: ['recording', id],
    queryFn: async () => {
      console.log(`[RecordingDetail][Recording] Ejecutando queryFn getRecordingById para ID: ${id}`);
      if (!id) return Promise.resolve(null);
      const data = await getRecordingById(id); 
      return data; 
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1
  });
  
  useEffect(() => {
      console.log(`[RecordingDetail][Recording] ID: ${id}, QueryStatus: ${recordingQueryStatus}, isLoading: ${isLoadingRecording}, isError: ${isErrorRecording}, Error: ${recordingQueryError}`);
      if (recordingData) {
          console.log(`[RecordingDetail][Recording] Datos (de tabla meeting_recordings) recibidos. Path: ${recordingData.file_path}, Status DB: ${recordingData.status}, Transcripción existe?: ${!!recordingData.transcription}`);
      }
  }, [id, recordingQueryStatus, isLoadingRecording, isErrorRecording, recordingQueryError, recordingData]);
  
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [audioUrlError, setAudioUrlError] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    const fetchAudioUrl = async (filePath: string) => {
      console.log(`[RecordingDetail][Audio] Intentando obtener URL para path: ${filePath}`);
      setAudioUrlError(null);
      try {
        const { url, error } = await getTemporaryDownloadUrl(filePath);
        if (error || !url) {
          console.error("[RecordingDetail][Audio] Error al obtener URL temporal:", error);
          throw error || new Error("No se pudo obtener URL de audio");
        }
        console.log("[RecordingDetail][Audio] URL obtenida con éxito.");
        setAudioUrl(url);
      } catch (err) {
        console.error("[RecordingDetail][Audio] Error completo en fetchAudioUrl:", err);
        setAudioUrlError("No se pudo cargar el audio.");
      }
    };

    const filePath = recordingData?.file_path;
    console.log(`[RecordingDetail][Audio] useEffect ejecutado. isLoadingRecording: ${isLoadingRecording}, recordingData existe: ${!!recordingData}, filePath: ${filePath}`);
    
    if (filePath && !audioUrl && !audioUrlError) {
        fetchAudioUrl(filePath);
    } else if (!isLoadingRecording && recordingData && !filePath) {
         console.warn("[RecordingDetail][Audio] Datos de grabación cargados, pero falta file_path para el audio.");
         setAudioUrlError("No se encontró la ruta del archivo de audio.")
    }
  }, [recordingData, isLoadingRecording, audioUrl, audioUrlError]);

  useEffect(() => {
    const needsTranscription = 
      recordingData && 
      recordingData.status !== 'completed' && 
      recordingData.status !== 'transcribing' && 
      recordingData.status !== 'failed' &&
      !isRequestingTranscription && 
      id &&
      audioUrl;

    if (needsTranscription) {
      console.log(`[RecordingDetail] Transcripción necesaria para ${id} (estado DB: ${recordingData.status}) y audioUrl lista. Solicitando ahora...`);
      setIsRequestingTranscription(true); 
      
      requestTranscriptionMutation.mutate(
        { recordingId: id, signedUrl: audioUrl },
        {
          onSuccess: () => {
            console.log(`[RecordingDetail] Solicitud de transcripción para ${id} enviada con éxito.`);
            toast({ title: "Iniciando transcripción", description: "El proceso puede tardar unos minutos.", variant: "default"});
          },
          onError: (err) => {
            console.error(`[RecordingDetail] Error al solicitar transcripción para ${id}:`, err);
            toast({ title: "Error", description: "No se pudo iniciar la transcripción.", variant: "destructive" });
            setIsRequestingTranscription(false);
          }
        }
      );
    }

  }, [recordingData, id, isRequestingTranscription, toast, audioUrl, queryClient, requestTranscriptionMutation]);

  const formatDuration = (durationString: string | number | null | undefined): string => {
    let seconds: number | undefined;
    if (typeof durationString === 'number') {
        seconds = durationString;
    } else if (typeof durationString === 'string') {
        seconds = parseInt(durationString, 10);
    } else {
        return '--:--';
    }

    if (isNaN(seconds) || seconds < 0) return '--:--';
    
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return { relativeTime: 'Fecha desconocida', exactDate: '' };
    try {
      const date = new Date(dateString);
      const relativeTime = formatDistanceToNow(date, { addSuffix: true, locale: es });
      const exactDate = format(date, 'dd/MM/yyyy HH:mm');
      return { relativeTime, exactDate };
    } catch (e) {
      console.error("Error formateando fecha:", dateString, e);
      return { relativeTime: 'Fecha inválida', exactDate: '' };
    }
  };

  const handleDownload = async () => {
    const filePath = recordingData?.file_path;
    console.log(`[RecordingDetail][Download] Intentando descargar. FilePath: ${filePath}`);
    if (!filePath) {
        console.warn("[RecordingDetail][Download] No hay filePath para descargar.");
        toast({ title: "Error", description: "Ruta de archivo no disponible.", variant: "destructive" });
        return;
    }
    try {
      console.log("[RecordingDetail][Download] Obteniendo URL temporal...");
      const { url, error } = await getTemporaryDownloadUrl(filePath);
      if (error || !url) {
        console.error("[RecordingDetail][Download] Error al obtener URL:", error);
        throw new Error('No se pudo generar la URL de descarga');
      }
      const fileName = filePath.split('/').pop() || `grabacion_${id}.webm`;
      console.log(`[RecordingDetail][Download] URL obtenida. Iniciando descarga como: ${fileName}`);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast({ title: "Descargando audio..." });
    } catch (err) {
      console.error('[RecordingDetail][Download] Error al descargar archivo:', err);
      toast({ title: "Error al descargar", description: "No se pudo descargar el archivo de audio", variant: "destructive" });
    }
  };

  if (recordingQueryStatus === 'pending') {
    console.log(`[RecordingDetail] Renderizando estado de carga inicial. QueryStatus: ${recordingQueryStatus}`);
    return (
      <div className="mobile-container">
        <PageHeader title="Cargando grabación" subtitle="Obteniendo datos..." />
        <div className="p-4 flex flex-col items-center justify-center h-[50vh]">
          <Spinner className="mb-4" />
          <p className="text-gray-500">Cargando datos de la grabación...</p>
        </div>
        <BottomNavbar />
      </div>
    );
  }

  if (isErrorRecording || (recordingQueryStatus === 'success' && !recordingData)) {
    const error = recordingQueryError;
    const errorMessage = error ? (error instanceof Error ? error.message : "Error desconocido") : "La grabación no existe o no tienes acceso a ella.";
    console.error(`[RecordingDetail] Renderizando estado de error/no encontrado. isErrorR: ${isErrorRecording}, QueryStatus: ${recordingQueryStatus}, id: ${id}, Error: ${errorMessage}`, error);
    return (
      <div className="mobile-container">
        <PageHeader title="Error" subtitle="No se pudo cargar la grabación" />
        <div className="p-4">
           <Link to="/meetings" className="flex items-center text-funnl-primary mb-4">
             <ArrowLeft className="h-4 w-4 mr-1" /> Volver a Reuniones
           </Link>
           <Card className="p-4 border-red-200 bg-red-50">
             <div className="flex items-start">
               <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0" />
               <div>
                 <h3 className="font-medium text-red-800 mb-1">No se pudo cargar la grabación</h3>
                 <p className="text-sm text-red-700">{errorMessage}</p>
                 <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/meetings')}>Volver a mis grabaciones</Button>
               </div>
             </div>
           </Card>
         </div>
        <BottomNavbar />
      </div>
    );
  }
  
  console.log(`[RecordingDetail] Renderizando contenido principal. ID: ${id}`);
  const { relativeTime, exactDate } = formatDate(recordingData.created_at);
  const durationFormatted = formatDuration(recordingData.duration_seconds ?? recordingData.duration);
  const title = recordingData.title || `Grabación ${id.substring(0, 8)}...`;
  
  // Determinar estado combinado de la transcripción para UI
  // Prioridad 1: Estado del hook (tabla transcriptions)
  // Prioridad 2: Estado de la grabación (tabla meeting_recordings)
  const statusFromHook = transcriptionHookData?.status; // Tipo: ServiceStatus | 'loading' | undefined
  const statusFromRecording = recordingData?.status; // Tipo: ... | null | undefined

  let displayStatus: HookTranscriptionStatus['status'] | Recording['status'] | 'unknown' = 'unknown';

  if (statusFromHook) {
    displayStatus = statusFromHook;
  } else if (statusFromRecording) {
    displayStatus = statusFromRecording;
  }

  console.log(`[RecordingDetail] Estado de transcripción determinado para UI: ${displayStatus}`);

  const isTranscriptionProcessing = 
      displayStatus === 'processing' || 
      displayStatus === 'transcribing' || 
      displayStatus === 'loading' || 
      isRequestingTranscription;
      
  // Acceder a .transcription dentro del objeto del hook
  const hasTranscription = !!transcriptionHookData?.transcription || !!recordingData?.transcription; 
  const transcriptionFailed = displayStatus === 'failed';

  return (
    <TranscriptionProvider recordingId={id}>
        <div className="mobile-container">
        <PageHeader 
            title={title} 
            subtitle={`Grabado ${relativeTime}`}
        />
        
        <div className="p-4 pb-24">
            <Link to="/meetings" className="flex items-center text-funnl-primary mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver a Reuniones
            </Link>
            
            <Card className="p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center text-sm text-gray-600">
                <Calendar className="h-4 w-4 mr-1" />
                <span title={exactDate}>{relativeTime}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                <Clock className="h-4 w-4 mr-1" />
                <span>{durationFormatted}</span>
                </div>
            </div>
            
            {audioUrl ? (
                <div className="mt-3">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Audio de la reunión</h3>
                <audio src={audioUrl} controls className="w-full mb-2" />
                <Button variant="outline" size="sm" onClick={handleDownload} className="w-full justify-center" disabled={!recordingData?.file_path}>
                    <Download className="h-4 w-4 mr-1" /> Descargar Audio
                </Button>
                </div>
            ) : audioUrlError ? (
                <p className="text-sm text-red-600 mt-2">{audioUrlError}</p>
            ) : (
                <p className="text-sm text-gray-500 mt-2">Cargando audio...</p>
            )}
            </Card>
            
            <div className="mb-6"><Separator /></div>
            
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-3">Transcripción</h2>
              
              {isTranscriptionProcessing && !hasTranscription && (
                <div className="flex items-center justify-center p-6 bg-gray-50 rounded-lg border border-gray-200">
                  <Loader className="h-5 w-5 mr-2 animate-spin text-funnl-primary" />
                  <p className="text-gray-600">Generando transcripción, por favor espera...</p>
                </div>
              )}

              {isErrorTranscriptionPolling && !isTranscriptionProcessing && (
                 <div className="p-4 border-red-200 bg-red-50 rounded-lg">
                    <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0" />
                    <div>
                        <h3 className="font-medium text-red-800 mb-1">Error al cargar transcripción</h3>
                        <p className="text-sm text-red-700">{transcriptionPollingError?.message || "No se pudo obtener la transcripción."}</p>
                    </div>
                    </div>
                </div>
              )}

              {hasTranscription ? (
                  <TranscriptionViewerV2 recordingId={id} />
              ) : !isTranscriptionProcessing && !isErrorTranscriptionPolling && !transcriptionFailed && (
                 <div className="text-center p-6 bg-gray-50 rounded-lg border border-gray-200">
                     <p className="text-gray-500">La transcripción aún no está disponible.</p>
                 </div>
              )}

              {transcriptionFailed && (
                 <div className="p-4 border-red-200 bg-red-50 rounded-lg">
                    <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0" />
                    <div>
                       <h3 className="font-medium text-red-800 mb-1">Error de Transcripción</h3>
                       <p className="text-sm text-red-700">Falló la generación de la transcripción para esta grabación.</p>
                    </div>
                   </div>
                 </div>
              )}

            </div>
        </div>
        
        <BottomNavbar />
        </div>
    </TranscriptionProvider>
  );
};

export default RecordingDetail;
