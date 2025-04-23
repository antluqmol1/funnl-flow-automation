import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DownloadIcon, CopyIcon, FileTextIcon, ListIcon, BookmarkIcon, SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/useToast';
import { useTranscription } from '@/hooks/useTranscription';

interface TranscriptionViewerProps {
  recordingId: string;
  name?: string;
  allowEdit?: boolean;
}

const TranscriptionViewer: React.FC<TranscriptionViewerProps> = ({ 
  recordingId,
  name = 'Transcripción',
  allowEdit = false
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState<number>(-1);
  const { toast } = useToast();
  
  // Usar el hook personalizado en lugar de gestión manual de estado
  const { 
    data,
    isLoading, 
    isError,
    error,
    refetch
  } = useTranscription(recordingId, {
    polling: true,
    pollingInterval: 3000
  });
  
  // Extraer datos para facilitar el acceso
  const transcription = data?.transcription || null;
  const summary = data?.summary || null;
  const keyPoints = data?.key_points || null;

  // Actualizar búsqueda cuando cambia el término o la transcripción
  React.useEffect(() => {
    if (!searchTerm.trim() || !transcription) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      return;
    }
    
    const results: number[] = [];
    const searchRegex = new RegExp(searchTerm, 'gi');
    let match;
    
    while ((match = searchRegex.exec(transcription)) !== null) {
      results.push(match.index);
    }
    
    setSearchResults(results);
    setCurrentSearchIndex(results.length > 0 ? 0 : -1);
  }, [searchTerm, transcription]);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: 'Copiado al portapapeles',
        description: `${type} copiado correctamente`,
        variant: 'default',
      });
    }).catch(err => {
      console.error('Error al copiar:', err);
      toast({
        title: 'Error',
        description: 'No se pudo copiar al portapapeles',
        variant: 'destructive',
      });
    });
  };

  const downloadText = (text: string, filename: string) => {
    const element = document.createElement('a');
    const file = new Blob([text], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const navigateSearch = (direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;
    
    let newIndex = currentSearchIndex;
    if (direction === 'next') {
      newIndex = (currentSearchIndex + 1) % searchResults.length;
    } else {
      newIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    }
    
    setCurrentSearchIndex(newIndex);
    
    // Scroll al resultado seleccionado
    scrollToSearchResult(newIndex);
  };
  
  const scrollToSearchResult = (index: number) => {
    if (index < 0 || !transcription) return;
    
    const position = searchResults[index];
    const transcriptionElement = document.querySelector('.transcription-content');
    if (!transcriptionElement) return;
    
    // Calcular posición aproximada
    const textPerLine = 80; // Estimación de caracteres por línea
    const lineHeight = 24; // Altura estimada en píxeles por línea
    
    const lineNumber = Math.floor(position / textPerLine);
    const scrollPosition = lineNumber * lineHeight;
    
    transcriptionElement.scrollTop = scrollPosition;
  };

  // Renderizar búsqueda resaltada
  const renderHighlightedText = () => {
    if (!transcription || !searchTerm.trim()) {
      return <div className="whitespace-pre-wrap">{transcription}</div>;
    }
    
    const parts = [];
    let lastIndex = 0;
    
    for (let i = 0; i < searchResults.length; i++) {
      const index = searchResults[i];
      // Texto antes del match
      parts.push(transcription.slice(lastIndex, index));
      
      // Texto del match (resaltado)
      const isCurrentMatch = i === currentSearchIndex;
      parts.push(
        <mark 
          key={`match-${i}`}
          className={isCurrentMatch ? "bg-yellow-300" : "bg-yellow-100"}
        >
          {transcription.slice(index, index + searchTerm.length)}
        </mark>
      );
      
      lastIndex = index + searchTerm.length;
    }
    
    // Resto del texto después del último match
    parts.push(transcription.slice(lastIndex));
    
    return <div className="whitespace-pre-wrap">{parts}</div>;
  };

  // Mostrar estado de carga
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg">{name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40">
            <div className="animate-pulse text-gray-400">
              Cargando datos de transcripción...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Mostrar estado de error
  if (isError || !transcription) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg">{name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40 text-center">
            <div className="text-red-500">
              {error || 'No hay transcripción disponible'}
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="mt-3 block mx-auto"
              >
                Intentar de nuevo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Mostrar transcripción completa
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg flex justify-between items-center">
          {name}
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(transcription, 'Transcripción')}
              title="Copiar transcripción"
            >
              <CopyIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadText(transcription, `transcripcion_${recordingId}.txt`)}
              title="Descargar transcripción"
            >
              <DownloadIcon className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="transcripcion">
          <TabsList className="mb-4">
            <TabsTrigger value="transcripcion">
              <FileTextIcon className="h-4 w-4 mr-2" />
              Transcripción
            </TabsTrigger>
            {summary && (
              <TabsTrigger value="resumen">
                <BookmarkIcon className="h-4 w-4 mr-2" />
                Resumen
              </TabsTrigger>
            )}
            {keyPoints && Array.isArray(keyPoints) && keyPoints.length > 0 && (
              <TabsTrigger value="puntos-clave">
                <ListIcon className="h-4 w-4 mr-2" />
                Puntos Clave
              </TabsTrigger>
            )}
            <TabsTrigger value="buscar">
              <SearchIcon className="h-4 w-4 mr-2" />
              Buscar
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="transcripcion" className="mt-0">
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200 max-h-[400px] overflow-y-auto whitespace-pre-wrap transcription-content">
              {transcription}
            </div>
          </TabsContent>
          
          {summary && (
            <TabsContent value="resumen" className="mt-0">
              <div className="bg-gray-50 p-4 rounded-md border border-gray-200 max-h-[400px] overflow-y-auto">
                <h3 className="font-medium mb-2">Resumen de la reunión</h3>
                <p className="whitespace-pre-wrap">{summary}</p>
                
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(summary, 'Resumen')}
                    className="mr-2"
                  >
                    <CopyIcon className="h-3 w-3 mr-1" />
                    Copiar
                  </Button>
                </div>
              </div>
            </TabsContent>
          )}
          
          {keyPoints && Array.isArray(keyPoints) && keyPoints.length > 0 && (
            <TabsContent value="puntos-clave" className="mt-0">
              <div className="bg-gray-50 p-4 rounded-md border border-gray-200 max-h-[400px] overflow-y-auto">
                <h3 className="font-medium mb-2">Puntos Clave</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {keyPoints.map((point, index) => (
                    <li key={index} className="text-sm">{point}</li>
                  ))}
                </ul>
                
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(keyPoints.join('\n- '), 'Puntos clave')}
                    className="mr-2"
                  >
                    <CopyIcon className="h-3 w-3 mr-1" />
                    Copiar
                  </Button>
                </div>
              </div>
            </TabsContent>
          )}
          
          <TabsContent value="buscar" className="mt-0">
            <div className="mb-4 flex items-center gap-2">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar en la transcripción..."
                  className="pl-10"
                />
              </div>
              
              {searchResults.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    {currentSearchIndex + 1} de {searchResults.length}
                  </span>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => navigateSearch('prev')}
                    disabled={searchResults.length === 0}
                  >
                    Anterior
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => navigateSearch('next')}
                    disabled={searchResults.length === 0}
                  >
                    Siguiente
                  </Button>
                </div>
              )}
            </div>
            
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200 max-h-[400px] overflow-y-auto transcription-content">
              {renderHighlightedText()}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default TranscriptionViewer; 