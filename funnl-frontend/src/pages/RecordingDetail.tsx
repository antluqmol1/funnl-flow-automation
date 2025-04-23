import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import PageHeader from '@/components/layout/PageHeader';
import BottomNavbar from '@/components/layout/BottomNavbar';
import { ArrowLeft, Calendar, Clock, Download, AlertCircle, Loader, FileText, ListChecks, BrainCircuit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import TranscriptionViewerV2 from '@/components/agent/TranscriptionViewerV2';
import { TranscriptionProvider } from '@/contexts/TranscriptionContext';
import { getTemporaryDownloadUrl } from '@/services/supabaseStorage';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Recording, getRecordingById } from '@/services/supabaseService';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { requestTranscription } from '@/services/whisperService';

const RecordingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  console.log(`[RecordingDetail] Renderizando para ID: ${id}`);
  
  const {
    data: recordingData,
    isLoading: isLoadingRecording,
    isError: isErrorRecording,
    error: recordingQueryError,
    status: recordingQueryStatus,
    refetch: refetchRecording,
  } = useQuery<Recording | null, Error>({
    queryKey: ['recording', id],
    queryFn: async () => {
      console.log(`[RecordingDetail][Recording] Ejecutando queryFn getRecordingById para ID: ${id}`);
      if (!id) return Promise.resolve(null);
      const data = await getRecordingById(id);
      console.log(`[RecordingDetail][Recording] Datos recibidos de DB:`, data);
      return data;
    },
    enabled: !!id,
    refetchInterval: (query) => {
        const data = query.state.data as Recording | null | undefined;
        const isCurrentlyProcessing = data?.status === 'processing';
        const needsProcessing = data?.status === 'recorded' && !!audioUrl;
        return (isCurrentlyProcessing || needsProcessing) ? 5000 : false;
    },
    refetchIntervalInBackground: false,
    staleTime: 1 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1
  });
  
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
    if (filePath && !audioUrl && !audioUrlError && recordingQueryStatus === 'success') {
      fetchAudioUrl(filePath);
    } else if (recordingQueryStatus === 'success' && recordingData && !filePath) {
      console.warn("[RecordingDetail][Audio] Datos de grabación cargados, pero falta file_path para el audio.");
      setAudioUrlError("No se encontró la ruta del archivo de audio.");
    }
  }, [recordingData, recordingQueryStatus, audioUrl, audioUrlError]);

  const { mutate: triggerTranscriptionProcessing, isPending: isTriggeringTranscription } = useMutation({
    mutationFn: async ({ recordingId, signedUrl }: { recordingId: string, signedUrl: string }) => {
      console.log(`[RecordingDetail] Llamando a triggerTranscriptionProcessing (requestTranscription) para ID: ${recordingId}`);
      return requestTranscription(recordingId, signedUrl);
    },
    onSuccess: (data, variables) => {
      console.log(`[RecordingDetail] Solicitud de procesamiento para ${variables.recordingId} enviada con éxito.`);
      toast({ title: "Iniciando procesamiento", description: "La transcripción y análisis pueden tardar unos minutos.", variant: "default" });
      refetchRecording();
    },
    onError: (error, variables) => {
      console.error(`[RecordingDetail] Error al solicitar procesamiento para ${variables.recordingId}:`, error);
      toast({ title: "Error", description: "No se pudo iniciar el procesamiento de la grabación.", variant: "destructive" });
    },
  });

  useEffect(() => {
    const needsProcessingTrigger =
      recordingData &&
      recordingData.status === 'recorded' &&
      !!audioUrl &&
      !isTriggeringTranscription &&
      !!id;

    if (needsProcessingTrigger) {
      console.log(`[RecordingDetail] Grabación '${id}' en estado 'recorded' y audio listo. Disparando proceso...`);
      triggerTranscriptionProcessing({ recordingId: id!, signedUrl: audioUrl! });
    }
  }, [recordingData, audioUrl, id, triggerTranscriptionProcessing, isTriggeringTranscription]);

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

  if (isLoadingRecording || recordingQueryStatus === 'pending') {
    console.log(`[RecordingDetail] Renderizando estado de carga inicial. isLoading: ${isLoadingRecording}, QueryStatus: ${recordingQueryStatus}`);
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
  const title = recordingData.title || `Grabación ${id?.substring(0, 8)}...`;
  
  const currentStatus = recordingData.status;
  const hasTranscription = !!recordingData.transcription && recordingData.transcription.trim() !== '';
  const hasAnalysis = !!recordingData.summary || (!!recordingData.key_points && recordingData.key_points.length > 0);
  const isProcessing = currentStatus === 'processing';
  const transcriptionFailed = currentStatus === 'failed';

  console.log(`[RecordingDetail] Estado Derivado: currentStatus=${currentStatus}, hasTranscription=${hasTranscription}, hasAnalysis=${hasAnalysis}, isProcessing=${isProcessing}, transcriptionFailed=${transcriptionFailed}`);

  return (
    <TranscriptionProvider recordingId={id}>
        <div className="mobile-container">
        <PageHeader 
            title={title} 
            subtitle={`Grabado ${relativeTime}`}
        />
        
        <div className="p-4 pb-24 space-y-6">
            <Link to="/meetings" className="flex items-center text-funnl-primary -mb-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Volver a Reuniones
            </Link>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-3">
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
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-700">Audio de la reunión</h3>
                    <audio src={audioUrl} controls className="w-full" />
                    <Button variant="outline" size="sm" onClick={handleDownload} className="w-full justify-center" disabled={!recordingData?.file_path}>
                        <Download className="h-4 w-4 mr-1" /> Descargar Audio
                    </Button>
                  </div>
                ) : audioUrlError ? (
                    <p className="text-sm text-red-600 mt-2">{audioUrlError}</p>
                ) : (
                    <div className="flex items-center text-sm text-gray-500 mt-2">
                      <Spinner className="h-4 w-4 mr-2"/> Cargando audio...
                    </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-funnl-primary"/> Transcripción
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isProcessing && !hasTranscription && (
                  <div className="flex items-center justify-center p-6 bg-gray-50 rounded-lg border border-gray-200">
                    <Loader className="h-5 w-5 mr-2 animate-spin text-funnl-primary" />
                    <p className="text-gray-600">Generando transcripción...</p>
                  </div>
                )}

                {transcriptionFailed && (
                   <div className="p-4 border-red-200 bg-red-50 rounded-lg">
                      <div className="flex items-start">
                      <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0" />
                      <div>
                         <h3 className="font-medium text-red-800 mb-1">Error de Procesamiento</h3>
                         <p className="text-sm text-red-700">Falló la generación de la transcripción y/o análisis para esta grabación.</p>
                      </div>
                     </div>
                   </div>
                )}

                {hasTranscription ? (
                    <TranscriptionViewerV2 recordingId={id} />
                ) : !isProcessing && !transcriptionFailed && (
                   <div className="text-center p-6 bg-gray-50 rounded-lg border border-gray-200">
                       <p className="text-gray-500">La transcripción no está disponible o aún no se ha generado.</p>
                       {recordingData.status === 'recorded' && audioUrl && (
                          <Button onClick={() => triggerTranscriptionProcessing({ recordingId: id!, signedUrl: audioUrl! })} disabled={isTriggeringTranscription} size="sm" className="mt-3">
                            {isTriggeringTranscription ? 'Iniciando...' : 'Iniciar Procesamiento Manualmente'}
                          </Button>
                       )}
                   </div>
                )}
              </CardContent>
            </Card>

            {hasAnalysis && !transcriptionFailed && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BrainCircuit className="h-5 w-5 mr-2 text-funnl-secondary"/> Análisis AI
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {recordingData.summary && (
                    <div>
                      <h4 className="text-md font-semibold mb-1 text-gray-800">Resumen</h4>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md border border-gray-100">{recordingData.summary}</p>
                    </div>
                  )}

                  {recordingData.key_points && recordingData.key_points.length > 0 && (
                    <div>
                      <h4 className="text-md font-semibold mb-2 text-gray-800">Puntos Clave / Acciones</h4>
                      <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                        {recordingData.key_points.map((point, index) => (
                          <li key={index}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {isProcessing && hasTranscription && !hasAnalysis && !transcriptionFailed && (
               <div className="flex items-center justify-center p-4 text-sm text-gray-500">
                 <Loader className="h-4 w-4 mr-2 animate-spin" />
                 Generando análisis AI...
               </div>
            )}

        </div>
        
        <BottomNavbar />
        </div>
    </TranscriptionProvider>
  );
};

export default RecordingDetail;
