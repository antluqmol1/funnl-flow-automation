import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import PageHeader from '@/components/layout/PageHeader';
import BottomNavbar from '@/components/layout/BottomNavbar';
import NextBestAction from '@/components/activities/NextBestAction';
import TaskList from '@/components/activities/TaskList';
import TaskForm from '@/components/activities/TaskForm';
import { useToast } from '@/components/ui/use-toast';
import { useSyncAllContactsMutation, useSyncAllDealsMutation } from '@/hooks/useHubspotSync';
import HubspotConfig from '@/components/automations/HubspotConfig';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Globe2, ArrowRight, Calendar, BarChart2, Plus } from 'lucide-react';
import { useTasksQuery } from '@/hooks/useTasks';
import { format, isToday, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

// Función para obtener las tareas de hoy
const getTodayTasks = (tasks: any[]) => {
  return tasks.filter(task => {
    if (!task.time || task.status === 'completed') return false;
    try {
      return isToday(parseISO(task.time));
    } catch (e) {
      return false;
    }
  });
};

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const syncContactsMutation = useSyncAllContactsMutation();
  const syncDealsMutation = useSyncAllDealsMutation();
  const [isHubspotConnected, setIsHubspotConnected] = useState(false);
  const { data: tasks = [] } = useTasksQuery();
  const todayTasks = getTodayTasks(tasks);
  const [isNewTaskDialogOpen, setIsNewTaskDialogOpen] = useState(false);

  // Función para manejar el refresh de datos de HubSpot
  const handleHubspotRefresh = () => {
    toast({
      title: "Sincronizando",
      description: "Actualizando datos de HubSpot...",
      duration: 3000,
    });
    syncContactsMutation.mutate();
    syncDealsMutation.mutate();
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

      syncContactsMutation.mutate();
      syncDealsMutation.mutate(); 
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
  }, [searchParams, setSearchParams, toast, navigate, syncContactsMutation, syncDealsMutation]);

  useEffect(() => {
    const contactsSuccess = syncContactsMutation.isSuccess;
    const dealsSuccess = syncDealsMutation.isSuccess;
    const contactsError = syncContactsMutation.isError;
    const dealsError = syncDealsMutation.isError;

    if (contactsSuccess && dealsSuccess) {
      toast({
        title: "Sincronización Completa",
        description: "Los datos iniciales de HubSpot (contactos y deals) han sido vinculados.",
      });
    } else if (contactsSuccess && !dealsSuccess && !syncDealsMutation.isPending) {
        toast({
          title: "Sincronización Parcial",
          description: "Contactos sincronizados. Procesando deals...",
        });
    } else if (!contactsSuccess && dealsSuccess && !syncContactsMutation.isPending) {
         toast({
          title: "Sincronización Parcial",
          description: "Deals sincronizados. Procesando contactos...",
        });
    }
    
    if (contactsError || dealsError) {
      const errorMsgContacts = contactsError ? (syncContactsMutation.error?.message || "Error sincronizando contactos.") : "";
      const errorMsgDeals = dealsError ? (syncDealsMutation.error?.message || "Error sincronizando deals.") : "";
      const combinedErrorMsg = [errorMsgContacts, errorMsgDeals].filter(Boolean).join(' ');
      
      toast({
        variant: "destructive",
        title: "Error de Sincronización",
        description: combinedErrorMsg || "No se pudo completar la sincronización inicial con HubSpot.",
      });
    }
  }, [
      syncContactsMutation.isSuccess, syncContactsMutation.isError, syncContactsMutation.error, syncContactsMutation.isPending,
      syncDealsMutation.isSuccess, syncDealsMutation.isError, syncDealsMutation.error, syncDealsMutation.isPending, 
      toast
  ]);

  // Formatear fecha actual
  const todayFormatted = format(new Date(), "EEEE, d 'de' MMMM", { locale: es });

  // Diseño móvil (solo visible en pantallas pequeñas)
  const mobileLayout = (
    <div className="mobile-container lg:hidden">
      <div className="p-4">
        <NextBestAction />
        
        {!isHubspotConnected && (
          <Card className="mt-4 mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
            <CardContent className="p-4">
              <div className="flex flex-col items-center text-center mb-2">
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
        
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Tareas de hoy</h2>
          <Badge variant="outline">{todayTasks.length}</Badge>
        </div>
        
        <TaskList showFilters={false} filteredTasks={todayTasks} />
        
        <div className="mt-4 flex gap-4">
          <Button variant="outline" className="flex-1" onClick={() => setIsNewTaskDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nueva tarea
          </Button>
          <Link to="/dashboard" className="flex-1">
            <Button variant="outline" className="w-full">
              Ver dashboard
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );

  // Diseño desktop (solo visible en pantallas medianas y grandes)
  const desktopLayout = (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 hidden lg:block">
      <div className="grid grid-cols-1 gap-6">
        {/* Columna principal */}
        <div className="space-y-6">
          {/* Recomendaciones IA (ahora arriba) */}
          <NextBestAction />
          
          {/* Tareas del día (más destacadas) */}
          <Card className="bg-white shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-medium flex items-center">
                    <Calendar className="h-5 w-5 mr-2 text-funnl-primary" />
                    Tareas de hoy, {todayFormatted}
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    {todayTasks.length} {todayTasks.length === 1 ? 'tarea' : 'tareas'} programadas
                  </p>
                </div>
                <div className="flex gap-2 items-center">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsNewTaskDialogOpen(true)}
                    className="flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Nueva tarea
                  </Button>
                  <Badge variant="outline" className="text-base px-3 py-1">{todayTasks.length}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <TaskList showFilters={false} filteredTasks={todayTasks} />
              
              <div className="mt-6 flex justify-end">
                <Link to="/dashboard">
                  <Button variant="default" className="flex items-center gap-2">
                    <BarChart2 className="h-4 w-4" />
                    Ver dashboard completo
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
          
          {/* Hubspot Integration Card ahora abajo */}
          {!isHubspotConnected && (
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
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
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader 
        title="Daily" 
        subtitle="Gestiona tus tareas y citas"
      />
      
      {(syncContactsMutation.isPending || syncDealsMutation.isPending) && (
        <div className="p-4 text-center text-sm text-gray-600 bg-blue-50 border-b border-blue-200">
          Sincronizando datos iniciales con HubSpot...
        </div>
      )}

      {/* Renderizamos uno u otro layout según el tamaño de pantalla */}
      {mobileLayout}
      {desktopLayout}
      
      {/* Botón flotante para añadir tareas (visible en ambos layouts) */}
      <div className="fixed bottom-20 right-4 z-40 lg:bottom-8">
        <Button 
          onClick={() => setIsNewTaskDialogOpen(true)}
          size="lg"
          className="rounded-full h-14 w-14 shadow-lg"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
      
      {/* Diálogo para crear nueva tarea */}
      <Dialog open={isNewTaskDialogOpen} onOpenChange={setIsNewTaskDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva tarea</DialogTitle>
          </DialogHeader>
          <TaskForm onComplete={() => setIsNewTaskDialogOpen(false)} />
        </DialogContent>
      </Dialog>
      
      <BottomNavbar />
    </div>
  );
};

export default Index;
