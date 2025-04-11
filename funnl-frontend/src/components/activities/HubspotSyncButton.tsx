import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { AlertTriangle, ArrowUpDown, Check, Loader2 } from 'lucide-react';
import { useSyncTaskWithHubspotMutation } from '@/hooks/useTasks';
import { type Task } from '@/services/supabaseService';

interface HubspotSyncButtonProps {
  task: Task;
  onSyncComplete?: (task: Task) => void;
}

const HubspotSyncButton: React.FC<HubspotSyncButtonProps> = ({ task, onSyncComplete }) => {
  const { toast } = useToast();
  const syncMutation = useSyncTaskWithHubspotMutation();
  const [hubspotApiUnavailable, setHubspotApiUnavailable] = useState(false);

  // Utilizamos un botón diferente según el estado de sincronización
  const getButtonContent = () => {
    // Si la API de HubSpot no está disponible, mostramos un mensaje
    if (hubspotApiUnavailable) {
      return (
        <Button
          variant="outline"
          size="sm"
          className="text-amber-500 border-amber-300 bg-amber-50"
          onClick={() => {
            toast({
              title: "Configuración requerida",
              description: "No hay conexión con HubSpot. Configura la conexión en la sección de Ajustes.",
              variant: "default",
            });
          }}
        >
          <AlertTriangle className="h-4 w-4 mr-1" />
          HubSpot no configurado
        </Button>
      );
    }

    // Si estamos sincronizando, mostramos un spinner
    if (syncMutation.isPending) {
      return (
        <Button variant="outline" size="sm" disabled>
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          Sincronizando...
        </Button>
      );
    }

    // Si hay un error de sincronización
    if (task.sync_status === 'error') {
      return (
        <Button 
          variant="outline" 
          size="sm" 
          className="text-red-500 border-red-300"
          onClick={handleSync}
        >
          <AlertTriangle className="h-4 w-4 mr-1" />
          Error - Reintentar
        </Button>
      );
    }

    // Si está sincronizado
    if (task.sync_status === 'synced') {
      return (
        <Button 
          variant="outline" 
          size="sm" 
          className="text-green-500 border-green-300"
          onClick={handleSync}
        >
          <Check className="h-4 w-4 mr-1" />
          Sincronizado
        </Button>
      );
    }

    // Estado por defecto
    return (
      <Button 
        variant="outline" 
        size="sm"
        onClick={handleSync}
      >
        <ArrowUpDown className="h-4 w-4 mr-1" />
        Sincronizar
      </Button>
    );
  };

  const handleSync = async () => {
    if (!task.hubspot_id || !task.hubspot_type) {
      toast({
        title: "No se puede sincronizar",
        description: "Esta tarea no está vinculada con ningún objeto de HubSpot.",
        variant: "destructive",
      });
      return;
    }

    try {
      const syncedTask = await syncMutation.mutateAsync({
        taskId: task.id,
        hubspotId: task.hubspot_id,
        hubspotType: task.hubspot_type,
      });

      if (onSyncComplete) {
        onSyncComplete(syncedTask);
      }

      toast({
        title: "Sincronización exitosa",
        description: "La tarea ha sido sincronizada con HubSpot correctamente.",
      });
    } catch (error: any) {
      console.error('Error sincronizando tarea:', error);
      
      // Verificar si el error es por falta de configuración de HubSpot
      if (error.message?.includes('API key') || error.message?.includes('no está configurado')) {
        setHubspotApiUnavailable(true);
        toast({
          title: "Configuración requerida",
          description: "No hay conexión con HubSpot. Configura la conexión en la sección de Ajustes.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error de sincronización",
          description: error.message || "No se pudo sincronizar la tarea con HubSpot.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div>
      {getButtonContent()}
    </div>
  );
};

export default HubspotSyncButton; 