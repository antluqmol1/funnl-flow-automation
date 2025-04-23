import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, User, Building2, MapPin, Calendar, CheckSquare } from 'lucide-react';
import { analyzeEntities, Entity } from '@/services/transcriptionAnalytics';
import { useToast } from '@/hooks/useToast';

interface EntityRecognitionProps {
  recordingId: string;
  transcription: string | null;
  isLoading?: boolean;
}

/**
 * Componente para visualizar entidades reconocidas en una transcripción
 */
const EntityRecognition: React.FC<EntityRecognitionProps> = ({
  recordingId,
  transcription,
  isLoading = false
}) => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Solicitar análisis inicial
  useEffect(() => {
    if (recordingId && transcription && !isLoading) {
      analyzeEntitiesData();
    }
  }, [recordingId, transcription, isLoading]);

  // Función para solicitar análisis
  const analyzeEntitiesData = async () => {
    if (!transcription) return;
    
    try {
      setAnalyzing(true);
      setError(null);
      
      const result = await analyzeEntities(recordingId, transcription);
      
      if (result.error) {
        setError(result.error);
        return;
      }
      
      setEntities(result.entities);
    } catch (error) {
      console.error('Error al analizar entidades:', error);
      setError('No se pudieron extraer las entidades del texto');
      toast({
        title: 'Error',
        description: 'Error al reconocer entidades',
        variant: 'destructive',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  // Filtrar entidades por tipo
  const getEntitiesByType = (type: Entity['type']) => {
    return entities.filter(entity => entity.type === type);
  };

  // Renderizar icono según tipo de entidad
  const getEntityIcon = (type: Entity['type']) => {
    switch (type) {
      case 'person': return <User className="h-3 w-3" />;
      case 'organization': return <Building2 className="h-3 w-3" />;
      case 'location': return <MapPin className="h-3 w-3" />;
      case 'date': return <Calendar className="h-3 w-3" />;
      case 'task': return <CheckSquare className="h-3 w-3" />;
      default: return null;
    }
  };

  // Obtener color según tipo de entidad
  const getEntityColor = (type: Entity['type']) => {
    switch (type) {
      case 'person': return 'bg-blue-100 text-blue-800';
      case 'organization': return 'bg-purple-100 text-purple-800';
      case 'location': return 'bg-green-100 text-green-800';
      case 'date': return 'bg-amber-100 text-amber-800';
      case 'task': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Renderizar estado de carga
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Entidades Reconocidas</CardTitle>
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
          <CardTitle className="text-sm">Entidades Reconocidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center space-y-3 py-4 text-center">
            <p className="text-sm text-gray-500">{error}</p>
            <Button 
              variant="outline" 
              onClick={analyzeEntitiesData}
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
  if (!entities || entities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Entidades Reconocidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center space-y-3 py-4 text-center">
            <p className="text-sm text-gray-500">
              {analyzing ? 'Analizando entidades...' : 'No se han identificado entidades'}
            </p>
            {!analyzing && (
              <Button 
                variant="outline" 
                onClick={analyzeEntitiesData}
                size="sm"
              >
                Identificar Entidades
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Contar entidades por tipo
  const counts = {
    people: getEntitiesByType('person').length,
    organizations: getEntitiesByType('organization').length,
    locations: getEntitiesByType('location').length,
    dates: getEntitiesByType('date').length,
    tasks: getEntitiesByType('task').length,
    other: getEntitiesByType('other').length
  };

  // Renderizar resultados
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          <span>Entidades Reconocidas</span>
          <Badge variant="outline" className="font-normal">
            {entities.length} entidades
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {counts.people > 0 && (
            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">
              <User className="mr-1 h-3 w-3" />
              {counts.people} personas
            </Badge>
          )}
          {counts.organizations > 0 && (
            <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200">
              <Building2 className="mr-1 h-3 w-3" />
              {counts.organizations} organizaciones
            </Badge>
          )}
          {counts.locations > 0 && (
            <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
              <MapPin className="mr-1 h-3 w-3" />
              {counts.locations} lugares
            </Badge>
          )}
          {counts.dates > 0 && (
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">
              <Calendar className="mr-1 h-3 w-3" />
              {counts.dates} fechas
            </Badge>
          )}
          {counts.tasks > 0 && (
            <Badge className="bg-red-100 text-red-800 hover:bg-red-200">
              <CheckSquare className="mr-1 h-3 w-3" />
              {counts.tasks} tareas
            </Badge>
          )}
        </div>

        <Tabs defaultValue="personas">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="personas">
              <User className="mr-1 h-3 w-3" />
              Personas
            </TabsTrigger>
            <TabsTrigger value="organizaciones">
              <Building2 className="mr-1 h-3 w-3" />
              Organizaciones
            </TabsTrigger>
            <TabsTrigger value="otros">Otros</TabsTrigger>
          </TabsList>
          
          <TabsContent value="personas" className="mt-2">
            <div className="rounded-md border p-2">
              <div className="flex flex-wrap gap-1">
                {getEntitiesByType('person').length > 0 ? (
                  getEntitiesByType('person').map((entity, index) => (
                    <Badge
                      key={index}
                      className="bg-blue-50 text-blue-700 hover:bg-blue-100"
                    >
                      {entity.text}
                    </Badge>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 py-2 text-center w-full">
                    No se han detectado personas
                  </p>
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="organizaciones" className="mt-2">
            <div className="rounded-md border p-2">
              <div className="flex flex-wrap gap-1">
                {getEntitiesByType('organization').length > 0 ? (
                  getEntitiesByType('organization').map((entity, index) => (
                    <Badge
                      key={index}
                      className="bg-purple-50 text-purple-700 hover:bg-purple-100"
                    >
                      {entity.text}
                    </Badge>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 py-2 text-center w-full">
                    No se han detectado organizaciones
                  </p>
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="otros" className="mt-2">
            <div className="rounded-md border p-2">
              <div className="flex flex-wrap gap-1">
                {[...getEntitiesByType('location'), ...getEntitiesByType('date'), ...getEntitiesByType('other')].length > 0 ? (
                  [...getEntitiesByType('location'), ...getEntitiesByType('date'), ...getEntitiesByType('other')].map((entity, index) => (
                    <Badge
                      key={index}
                      className={getEntityColor(entity.type)}
                    >
                      {getEntityIcon(entity.type)}
                      {entity.text}
                    </Badge>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 py-2 text-center w-full">
                    No se han detectado otras entidades
                  </p>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="flex justify-end pt-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={analyzeEntitiesData}
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

export default EntityRecognition; 