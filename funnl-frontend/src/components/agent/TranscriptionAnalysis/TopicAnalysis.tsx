import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Hash } from 'lucide-react';
import { analyzeTopics, TopicResult } from '@/services/transcriptionAnalytics';
import { useToast } from '@/hooks/useToast';

interface TopicAnalysisProps {
  recordingId: string;
  transcription: string | null;
  isLoading?: boolean;
}

/**
 * Componente para visualizar los temas principales de una transcripción
 */
const TopicAnalysis: React.FC<TopicAnalysisProps> = ({
  recordingId,
  transcription,
  isLoading = false
}) => {
  const [topics, setTopics] = useState<TopicResult[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Solicitar análisis inicial
  useEffect(() => {
    if (recordingId && transcription && !isLoading) {
      analyzeTopicsData();
    }
  }, [recordingId, transcription, isLoading]);

  // Función para solicitar análisis
  const analyzeTopicsData = async () => {
    if (!transcription) return;
    
    try {
      setAnalyzing(true);
      setError(null);
      
      const result = await analyzeTopics(recordingId, transcription);
      
      if (result.error) {
        setError(result.error);
        return;
      }
      
      setTopics(result.topics);
    } catch (error) {
      console.error('Error al analizar temas:', error);
      setError('No se pudieron analizar los temas principales');
      toast({
        title: 'Error',
        description: 'Error al analizar los temas',
        variant: 'destructive',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  // Obtener un color basado en la relevancia
  const getTopicColor = (relevance: number): string => {
    if (relevance > 0.8) return 'bg-blue-500';
    if (relevance > 0.6) return 'bg-blue-400';
    if (relevance > 0.4) return 'bg-blue-300';
    return 'bg-blue-200';
  };

  // Renderizar estado de carga
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Temas Principales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Renderizar error
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Temas Principales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center space-y-3 py-4 text-center">
            <p className="text-sm text-gray-500">{error}</p>
            <Button 
              variant="outline" 
              onClick={analyzeTopicsData}
              size="sm"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Si aún no hay datos
  if (!topics || topics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Temas Principales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center space-y-3 py-4 text-center">
            <p className="text-sm text-gray-500">
              {analyzing ? 'Analizando temas...' : 'No hay temas identificados'}
            </p>
            {!analyzing && (
              <Button 
                variant="outline" 
                onClick={analyzeTopicsData}
                size="sm"
              >
                Identificar Temas
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Ordenar temas por relevancia
  const sortedTopics = [...topics].sort((a, b) => b.relevance - a.relevance);

  // Renderizar resultados
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          <span>Temas Principales</span>
          <Badge variant="outline" className="font-normal">
            {topics.length} temas
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {sortedTopics.map((topic, index) => (
            <Badge
              key={index}
              className={`${getTopicColor(topic.relevance)} hover:${getTopicColor(topic.relevance)}`}
              title={`Relevancia: ${(topic.relevance * 100).toFixed(0)}%`}
            >
              <Hash className="mr-1 h-3 w-3" />
              {topic.topic}
            </Badge>
          ))}
        </div>

        <div className="rounded-md border">
          <div className="bg-gray-50 px-3 py-2 text-xs font-medium">
            Menciones destacadas
          </div>
          <ScrollArea className="h-48 rounded-b-md">
            <div className="p-3 space-y-3">
              {sortedTopics.slice(0, 3).map((topic, topicIndex) => (
                <div key={topicIndex} className="space-y-1">
                  <h4 className="flex items-center text-xs font-medium">
                    <Hash className="mr-1 h-3 w-3 text-blue-500" />
                    {topic.topic}
                  </h4>
                  <div className="space-y-1 pl-4">
                    {topic.segments.slice(0, 2).map((segment, segmentIndex) => (
                      <p key={segmentIndex} className="text-xs text-gray-600 border-l-2 border-blue-200 pl-2">
                        "{segment.text}"
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="rounded-md border p-2 bg-gray-50">
          <h4 className="text-xs font-medium">Palabras clave</h4>
          <div className="mt-1 flex flex-wrap gap-1">
            {sortedTopics.flatMap(topic => 
              topic.keywords.map((keyword, keywordIndex) => (
                <Badge
                  key={`${topic.topic}-${keywordIndex}`}
                  variant="outline"
                  className="text-xs bg-white"
                >
                  {keyword}
                </Badge>
              ))
            )}
          </div>
        </div>
        
        <div className="flex justify-end pt-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={analyzeTopicsData}
            disabled={analyzing}
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            {analyzing ? 'Actualizando...' : 'Actualizar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TopicAnalysis; 