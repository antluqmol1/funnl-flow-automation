import React, { useEffect } from 'react';
import { getRecordings, Recording } from '@/services/supabaseService';
import RecordingItem from './RecordingItem';
import { useUser } from '@/contexts/UserContext';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const RecordingList: React.FC = () => {
  const { user } = useUser();

  const { 
    data: recordings = [],
    isLoading, 
    error,
    refetch,
    isFetching,
    isError
  } = useQuery<Recording[], Error>({
    queryKey: ['recordings', user?.id],
    queryFn: () => {
        console.log(`[RecordingList] Ejecutando queryFn getRecordings para user: ${user?.id}`);
        return getRecordings();
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  useEffect(() => {
      console.log(`[RecordingList] Estado de la consulta: isLoading=${isLoading}, isFetching=${isFetching}, isError=${isError}, error=${error}, user=${user?.id}`);
      if (!isLoading && !isFetching && !isError) {
          console.log(`[RecordingList] Consulta completada. Número de grabaciones: ${recordings.length}`);
      }
      if (error) {
          console.error(`[RecordingList] Error en la consulta:`, error);
      }
  }, [isLoading, isFetching, isError, error, recordings, user]);

  if (isLoading) {
    console.log('[RecordingList] Renderizando estado de carga...');
    return (
      <div className="text-center py-8">
        <Spinner className="mx-auto mb-4" />
        <p className="text-gray-500">Cargando grabaciones...</p>
      </div>
    );
  }

  if (error) {
    console.log('[RecordingList] Renderizando estado de error...');
    return (
      <Alert variant="destructive" className="mt-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          <p>No se pudieron cargar las grabaciones: {error.message}</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={() => {
                console.log('[RecordingList] Intentando refetch...');
                refetch();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!isLoading && recordings.length === 0) {
    console.log('[RecordingList] Renderizando estado sin grabaciones...');
    return (
      <div className="text-center py-8 border border-gray-200 bg-gray-50 rounded-lg">
        <p className="text-gray-600 mb-2">No tienes grabaciones aún</p>
        <p className="text-gray-500 text-sm">Las grabaciones aparecerán aquí después de guardarlas</p>
      </div>
    );
  }

  console.log(`[RecordingList] Renderizando lista con ${recordings.length} grabaciones.`);
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-gray-500">{recordings.length} grabación(es)</span>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => {
              console.log('[RecordingList] Botón Actualizar presionado, ejecutando refetch...');
              refetch();
          }}
          className="text-xs"
          disabled={isFetching}
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Actualizando...' : 'Actualizar'}
        </Button>
      </div>

      <div className="space-y-4">
        {recordings.map(recording => (
          <RecordingItem key={recording.id} recording={recording} onDelete={() => refetch()} />
        ))}
      </div>
    </div>
  );
};

export default RecordingList;
