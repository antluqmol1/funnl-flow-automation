import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Smile, Meh, Frown, RefreshCw } from 'lucide-react';
import { analyzeSentiment, SentimentResult } from '@/services/transcriptionAnalytics';
import { useToast } from '@/hooks/useToast';

interface SentimentAnalysisProps {
  recordingId: string;
  transcription: string | null;
  isLoading?: boolean;
}

/**
 * Componente para visualizar el análisis de sentimiento de una transcripción
 */
const SentimentAnalysis: React.FC<SentimentAnalysisProps> = ({
  recordingId,
  transcription,
  isLoading = false
}) => {
  const [sentiment, setSentiment] = useState<SentimentResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Solicitar análisis inicial
  useEffect(() => {
    if (recordingId && transcription && !isLoading) {
      analyzeSentimentData();
    }
  }, [recordingId, transcription, isLoading]);

  // Función para solicitar análisis
  const analyzeSentimentData = async () => {
    if (!transcription) return;
    
    try {
      setAnalyzing(true);
      setError(null);
      
      const result = await analyzeSentiment(recordingId, transcription);
      
      if (result.error) {
        setError(result.error);
        return;
      }
      
      setSentiment(result.sentiment);
    } catch (error) {
      console.error('Error al analizar sentimiento:', error);
      setError('No se pudo analizar el sentimiento de la transcripción');
      toast({
        title: 'Error',
        description: 'Error al analizar el sentimiento',
        variant: 'destructive',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  // Renderizar estado de carga
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Análisis de Sentimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-20 w-full" />
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
          <CardTitle className="text-sm">Análisis de Sentimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center space-y-3 py-4 text-center">
            <p className="text-sm text-gray-500">{error}</p>
            <Button 
              variant="outline" 
              onClick={analyzeSentimentData}
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
  if (!sentiment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Análisis de Sentimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center space-y-3 py-4 text-center">
            <p className="text-sm text-gray-500">
              {analyzing ? 'Analizando sentimiento...' : 'No hay análisis disponible'}
            </p>
            {analyzing ? (
              <Progress value={45} className="w-full" />
            ) : (
              <Button 
                variant="outline" 
                onClick={analyzeSentimentData}
                size="sm"
              >
                Iniciar Análisis
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Renderizar resultados
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          <span>Análisis de Sentimiento</span>
          {sentiment.label === 'positive' && (
            <Badge className="bg-green-500">Positivo</Badge>
          )}
          {sentiment.label === 'neutral' && (
            <Badge className="bg-blue-500">Neutral</Badge>
          )}
          {sentiment.label === 'negative' && (
            <Badge className="bg-red-500">Negativo</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-gray-50 p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-1 text-xs">
              <Frown className="h-3 w-3 text-red-500" />
              <span>Negativo</span>
            </div>
            <div className="flex items-center space-x-1 text-xs">
              <Smile className="h-3 w-3 text-green-500" />
              <span>Positivo</span>
            </div>
          </div>
          
          <div className="relative h-2.5 w-full rounded-full bg-gray-200">
            {/* Calculamos la posición del indicador (0-100) */}
            <div 
              className="absolute h-4 w-4 rounded-full bg-blue-600 top-1/2 -translate-y-1/2"
              style={{ 
                left: `${((sentiment.score + 1) / 2) * 100}%`,
                transform: 'translateX(-50%) translateY(-50%)'
              }}
            />
          </div>
          
          <div className="mt-3 text-center">
            <p className="text-sm text-gray-600">
              Puntuación: <span className="font-medium">{(sentiment.score * 100).toFixed(1)}%</span>
              <span className="ml-1 text-xs text-gray-500">
                (Confianza: {(sentiment.confidence * 100).toFixed(0)}%)
              </span>
            </p>
          </div>
        </div>

        {sentiment.segments && sentiment.segments.length > 0 && (
          <Tabs defaultValue="positive">
            <TabsList className="w-full">
              <TabsTrigger value="positive" className="flex-1">
                <Smile className="mr-1 h-3 w-3" />
                Positivo
              </TabsTrigger>
              <TabsTrigger value="negative" className="flex-1">
                <Frown className="mr-1 h-3 w-3" />
                Negativo
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="positive" className="mt-2">
              <div className="max-h-40 overflow-y-auto rounded border p-2 text-xs">
                {sentiment.segments
                  .filter(segment => segment.score > 0)
                  .sort((a, b) => b.score - a.score)
                  .slice(0, 5)
                  .map((segment, index) => (
                    <div key={`pos-${index}`} className="mb-1 rounded bg-green-50 p-1">
                      {segment.text}
                    </div>
                  ))}
                {sentiment.segments.filter(segment => segment.score > 0).length === 0 && (
                  <p className="text-center text-gray-500">No se encontraron frases positivas destacadas</p>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="negative" className="mt-2">
              <div className="max-h-40 overflow-y-auto rounded border p-2 text-xs">
                {sentiment.segments
                  .filter(segment => segment.score < 0)
                  .sort((a, b) => a.score - b.score)
                  .slice(0, 5)
                  .map((segment, index) => (
                    <div key={`neg-${index}`} className="mb-1 rounded bg-red-50 p-1">
                      {segment.text}
                    </div>
                  ))}
                {sentiment.segments.filter(segment => segment.score < 0).length === 0 && (
                  <p className="text-center text-gray-500">No se encontraron frases negativas destacadas</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
        
        <div className="flex justify-end pt-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={analyzeSentimentData}
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

export default SentimentAnalysis; 