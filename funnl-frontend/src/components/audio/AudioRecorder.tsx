import React, { useState, useRef, useEffect } from 'react';
import { Mic, StopCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  onRecordingCancel: () => void;
  className?: string;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onRecordingComplete,
  onRecordingCancel,
  className = ''
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Iniciar grabación automáticamente al montar el componente
  useEffect(() => {
    startRecording();
    return () => {
      stopRecording();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);
  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          onRecordingComplete(audioBlob);
        }
        
        // Detener y limpiar el stream
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start(100); // Capturar en chunks de 100ms
      setIsRecording(true);
      setRecordingTime(0);
      
      // Iniciar temporizador
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error("Error al iniciar la grabación:", error);
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    setIsRecording(false);
  };
  
  const cancelAudioRecording = () => {
    console.log("Iniciando cancelación de grabación de audio...");
    
    // Detener y limpiar el mediaRecorder
    if (mediaRecorderRef.current) {
      try {
        // Primero detener las pistas de audio
        if (mediaRecorderRef.current.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach(track => {
            console.log("Deteniendo pista de audio:", track.id);
            track.stop();
          });
        }
        
        // Si el mediaRecorder está activo, intentar detenerlo correctamente
        if (mediaRecorderRef.current.state !== 'inactive') {
          // Eliminar el listener de ondataavailable para evitar generar el blob
          const oldMediaRecorder = mediaRecorderRef.current;
          const emptyFunction = () => {};
          oldMediaRecorder.ondataavailable = emptyFunction;
          oldMediaRecorder.onstop = emptyFunction;
          
          try {
            oldMediaRecorder.stop();
          } catch (e) {
            console.log("Error no crítico al detener mediaRecorder:", e);
          }
        }
      } catch (error) {
        console.error("Error al limpiar mediaRecorder:", error);
      }
    }
    
    // Limpiar el timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Limpiar los chunks de audio acumulados
    audioChunksRef.current = [];
    
    // Actualizar el estado
    setIsRecording(false);
    setRecordingTime(0);
    
    // Notificar al componente padre
    console.log("Notificando cancelación al componente padre");
    onRecordingCancel();
  };
  
  // Formatear tiempo en mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="animate-pulse">
            <Mic className="h-5 w-5 text-red-500" />
          </div>
          <div className="text-sm font-medium">Grabando audio</div>
          <div className="text-sm font-mono">{formatTime(recordingTime)}</div>
        </div>
        <div className="flex gap-2">
          <Button 
            size="sm"
            variant="outline"
            onClick={cancelAudioRecording}
          >
            <X className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
          <Button 
            size="sm"
            onClick={stopRecording}
          >
            <StopCircle className="h-4 w-4 mr-1" />
            Finalizar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AudioRecorder; 