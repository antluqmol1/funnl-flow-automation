import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useTranscription } from '@/hooks/useTranscription';
import { TranscriptionResponse, TranscriptionSegment } from '@/types/transcription';
import { 
  analyzeSentiment, 
  analyzeTopics, 
  extractActionItems,
  analyzeEntities, 
  SentimentResult,
  TopicResult,
  ActionItem,
  Entity
} from '@/services/transcriptionAnalytics';

interface TranscriptionContextType {
  // Datos principales
  transcription: string | null;
  summary: string | null;
  keyPoints: string[] | null;
  segments: TranscriptionSegment[] | null;
  
  // Estado
  status: 'idle' | 'loading' | 'processing' | 'completed' | 'error';
  progress: number;
  progressPercentage: number;
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  errorMessage: string | null;
  
  // Edición de transcripción
  isEditing: boolean;
  editedTranscription: string | null;
  startEditing: () => void;
  updateEditedTranscription: (text: string) => void;
  saveEditedTranscription: () => Promise<void>;
  cancelEditing: () => void;
  
  // Análisis
  sentiment: SentimentResult | null;
  topics: TopicResult[] | null;
  actions: ActionItem[] | null;
  entities: Entity[] | null;
  
  // Estado de análisis
  isAnalyzing: boolean;
  
  // Acciones
  requestTranscription: (audioBlob: Blob, options?: any) => Promise<void>;
  cancelTranscription: () => Promise<void>;
  refreshTranscription: () => Promise<void>;
  
  // Acciones de análisis
  analyzeSentiment: () => Promise<void>;
  analyzeTopics: () => Promise<void>;
  extractActionItems: () => Promise<void>;
  analyzeEntities: () => Promise<void>;
  analyzeAll: () => Promise<void>;
  
  // Utilidades
  copyToClipboard: (text: string, label?: string) => void;
  downloadTranscription: (filename?: string) => void;
}

const TranscriptionContext = createContext<TranscriptionContextType | null>(null);

export function useTranscriptionContext() {
  const context = useContext(TranscriptionContext);
  if (!context) {
    throw new Error('useTranscriptionContext debe ser usado dentro de un TranscriptionProvider');
  }
  return context;
}

interface TranscriptionProviderProps {
  recordingId: string;
  children: React.ReactNode;
  pollingInterval?: number;
  autoAnalyze?: boolean;
}

