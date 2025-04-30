import React, { useState, useEffect, useRef } from 'react';
import { AssistantService } from '../services/assistantService';
import { Mic, Send, StopCircle, X, Type, MessageSquare, User, ArrowUp } from 'lucide-react';
import AudioRecorder from '../components/audio/AudioRecorder';
import MessageComponent from '../components/chat/Message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import BottomNavbar from '@/components/layout/BottomNavbar';
import PageHeader from '@/components/layout/PageHeader';

// Definición de la interfaz Message
export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  isProcessingAudio?: boolean;
}

const Agent = () => {
  // Estados
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [audioMode, setAudioMode] = useState(true); // Por defecto en modo audio
  const [error, setError] = useState<string | null>(null);
  
  // Referencias
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Generar ID único para mensajes
  const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Verificar conexión con el servidor
  const checkConnection = async () => {
    try {
      console.log("Verificando conexión inicial con el servidor...");
      // Una solicitud simple para verificar si el servicio está disponible
      await AssistantService.sendMessage('ping');
      setIsConnected(true);
      setError(null);
    } catch (error) {
      setIsConnected(false);
      setError('No se puede conectar al servidor. Verifica tu conexión.');
      console.error('Error de conexión:', error);
    }
  };

  // Efecto para inicializar mensajes
  useEffect(() => {
    // Mensaje de bienvenida inicial
    setMessages([
      {
        id: generateId(),
        content: "Hola, soy el asistente de Funnl. ¿En qué puedo ayudarte hoy?",
        role: 'assistant',
        timestamp: new Date()
      }
    ]);

    // Establecer conexión con el servicio - solo una vez al cargar
    checkConnection();
    
    // No incluimos checkConnection en las dependencias para que no se ejecute más de una vez
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Efecto para hacer scroll al fondo cuando hay nuevos mensajes
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Scroll al final del chat
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Manejar envío de mensaje de texto
  const handleSendMessage = async () => {
    if (!input.trim() && !isRecording) return;
    
    if (isRecording) {
      return; // No permitir envío mientras se graba
    }

    // Limpiar errores anteriores
    setError(null);

    // Agregar mensaje del usuario al chat
    const userMessage: Message = {
      id: generateId(),
      content: input,
      role: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput(''); // Limpiar input
    
    try {
      setIsProcessing(true);
      
      // Agregar mensaje provisional del asistente (loading)
      const assistantMessageId = generateId();
      setMessages(prev => [
        ...prev, 
        {
          id: assistantMessageId,
          content: '...',
          role: 'assistant',
          timestamp: new Date(),
          isProcessingAudio: false
        }
      ]);

      // Obtener respuesta del asistente
      const response = await AssistantService.sendMessage(input);
      
      // Actualizar con la respuesta real
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId
          ? { ...msg, content: response.message, isProcessingAudio: false }
          : msg
      ));
      
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      setError('Error al procesar tu mensaje. Inténtalo de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Manejar entrada de texto
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  // Manejar tecla Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Alternar entre modo audio y texto
  const toggleInputMode = () => {
    setAudioMode(!audioMode);
  };

  // Iniciar grabación de audio
  const startRecording = () => {
    setIsRecording(true);
  };

  // Manejar finalización de grabación de audio
  const handleRecordingComplete = async (audioBlob: Blob) => {
    setIsRecording(false);
    
    // Limpiar errores anteriores
    setError(null);
    
    try {
      // Agregar mensaje temporal del usuario indicando audio
      const userMessageId = generateId();
      setMessages(prev => [
        ...prev, 
        {
          id: userMessageId,
          content: 'Enviando mensaje de audio...',
          role: 'user',
          timestamp: new Date()
        }
      ]);
      
      // Agregar mensaje provisional del asistente (procesando audio)
      const assistantMessageId = generateId();
      setMessages(prev => [
        ...prev, 
        {
          id: assistantMessageId,
          content: '',
          role: 'assistant',
          timestamp: new Date(),
          isProcessingAudio: true
        }
      ]);
      
      setIsProcessing(true);
      
      // Enviar audio al servicio
      const response = await AssistantService.sendAudioMessage(audioBlob);
      
      // Actualizar mensaje del usuario con la transcripción
      setMessages(prev => prev.map(msg => 
        msg.id === userMessageId
          ? { ...msg, content: response.transcription || 'Mensaje de audio' }
          : msg
      ));
      
      // Actualizar mensaje del asistente con la respuesta
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId
          ? { ...msg, content: response.message, isProcessingAudio: false }
          : msg
      ));
      
      setTranscription(response.transcription || null);
      
    } catch (error) {
      console.error('Error al procesar audio:', error);
      setError('Error al procesar tu audio. Inténtalo de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Cancelar grabación de audio
  const handleRecordingCancel = () => {
    setIsRecording(false);
    // Asegurarnos de limpiar cualquier estado relacionado con el audio
    setTranscription(null);
    console.log("Grabación cancelada por el usuario");
  };

  // Mejoramos el useEffect para asegurar la inicialización correcta del layout
  useEffect(() => {
    // Esto fuerza un reflow que ayuda con el posicionamiento inicial
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
      }
      if (chatContainerRef.current) {
        chatContainerRef.current.style.opacity = '1';
      }
    }, 100);
  }, []);

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <div className="flex flex-col flex-1 overflow-hidden pb-14">
        {/* Header */}
        <PageHeader
          title="Asistente IA"
          subtitle="Consulta tus datos y obtén ayuda inteligente"
        />

        {/* Panel de error */}
        {error && (
          <div className="bg-destructive/10 text-destructive px-6 py-2 text-sm border-b border-destructive/20 shrink-0">
            <div className="container mx-auto flex items-center">
              <span className="mr-2">⚠️</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Área principal de chat - Ahora usa flex-1 dentro del nuevo wrapper */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Contenedor interno para centrar y limitar ancho de mensajes */}
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.map((message) => (
              <MessageComponent
                key={message.id}
                message={message}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Panel inferior de entrada - Sigue siendo shrink-0 */}
        <div className="shrink-0 border-t border-border bg-background">
          {/* Contenedor interno para centrar y limitar ancho de controles */}
          <div className="max-w-4xl mx-auto p-4">
            {/* Grabadora de audio cuando está en modo audio y grabando */}
            {audioMode && isRecording ? (
              <AudioRecorder
                onRecordingComplete={handleRecordingComplete}
                onRecordingCancel={handleRecordingCancel}
                className="mb-4"
              />
            ) : (
              <div className="flex items-end space-x-2">
                {/* Botón para cambiar modo */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleInputMode}
                  className="rounded-full"
                  title={audioMode ? "Cambiar a modo texto" : "Cambiar a modo audio"}
                >
                  {audioMode ? <Type className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>

                {/* Input de texto o botón de audio según el modo */}
                {audioMode ? (
                  <Button
                    variant="default"
                    size="lg"
                    onClick={startRecording}
                    disabled={isRecording || isProcessing}
                    className={cn(
                      "rounded-full flex-1 gap-2",
                      isProcessing && "opacity-70"
                    )}
                  >
                    <Mic className="h-4 w-4" />
                    {isProcessing ? "Procesando..." : "Presiona para hablar"}
                  </Button>
                ) : (
                  <div className="flex w-full">
                    <Input
                      type="text"
                      value={input}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder="Escribe un mensaje..."
                      className="flex-1 rounded-full rounded-r-none border-r-0"
                      disabled={isProcessing}
                    />
                    <Button
                      variant="default"
                      size="icon"
                      onClick={handleSendMessage}
                      disabled={!input.trim() || isProcessing}
                      className="rounded-full rounded-l-none h-10"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Indicador de transcripción de audio reciente */}
            {transcription && !isRecording && (
              <div className="mt-2 text-xs text-muted-foreground italic">
                Transcripción: {transcription}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Barra de navegación inferior - Ahora es hermano del wrapper, no hijo */}
      <BottomNavbar />
    </div>
  );
};

export default Agent;
