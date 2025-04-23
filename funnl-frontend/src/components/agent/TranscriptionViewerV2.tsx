import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DownloadIcon, CopyIcon, FileTextIcon, ListIcon, 
  BookmarkIcon, SearchIcon, UserIcon, EditIcon,
  ClockIcon, RefreshCwIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TranscriptionProvider, useTranscriptionContext } from '@/contexts/TranscriptionContext';
import { Input } from '@/components/ui/input';
import TimestampedTranscription from './TimestampedTranscription';
import SpeakerRecognition from './SpeakerRecognition';
import TranscriptionEditor from './TranscriptionEditor';

// Separamos la lógica del componente principal
const TranscriptionViewerContent: React.FC = () => {
  const {
    transcription,
    summary,
    keyPoints,
    segments,
    status,
    progressPercentage,
    isLoading,
    isError,
    errorMessage,
    copyToClipboard,
    downloadTranscription,
    refreshTranscription,
    isEditing,
    startEditing,
  } = useTranscriptionContext();
  
  // Estados locales para la UI
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState<number>(-1);
  const [viewMode, setViewMode] = useState<'plain' | 'timestamps' | 'speakers'>('plain');
  
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
  
  // Navegar entre resultados de búsqueda
  const navigateSearch = (direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;
    
    let newIndex = currentSearchIndex;
    if (direction === 'next') {
      newIndex = (currentSearchIndex + 1) % searchResults.length;
    } else {
      newIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    }
    
    setCurrentSearchIndex(newIndex);
    scrollToSearchResult(newIndex);
  };
  
  // Scroll al resultado seleccionado
  const scrollToSearchResult = (index: number) => {
    if (index < 0 || !transcription) return;
    
    const position = searchResults[index];
    const transcriptionElement = document.querySelector('.transcription-content');
    if (!transcriptionElement) return;
    
    // Estimar posición de scroll
    const textPerLine = 80;
    const lineHeight = 24;
    const lineNumber = Math.floor(position / textPerLine);
    const scrollPosition = lineNumber * lineHeight;
    
    transcriptionElement.scrollTop = scrollPosition;
  };
  
  // Renderizar texto con resultados resaltados
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
  
  // Renderizar contenido según estado
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-60 space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <div className="text-gray-500">Cargando transcripción...</div>
        {progressPercentage > 0 && (
          <div className="w-full max-w-md">
            <Progress value={progressPercentage} className="h-2" />
            <p className="text-xs text-center mt-1 text-gray-500">{progressPercentage}% completado</p>
          </div>
        )}
      </div>
    );
  }
  
  if (isError || !transcription) {
    return (
      <div className="flex flex-col items-center justify-center h-60 space-y-4">
        <div className="text-red-500 text-center">
          <p className="mb-2">{errorMessage || 'No hay transcripción disponible'}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshTranscription()}
          >
            <RefreshCwIcon className="mr-2 h-4 w-4" />
            Intentar de nuevo
          </Button>
        </div>
      </div>
    );
  }
  
  // Estado en proceso
  if (status === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center h-60 space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <div className="text-gray-500">Procesando transcripción...</div>
        {progressPercentage > 0 && (
          <div className="w-full max-w-md">
            <Progress value={progressPercentage} className="h-2" />
            <p className="text-xs text-center mt-1 text-gray-500">{progressPercentage}% completado</p>
          </div>
        )}
      </div>
    );
  }
  
  // Mostrar transcripción completa
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Transcripción</CardTitle>
            <Badge variant={status === 'completed' ? 'default' : 'outline'}>
              {status === 'completed' ? 'Completada' : status}
            </Badge>
          </div>
          
          <div className="flex space-x-2">
            {!isEditing && (
              <>
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
                  onClick={() => downloadTranscription()}
                  title="Descargar transcripción"
                >
                  <DownloadIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startEditing}
                  title="Editar transcripción"
                >
                  <EditIcon className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <TranscriptionEditor />
        ) : (
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
              {keyPoints && keyPoints.length > 0 && (
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
              {/* Vista de transcripción con opciones de visualización */}
              <div className="mb-4 flex flex-wrap gap-2 pb-2 border-b">
                <Button
                  variant={viewMode === 'plain' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('plain')}
                >
                  <FileTextIcon className="h-4 w-4 mr-1" />
                  Texto plano
                </Button>
                <Button
                  variant={viewMode === 'timestamps' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('timestamps')}
                >
                  <ClockIcon className="h-4 w-4 mr-1" />
                  Con marcas de tiempo
                </Button>
                <Button
                  variant={viewMode === 'speakers' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('speakers')}
                >
                  <UserIcon className="h-4 w-4 mr-1" />
                  Por hablantes
                </Button>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-md border border-gray-200 max-h-[400px] overflow-y-auto transcription-content">
                {viewMode === 'plain' && (
                  <div className="whitespace-pre-wrap">{transcription}</div>
                )}
                
                {viewMode === 'timestamps' && (
                  <TimestampedTranscription 
                    segments={segments}
                    fallbackText={transcription} 
                  />
                )}
                
                {viewMode === 'speakers' && (
                  <SpeakerRecognition 
                    segments={segments}
                    fallbackText={transcription}
                  />
                )}
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
            
            {keyPoints && keyPoints.length > 0 && (
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
        )}
      </CardContent>
    </Card>
  );
};

// Componente principal que provee el contexto
interface TranscriptionViewerV2Props {
  recordingId: string;
  name?: string;
}

const TranscriptionViewerV2: React.FC<TranscriptionViewerV2Props> = ({ 
  recordingId,
  name = 'Transcripción'
}) => {
  return (
    <TranscriptionProvider recordingId={recordingId}>
      <TranscriptionViewerContent />
    </TranscriptionProvider>
  );
};

export default TranscriptionViewerV2; 