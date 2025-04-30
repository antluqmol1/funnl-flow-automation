import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import PageHeader from '@/components/layout/PageHeader';
import BottomNavbar from '@/components/layout/BottomNavbar';
import { ArrowLeft, Calendar, Clock, Download, AlertCircle, Loader, FileText, ListChecks, BrainCircuit, Zap, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';

type SuggestedAction = {
  id: string;
  description: string;
  mcp_tool: string;
  arguments: any;
  confirmation_required: boolean;
};

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
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

  const [actionToConfirm, setActionToConfirm] = useState<SuggestedAction | null>(null);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);

  const { mutate: executeAction, isPending: isExecutingAction } = useMutation({
      mutationFn: async (action: SuggestedAction) => {
          console.log(`[RecordingDetail][Action] Ejecutando acción: ${action.mcp_tool} (ID: ${action.id})`);
          setExecutingActionId(action.id);

          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

          if (sessionError || !sessionData.session) {
              console.error("[RecordingDetail][Action] Error obteniendo sesión:", sessionError);
              throw new Error("No autenticado o error al obtener sesión");
          }
          const accessToken = sessionData.session.access_token;

          // --- Log para depurar los argumentos ---
          console.log("[RecordingDetail][Action] Enviando payload:", JSON.stringify({ action: action }, null, 2));
          // --- Fin Log ---

          // --- Obtener URL base de la API desde las variables de entorno ---
          const apiUrl = import.meta.env.VITE_API_URL  || 'http://localhost:3001'; // Usar 3001 como fallback por si acaso

          const response = await fetch(`${apiUrl}/api/actions/execute`, { // <-- Usar la URL completa
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ action: action }),
          });

          const data = await response.json();

          if (!response.ok) {
              console.error(`[RecordingDetail][Action] Error API (${response.status}):`, data);
              throw new Error(data.details || data.error || 'Error al ejecutar la acción');
          }

          console.log(`[RecordingDetail][Action] Acción ${action.id} ejecutada con éxito. Resultado:`, data.result);
          return data;
      },
      onSuccess: (data, variables) => {
          toast({
              title: "Acción Ejecutada",
              description: data.message || `Acción '${variables.description}' completada.`,
              variant: "default",
          });
          queryClient.invalidateQueries({ queryKey: ['contacts'] });
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['deals'] });
      },
      onError: (error: Error, variables) => {
          toast({
              title: "Error al Ejecutar Acción",
              description: error.message || `No se pudo completar la acción '${variables.description}'.`,
              variant: "destructive",
          });
      },
      onSettled: () => {
          setExecutingActionId(null);
      }
  });

  const handleExecuteClick = (action: SuggestedAction) => {
    if (action.confirmation_required) {
      setActionToConfirm(action);
    } else {
      executeAction(action);
    }
  };

  if (isLoadingRecording || recordingQueryStatus === 'pending') {
    console.log(`[RecordingDetail] Renderizando estado de carga inicial. isLoading: ${isLoadingRecording}, QueryStatus: ${recordingQueryStatus}`);
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="Cargando grabación" subtitle="Obteniendo datos..." />
        <div className="mobile-container lg:hidden">
          <div className="p-4 flex flex-col items-center justify-center h-[50vh]">
            <Spinner className="mb-4" />
            <p className="text-gray-500">Cargando datos de la grabación...</p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 hidden lg:block">
          <div className="p-4 flex flex-col items-center justify-center h-[50vh]">
            <Spinner className="mb-4" />
            <p className="text-gray-500">Cargando datos de la grabación...</p>
          </div>
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
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="Error" subtitle="No se pudo cargar la grabación" />
        <div className="mobile-container lg:hidden">
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
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 hidden lg:block">
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
  const suggestedActions = recordingData?.suggested_actions;

  console.log(`[RecordingDetail] Estado Derivado: currentStatus=${currentStatus}, hasTranscription=${hasTranscription}, hasAnalysis=${hasAnalysis}, isProcessing=${isProcessing}, transcriptionFailed=${transcriptionFailed}`);

  // --- JSX para las diferentes secciones (para evitar repetición) ---
  const analysisCard = hasAnalysis && !transcriptionFailed && (
    <Card className="h-full">
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
  );

  const suggestedActionsCard = suggestedActions && suggestedActions.length > 0 && !transcriptionFailed && (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Zap className="h-5 w-5 mr-2 text-yellow-500" /> Acciones Sugeridas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 overflow-y-auto flex-grow">
        {suggestedActions.map((action) => {
          const isCurrentActionExecuting = isExecutingAction && executingActionId === action.id;
          return (
            <div key={action.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-md">
              <p className="text-sm text-gray-800 flex-1 mr-2">{action.description}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExecuteClick(action)}
                disabled={isCurrentActionExecuting || isExecutingAction}
              >
                {isCurrentActionExecuting ? (
                  <Loader className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-1" />
                )}
                {isCurrentActionExecuting ? 'Ejecutando...' : 'Ejecutar'}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );

  const transcriptionCard = (
    <Card>
      <CardHeader>
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Transcripción</CardTitle>
            <Badge variant={recordingData?.status === 'completed' ? 'default' : 'outline'}>
              {recordingData?.status === 'completed' ? 'Completada' : recordingData?.status}
            </Badge>
          </div>
        </div>
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
                {recordingData?.status === 'recorded' && audioUrl && (
                  <Button onClick={() => triggerTranscriptionProcessing({ recordingId: id!, signedUrl: audioUrl! })} disabled={isTriggeringTranscription} size="sm" className="mt-3">
                    {isTriggeringTranscription ? 'Iniciando...' : 'Iniciar Procesamiento Manualmente'}
                  </Button>
                )}
            </div>
        )}
      </CardContent>
    </Card>
  );

  const audioCard = (
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
  );

  const analysisLoadingMessage = isProcessing && hasTranscription && !hasAnalysis && !transcriptionFailed && (
      <div className="flex items-center justify-center p-4 text-sm text-gray-500">
        <Loader className="h-4 w-4 mr-2 animate-spin" />
        Generando análisis AI...
      </div>
  );

  return (
    <TranscriptionProvider recordingId={id}>
      <div className="min-h-screen bg-gray-50">
        <PageHeader 
            title={title} 
            subtitle={`Grabado ${relativeTime}`}
        />
        
        <div className="mobile-container lg:hidden">
          <div className="p-4 pb-24 space-y-6">
            <Link to="/meetings" className="flex items-center text-funnl-primary mb-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Volver a Reuniones
            </Link>
            {analysisCard}
            {analysisLoadingMessage}
            {suggestedActionsCard}
            {transcriptionCard}
            {audioCard}
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 hidden lg:block">
           <Link to="/meetings" className="flex items-center text-funnl-primary mb-4">
              <ArrowLeft className="h-4 w-4 mr-1" /> Volver a Reuniones
           </Link>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className={`space-y-6 ${!suggestedActionsCard ? 'lg:col-span-2' : ''}`}>
              {analysisCard}
              {analysisLoadingMessage}
            </div>
            {suggestedActionsCard && (
              <div className="space-y-6">
                {suggestedActionsCard}
              </div>
            )}
          </div>
          <div className="space-y-6">
            {transcriptionCard}
            {audioCard}
          </div>
        </div>
        
        <BottomNavbar />

        <AlertDialog open={!!actionToConfirm} onOpenChange={(open) => !open && setActionToConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Acción</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que quieres ejecutar la siguiente acción?
                <br />
                <strong className="mt-2 block">{actionToConfirm?.description}</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setActionToConfirm(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (actionToConfirm) {
                    executeAction(actionToConfirm);
                  }
                  setActionToConfirm(null);
                }}
                disabled={isExecutingAction}
              >
                {isExecutingAction ? 'Ejecutando...' : 'Confirmar y Ejecutar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TranscriptionProvider>
  );
};

export default RecordingDetail;
