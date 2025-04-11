import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import PageHeader from '@/components/layout/PageHeader';
import BottomNavbar from '@/components/layout/BottomNavbar';
import NextBestAction from '@/components/activities/NextBestAction';
import TaskList from '@/components/activities/TaskList';
import { useToast } from '@/components/ui/use-toast';
import { useSyncAllWithHubspotMutation } from '@/hooks/useHubspotSync';
import HubspotConfig from '@/components/automations/HubspotConfig';
import { Card, CardContent } from '@/components/ui/card';
import { Globe2 } from 'lucide-react';

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const syncAllMutation = useSyncAllWithHubspotMutation();
  const [isHubspotConnected, setIsHubspotConnected] = useState(false);

  // Función para manejar el refresh de datos de HubSpot
  const handleHubspotRefresh = () => {
    toast({
      title: "Sincronizando",
      description: "Actualizando datos de HubSpot...",
      duration: 3000,
    });
    syncAllMutation.mutate();
  };

  useEffect(() => {
    const hubspotConnected = searchParams.get('hubspot_connected');
    const hubspotError = searchParams.get('hubspot_error');

    if (hubspotConnected === 'true') {
      toast({
        title: "HubSpot Conectado",
        description: "Tu cuenta de HubSpot se ha conectado correctamente. Iniciando sincronización...",
        duration: 5000,
      });
      searchParams.delete('hubspot_connected');
      setSearchParams(searchParams, { replace: true });

      syncAllMutation.mutate(); 
    }

    if (hubspotError) {
      toast({
        variant: "destructive",
        title: "Error de conexión con HubSpot",
        description: `Hubo un problema durante la conexión: ${hubspotError}. Inténtalo de nuevo desde Ajustes.`,
        duration: 7000,
      });
      searchParams.delete('hubspot_error');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, toast, navigate, syncAllMutation]);

  useEffect(() => {
    if (syncAllMutation.isSuccess) {
      toast({
        title: "Sincronización Completa",
        description: "Los datos iniciales de HubSpot han sido vinculados.",
      });
    }
    if (syncAllMutation.isError) {
      toast({
        variant: "destructive",
        title: "Error de Sincronización",
        description: syncAllMutation.error?.message || "No se pudo completar la sincronización inicial con HubSpot.",
      });
    }
  }, [syncAllMutation.isSuccess, syncAllMutation.isError, syncAllMutation.error, toast]);

  useEffect(() => {
    // Comprobamos los diferentes parámetros que pueden llegar desde el backend o frontend
    const hubspotConnected = searchParams.get('hubspot_connected');
    const hubspotSuccess = searchParams.get('hubspot'); // Nuevo parámetro del backend
    const hubspotError = searchParams.get('hubspot_error');
    const hubspotErrorMsg = searchParams.get('message'); // Parámetro de error adicional

    // Si hubspot=success está presente, manejamos la conexión exitosa
    if (hubspotSuccess === 'success' || hubspotConnected === 'true') {
      toast({
        title: "HubSpot Conectado",
        description: "Tu cuenta de HubSpot se ha conectado correctamente. Iniciando sincronización...",
        duration: 5000,
      });
      
      // Limpiamos los parámetros de URL
      searchParams.delete('hubspot');
      searchParams.delete('hubspot_connected');
      setSearchParams(searchParams, { replace: true });

      // Iniciamos la sincronización
      syncAllMutation.mutate(); 
    }

    // Manejamos errores, tanto del formato antiguo como del nuevo
    if (hubspotError || hubspotSuccess === 'error') {
      const errorMessage = hubspotErrorMsg || hubspotError || "Error desconocido";
      
      toast({
        variant: "destructive",
        title: "Error de conexión con HubSpot",
        description: `Hubo un problema durante la conexión: ${errorMessage}. Inténtalo de nuevo desde Ajustes.`,
        duration: 7000,
      });
      
      // Limpiamos los parámetros de error
      searchParams.delete('hubspot');
      searchParams.delete('hubspot_error');
      searchParams.delete('message');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, toast, navigate, syncAllMutation]);

  return (
    <div className="mobile-container">
      <PageHeader 
        title="Daily Activities" 
        subtitle="Manage your tasks and appointments"
      />
      
      {syncAllMutation.isPending && (
        <div className="p-4 text-center text-sm text-gray-600 bg-blue-50 border-b border-blue-200">
          Sincronizando datos iniciales con HubSpot...
        </div>
      )}

      <div className="p-4">
        <NextBestAction />
        
        {/* Hubspot Integration Card */}
        {!isHubspotConnected && (
          <Card className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
            <CardContent className="p-4">
              <div className="flex flex-col items-center text-center mb-3">
                <div className="bg-blue-100 p-2 rounded-full mb-2">
                  <Globe2 className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-medium text-blue-800">Conecta con HubSpot</h3>
                <p className="text-sm text-blue-600 mb-3">Sincroniza tus contactos y tareas</p>
                
                <HubspotConfig 
                  compact={true} 
                  onConfigured={setIsHubspotConnected}
                  onRefresh={handleHubspotRefresh}
                />
              </div>
            </CardContent>
          </Card>
        )}
        
        <h2 className="section-title">Today's Tasks</h2>
        <TaskList />
      </div>
      
      <BottomNavbar />
    </div>
  );
};

export default Index;