export const TranscriptionProvider: React.FC<TranscriptionProviderProps> = ({
  recordingId,
  children,
  pollingInterval = 3000,
  autoAnalyze = false
}) => {
  // Estados de análisis
  const [sentiment, setSentiment] = useState<SentimentResult | null>(null);
  const [topics, setTopics] = useState<TopicResult[] | null>(null);
  const [actions, setActions] = useState<ActionItem[] | null>(null);
  const [entities, setEntities] = useState<Entity[] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Estados de edición
  const [isEditing, setIsEditing] = useState(false);
  const [editedTranscription, setEditedTranscription] = useState<string | null>(null);
  
  // Usar hook de transcripción
  const transcriptionData = useTranscription(recordingId, {
    polling: true,
    pollingInterval
  });
  
  // Ejecutar análisis automático cuando se completa la transcripción
  useEffect(() => {
    if (autoAnalyze && 
        transcriptionData.status === 'completed' && 
        transcriptionData.transcription && 
        !sentiment && !topics && !actions && !entities) {
      analyzeAllData();
    }
  }, [autoAnalyze, transcriptionData.status, transcriptionData.transcription]);
  
  // Funciones de edición
  const startEditing = () => {
    setEditedTranscription(transcriptionData.transcription);
    setIsEditing(true);
  };
  
  const updateEditedTranscription = (text: string) => {
    setEditedTranscription(text);
  };
  
  const saveEditedTranscription = async () => {
    if (!editedTranscription) return;
    
    try {
      // Aquí iría la lógica para guardar la transcripción editada
      // Por ejemplo, una llamada a la API para persistir los cambios
      // transcriptionData.transcription = editedTranscription; // Esto no es posible directamente
      
      // Almacenar la transcripción editada en algún lugar (simulación)
      // En una implementación real, se guardaría en la base de datos
      console.log('Guardando transcripción editada:', editedTranscription);
      
      // Finalizar la edición
      setIsEditing(false);
      setEditedTranscription(null);
      
      // Refrescar los datos para ver los cambios
      await transcriptionData.refreshTranscription();
    } catch (error) {
      console.error('Error al guardar la transcripción editada:', error);
      throw error;
    }
  };
  
  const cancelEditing = () => {
    setIsEditing(false);
    setEditedTranscription(null);
  };
  
  // Funciones de análisis
  const analyzeSentimentData = async () => {
    if (!transcriptionData.transcription) return;
    
    try {
      setIsAnalyzing(true);
      const result = await analyzeSentiment(recordingId, transcriptionData.transcription);
      if (!result.error) {
        setSentiment(result.sentiment);
      }
    } catch (error) {
      console.error('Error al analizar sentimiento:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const analyzeTopicsData = async () => {
    if (!transcriptionData.transcription) return;
    
    try {
      setIsAnalyzing(true);
      const result = await analyzeTopics(recordingId, transcriptionData.transcription);
      if (!result.error) {
        setTopics(result.topics);
      }
    } catch (error) {
      console.error('Error al analizar temas:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const extractActionItemsData = async () => {
    if (!transcriptionData.transcription) return;
    
    try {
      setIsAnalyzing(true);
      const result = await extractActionItems(recordingId, transcriptionData.transcription);
      if (!result.error) {
        setActions(result.actions);
      }
    } catch (error) {
      console.error('Error al extraer elementos de acción:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const analyzeEntitiesData = async () => {
    if (!transcriptionData.transcription) return;
    
    try {
      setIsAnalyzing(true);
      const result = await analyzeEntities(recordingId, transcriptionData.transcription);
      if (!result.error) {
        setEntities(result.entities);
      }
    } catch (error) {
      console.error('Error al analizar entidades:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const analyzeAllData = async () => {
    if (!transcriptionData.transcription) return;
    
    try {
      setIsAnalyzing(true);
      await Promise.all([
        analyzeSentimentData(),
        analyzeTopicsData(),
        extractActionItemsData(),
        analyzeEntitiesData()
      ]);
    } catch (error) {
      console.error('Error al realizar análisis completo:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Crear valor del contexto
  const value = useMemo(() => ({
    // Datos principales
    transcription: transcriptionData.transcription,
    summary: transcriptionData.summary,
    keyPoints: transcriptionData.keyPoints,
    segments: transcriptionData.segments,
    
    // Estado
    status: transcriptionData.status,
    progress: transcriptionData.progressPercentage,
    progressPercentage: transcriptionData.progressPercentage,
    isLoading: transcriptionData.isLoading,
    isError: transcriptionData.isError,
    error: transcriptionData.error,
    errorMessage: transcriptionData.errorMessage,
    
    // Edición de transcripción
    isEditing,
    editedTranscription,
    startEditing,
    updateEditedTranscription,
    saveEditedTranscription,
    cancelEditing,
    
    // Análisis
    sentiment,
    topics,
    actions,
    entities,
    
    // Estado de análisis
    isAnalyzing,
    
    // Acciones
    requestTranscription: transcriptionData.requestTranscription,
    cancelTranscription: transcriptionData.cancelTranscription,
    refreshTranscription: transcriptionData.refreshTranscription,
    
    // Acciones de análisis
    analyzeSentiment: analyzeSentimentData,
    analyzeTopics: analyzeTopicsData,
    extractActionItems: extractActionItemsData,
    analyzeEntities: analyzeEntitiesData,
    analyzeAll: analyzeAllData,
    
    // Utilidades
    copyToClipboard: transcriptionData.copyToClipboard,
    downloadTranscription: transcriptionData.downloadTranscription
  }), [
    transcriptionData,
    sentiment,
    topics,
    actions,
    entities,
    isAnalyzing,
    recordingId,
    isEditing,
    editedTranscription
  ]);
  
  return (
    <TranscriptionContext.Provider value={value}>
      {children}
    </TranscriptionContext.Provider>
  );
}; 