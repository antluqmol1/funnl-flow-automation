import React, { useState, useRef, useEffect } from 'react';
import { Mic, StopCircle, X, Check, Pause, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toast } from '@/components/ui/toast';
import { useToast } from '@/hooks/useToast';
import { useUser } from '@/contexts/UserContext';
import { uploadAudioToSupabase } from '@/services/supabaseStorage';
import { supabase } from '@/lib/supabase';
import { requestTranscription } from '@/services/whisperService';

// URL de la API
const API_URL = import.meta.env.VITE_MCP_API_URL || 'http://localhost:3001';

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  audioBlob?: Blob;
}

const RecordMeeting: React.FC = () => {
  // Estados para la grabación
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    recordingTime: 0,
  });
  
  // Estado para el manejo de la UI
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Referencias para manejar la grabación
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Hooks
  const { toast } = useToast();
  const { user } = useUser();

  // Comprobar permisos de micrófono al cargar el componente
  useEffect(() => {
    const checkMicrophonePermissions = async () => {
      try {
        // Verificar si el navegador soporta navigator.permissions
        if (navigator.permissions && navigator.permissions.query) {
          const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
          
          // Escuchar cambios en los permisos
          result.onchange = () => {
            setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
          };
        } else {
          console.log('API de permisos no soportada, se verificará al intentar grabar');
        }
      } catch (error) {
        console.error('Error al verificar permisos de micrófono:', error);
        setPermissionStatus('unknown');
      }
    };
    
    checkMicrophonePermissions();
    
    // Limpiar al desmontar el componente
    return () => {
      stopMediaTracks();
    };
  }, []);

  // Función para detener las pistas de audio y liberar recursos
  const stopMediaTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Iniciar grabación
  const startRecording = async () => {
    console.log('[RecordMeeting] Intentando iniciar grabación...');
    try {
      setErrorMessage(null);
      
      // Solicitar permisos y obtener stream de audio
      console.log('[RecordMeeting] Solicitando permisos de micrófono...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setPermissionStatus('granted');
      console.log('[RecordMeeting] Permisos concedidos.');
      
      // Crear instancia de MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      console.log('[RecordMeeting] MediaRecorder creado.');
      
      // Limpiar chunks anteriores
      audioChunksRef.current = [];
      
      // Configurar evento para recoger datos de audio
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(`[RecordMeeting] Chunk de audio recibido: ${event.data.size} bytes`);
          audioChunksRef.current.push(event.data);
        }
      };
      
      // Manejar eventos de error
      mediaRecorder.onerror = (event) => {
        console.error('[RecordMeeting] Error en MediaRecorder:', event);
        setErrorMessage('Error al grabar audio. Intenta de nuevo.');
        stopRecording(false); // Detener sin guardar
      };
      
      // Iniciar grabación
      mediaRecorder.start(1000); // Recoger datos cada segundo
      console.log('[RecordMeeting] Grabación iniciada (mediaRecorder.start).');
      
      // Actualizar estado
      setState(prev => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        recordingTime: 0
      }));
      
      toast({
        title: 'Grabación iniciada',
        description: 'La grabación ha comenzado correctamente',
        variant: 'default',
      });
      
    } catch (error) {
      console.error('Error al iniciar la grabación:', error);
      
      // Manejar errores específicos
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          setPermissionStatus('denied');
          setErrorMessage('No se ha permitido el acceso al micrófono.');
        } else if (error.name === 'NotFoundError') {
          setErrorMessage('No se ha encontrado ningún micrófono en el dispositivo.');
        } else {
          setErrorMessage(`Error al acceder al micrófono: ${error.message}`);
        }
      } else {
        setErrorMessage('Error desconocido al iniciar la grabación.');
      }
    }
  };

  // Pausar grabación
  const pauseRecording = () => {
    if (mediaRecorderRef.current && state.isRecording && !state.isPaused) {
      try {
        mediaRecorderRef.current.pause();
        setState(prev => ({ ...prev, isPaused: true }));
      } catch (error) {
        console.error('Error al pausar la grabación:', error);
        setErrorMessage('Error al pausar la grabación.');
      }
    }
  };

  // Reanudar grabación
  const resumeRecording = () => {
    if (mediaRecorderRef.current && state.isRecording && state.isPaused) {
      try {
        mediaRecorderRef.current.resume();
        setState(prev => ({ ...prev, isPaused: false }));
      } catch (error) {
        console.error('Error al reanudar la grabación:', error);
        setErrorMessage('Error al reanudar la grabación.');
      }
    }
  };

  // Detener grabación
  const stopRecording = (save = true) => {
    if (mediaRecorderRef.current && state.isRecording) {
      try {
        console.log(`[RecordMeeting] Deteniendo grabación. ¿Guardar?: ${save}`);
        mediaRecorderRef.current.stop();
        console.log('[RecordMeeting] MediaRecorder detenido.');
        
        // Si debemos guardar, crear el blob de audio
        if (save && audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          console.log(`[RecordMeeting] Blob de audio creado: ${audioBlob.size} bytes, tipo: ${audioBlob.type}`);
          setState(prev => ({ 
            ...prev, 
            isRecording: false, 
            isPaused: false,
            audioBlob // Guardar blob en el estado para el siguiente paso
          }));
          
          // Opcional: Crear un objeto URL para previsualización
          // const audioUrl = URL.createObjectURL(audioBlob);
          
        } else {
          console.log('[RecordMeeting] Grabación detenida sin guardar o sin datos.');
          setState(prev => ({ 
            ...prev, 
            isRecording: false, 
            isPaused: false,
            audioBlob: undefined // Asegurarse de limpiar el blob
          }));
        }
        
        // Limpiar recursos
        stopMediaTracks();
        console.log('[RecordMeeting] Pistas de medios detenidas.');
        
        if (save && audioChunksRef.current.length > 0) {
          toast({
            title: 'Grabación completada',
            description: 'Prepara para guardar y transcribir.', // Mensaje actualizado
            variant: 'default',
          });
        } else if (!save) {
            toast({
                title: 'Grabación cancelada',
                description: 'La grabación no se guardó.',
                variant: 'default',
            });
        }
        
      } catch (error) {
        console.error('[RecordMeeting] Error al detener la grabación:', error);
        setErrorMessage('Error al detener la grabación.');
        
        // Forzar limpieza de recursos en caso de error
        stopMediaTracks();
        setState(prev => ({ 
          ...prev, 
          isRecording: false, 
          isPaused: false 
        }));
      }
    }
  };

  // Manejar la subida del audio a Supabase y INICIAR TRANSCRIPCIÓN
  const handleUpload = async (blob: Blob) => {
    console.log("[RecordMeeting] Iniciando handleUpload...", { userId: user?.id, blobSize: blob?.size });
    
    if (!user || !blob || blob.size === 0) {
      console.error("[RecordMeeting] Error: Usuario no autenticado o blob vacío.", { user, blob });
      setErrorMessage('No se pudo guardar la grabación. Inicia sesión o asegúrate de que la grabación no esté vacía.');
      toast({
        title: "Error",
        description: "Usuario no autenticado o grabación vacía.",
        variant: "destructive"
      });
      return;
    }
    
    setIsUploading(true);
    setErrorMessage(null);
    let recordingId: string | null = null;

    try {
      // 1. Subir archivo a Supabase Storage
      const fileName = `meeting_${user.id}_${new Date().toISOString()}.webm`;
      console.log("[RecordMeeting] Nombre de archivo generado:", fileName);
      const file = new File([blob], fileName, { type: 'audio/webm' });
      
      console.log("[RecordMeeting] Iniciando carga a Supabase Storage...");
      const { path, error: uploadError } = await uploadAudioToSupabase(file, user.id);

      if (uploadError || !path) {
        console.error("[RecordMeeting] Error al subir a Supabase Storage:", uploadError);
        throw new Error(uploadError?.message || 'Error al subir el archivo de audio.');
      }
      console.log("[RecordMeeting] Archivo subido a Supabase Storage. Ruta:", path);

      // 2. Crear registro en la tabla meeting_recordings
      console.log("[RecordMeeting] Creando registro en DB meeting_recordings...");
      const recordingPayload = {
        user_id: user.id,
        file_path: path,
        file_name: fileName,
        size_bytes: blob.size,
        mime_type: blob.type,
        duration_seconds: state.recordingTime, 
        title: `Reunión ${new Date().toLocaleString()}`, 
        status: 'recorded' // <- CAMBIO: Estado inicial sin transcripción pendiente
      };
      console.log("[RecordMeeting] Payload para insertar:", recordingPayload);
      console.log(`[RecordMeeting] FRONTEND User ID a insertar: >>> ${user.id} <<<`);
      
      const { data: recordingData, error: insertError } = await supabase
        .from('meeting_recordings') 
        .insert(recordingPayload)
        .select('id') 
        .single();

      if (insertError) {
        console.error("[RecordMeeting] Error al crear registro en DB:", insertError);
        throw new Error(insertError.message || 'Error al guardar la información de la grabación.');
      }

      if (!recordingData?.id) {
         console.error("[RecordMeeting] No se recibió ID de la grabación creada.");
         throw new Error('No se pudo obtener el ID de la grabación creada.');
      }
      recordingId = recordingData.id;
      console.log("[RecordMeeting] Registro de grabación creado en DB. ID:", recordingId);

      // La transcripción ya no se inicia aquí

      toast({
        title: "Grabación guardada correctamente", 
        description: "Podrás verla y generar la transcripción desde el historial.", 
        variant: "default"
      });
      
      // Limpiar estado después de éxito
      setState(prev => ({ ...prev, audioBlob: undefined, recordingTime: 0 }));
      setShowConfirmation(false);

    } catch (err) {
      console.error('Error completo en handleUpload:', err);
      const message = err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
      setErrorMessage(`Error: ${message}`);
      toast({
        title: "Error al procesar grabación",
        description: message,
        variant: "destructive"
      });
      // Opcional: Si falla, ¿deberíamos borrar el archivo subido o el registro en DB?
      // Considerar lógica de limpieza aquí si es necesario.
    } finally {
      setIsUploading(false);
    }
  };

  // Mostrar confirmación para detener grabación
  const toggleRecording = () => {
    if (state.isRecording) {
      setShowConfirmation(true);
    } else {
      startRecording();
    }
  };

  // Confirmar detención de grabación
  const confirmStopRecording = () => {
    console.log('[RecordMeeting] Confirmado: Detener y guardar grabación.');
    stopRecording(true); // Guardar al detener
    setShowConfirmation(false);
  };

  // Cancelar detención de grabación
  const cancelStopRecording = () => {
    console.log('[RecordMeeting] Cancelado: Continuar grabación.');
    setShowConfirmation(false);
  };

  // Formatear tiempo de grabación
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Timer para la grabación
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (state.isRecording && !state.isPaused) {
      console.log('[RecordMeeting] Iniciando timer de grabación.');
      interval = setInterval(() => {
        setState(prev => ({
          ...prev,
          recordingTime: prev.recordingTime + 1
        }));
      }, 1000);
    } else if (interval) {
        console.log('[RecordMeeting] Limpiando timer de grabación.');
        clearInterval(interval);
    }
    
    return () => {
        if (interval) {
            console.log('[RecordMeeting] Limpiando timer en desmontaje/cambio de estado.');
            clearInterval(interval);
        }
    };
  }, [state.isRecording, state.isPaused]);

  // UI cuando hay un blob de audio guardado
  if (state.audioBlob) {
    console.log(`[RecordMeeting] Renderizando UI de confirmación. Blob size: ${state.audioBlob.size}`);
    return (
      <div className="funnl-card mb-6">
        <h3 className="section-title">Grabación Completada</h3>
        <p className="section-subtitle">¿Qué quieres hacer con esta grabación?</p>
        
        <div className="mt-4 p-3 bg-green-50 border border-green-100 rounded-lg">
          <div className="flex items-center text-green-700">
            <Check className="h-5 w-5 mr-2" />
            <span className="font-medium">Audio grabado correctamente</span>
            <span className="ml-auto font-mono">{formatTime(state.recordingTime)}</span>
          </div>
        </div>
        
        <div className="mt-4 space-y-2">
          <Button 
            className="w-full bg-funnl-primary hover:bg-funnl-secondary"
            onClick={() => handleUpload(state.audioBlob!)}
            disabled={isUploading}
          >
            {isUploading ? 'Subiendo...' : 'Guardar y Transcribir'}
          </Button>
          
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setState(prev => ({ ...prev, audioBlob: undefined }))}
            disabled={isUploading}
          >
            Descartar Grabación
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="funnl-card mb-6">
      <h3 className="section-title">Grabar Reunión</h3>
      <p className="section-subtitle">Graba reuniones para obtener transcripción y resúmenes con IA</p>
      
      {/* Mensaje de error */}
      {errorMessage && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start text-amber-700">
            <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        </div>
      )}
      
      {/* Estado de permisos */}
      {permissionStatus === 'denied' && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start text-red-700">
            <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
            <span>Acceso al micrófono denegado. Debes permitir el acceso al micrófono en la configuración de tu navegador.</span>
          </div>
        </div>
      )}
      
      {/* Indicador de grabación */}
      {state.isRecording && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg animate-pulse-light">
          <div className="flex items-center text-red-600">
            <div className="h-2 w-2 bg-red-600 rounded-full mr-2" />
            <span className="font-medium">
              {state.isPaused ? 'Grabación pausada' : 'Grabación en curso'}
            </span>
            <span className="ml-auto font-mono">{formatTime(state.recordingTime)}</span>
          </div>
        </div>
      )}

      {/* Confirmación para detener */}
      {showConfirmation ? (
        <div className="bg-gray-100 p-3 rounded-lg mb-4">
          <p className="text-sm text-gray-700 mb-3">¿Estás seguro que deseas detener la grabación?</p>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full flex items-center justify-center"
              onClick={cancelStopRecording}
            >
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              className="w-full bg-funnl-primary hover:bg-funnl-secondary flex items-center justify-center"
              onClick={confirmStopRecording}
            >
              <Check className="h-4 w-4 mr-1" />
              Detener y Guardar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Botón principal de grabación */}
        <Button 
            variant={state.isRecording ? "destructive" : "default"}
            className={`w-full ${!state.isRecording ? 'bg-funnl-primary hover:bg-funnl-secondary' : ''}`}
          onClick={toggleRecording}
            disabled={permissionStatus === 'denied'}
        >
            {state.isRecording ? (
            <>
              <StopCircle className="h-5 w-5 mr-2" />
                Detener Grabación
            </>
          ) : (
            <>
              <Mic className="h-5 w-5 mr-2" />
                Iniciar Grabación
              </>
            )}
          </Button>
          
          {/* Botón de pausa (solo visible durante grabación) */}
          {state.isRecording && (
            <Button
              variant="outline"
              className="w-full"
              onClick={state.isPaused ? resumeRecording : pauseRecording}
            >
              {state.isPaused ? (
                <>
                  <Mic className="h-5 w-5 mr-2" />
                  Reanudar Grabación
                </>
              ) : (
                <>
                  <Pause className="h-5 w-5 mr-2" />
                  Pausar Grabación
            </>
          )}
        </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default RecordMeeting;
