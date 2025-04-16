import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/components/ui/use-toast";
import PageHeader from '@/components/layout/PageHeader';
import BottomNavbar from '@/components/layout/BottomNavbar';
import FunnelStage from '@/components/funnel/FunnelStage';
import CreateContactDialog from '@/components/pipeline/CreateContactDialog';
import { getFunnelStagesWithContacts, getPipelineStages, syncPipelineContactsWithFunnel } from '@/services/supabaseService';
import { Loader2, Search, PlusCircle, BarChart3, RefreshCw, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Funnel = () => {
  // Estado
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedView, setSelectedView] = useState<'list' | 'funnel'>('funnel');
  const [funnelStages, setFunnelStages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingContacts, setSyncingContacts] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<any[]>([]);
  const [statsOpen, setStatsOpen] = useState(false);
  const [createContactOpen, setCreateContactOpen] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const filters = [
    { id: 'all', name: 'Todos' },
    { id: 'subscriber', name: 'Suscriptor' },
    { id: 'lead', name: 'Lead' },
    { id: 'mql', name: 'MQL' },
    { id: 'sql', name: 'SQL' },
    { id: 'opportunity', name: 'Oportunidad' },
    { id: 'customer', name: 'Cliente' },
    { id: 'evangelist', name: 'Evangelista' },
    { id: 'otros', name: 'Otros' }
  ];

  // Cargar datos del funnel
  useEffect(() => {
    loadFunnelData();
    loadPipelineStages();
  }, []);

  // Función para cargar los datos del funnel
  const loadFunnelData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getFunnelStagesWithContacts();
      setFunnelStages(data);
    } catch (error) {
      console.error('Error al cargar las etapas del embudo:', error);
      setError('No se pudieron cargar los datos del embudo');
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos del embudo. Por favor, inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Función para cargar las etapas del pipeline principal
  const loadPipelineStages = async () => {
    try {
      // Necesitaríamos el ID del pipeline principal, aquí usamos uno fijo
      // En una implementación real, debería obtenerse dinámicamente
      const PIPELINE_ID = 'd5342cef-a927-435a-b30d-4958e9547b6d';
      const stages = await getPipelineStages(PIPELINE_ID);
      setPipelineStages(stages);
    } catch (error) {
      console.error('Error al cargar las etapas del pipeline:', error);
    }
  };
  
  // Función de refresco de datos
  const refreshData = async () => {
    try {
      setRefreshing(true);
      await loadFunnelData();
      toast({
        title: "Datos actualizados",
        description: "El embudo se ha actualizado correctamente",
      });
    } catch (error) {
      console.error('Error al actualizar el embudo:', error);
      toast({
        title: "Error",
        description: "No se pudieron actualizar los datos. Por favor, inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Función para sincronizar contactos entre pipeline y funnel
  const syncContacts = async () => {
    try {
      setSyncingContacts(true);
      const result = await syncPipelineContactsWithFunnel();
      
      if (result.success) {
        toast({
          title: "Sincronización completada",
          description: result.message,
        });
        // Recargar datos después de sincronizar
        await loadFunnelData();
      } else {
        toast({
          title: "Error en la sincronización",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error en la sincronización:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error durante la sincronización. Por favor, inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setSyncingContacts(false);
    }
  };

  // Manejar apertura del diálogo para añadir contacto
  const handleAddContact = (stageId: number) => {
    setSelectedStageId(stageId);
    setCreateContactOpen(true);
  };

  // Cuando se crea un contacto
  const handleContactCreated = () => {
    toast({
      title: "Contacto creado",
      description: "El contacto se ha añadido al embudo correctamente",
    });
    // Recargar los datos para mostrar el nuevo contacto
    loadFunnelData();
  };
  
  // Redirigir al Dashboard del Pipeline
  const goToPipeline = () => {
    navigate('/pipeline');
  };

  // Estadísticas generales para el funnel
  const stats = useMemo(() => {
    if (!funnelStages || funnelStages.length === 0) return null;
    
    const totalContacts = funnelStages.reduce((sum, stage) => sum + stage.contacts.length, 0);
    const totalValue = funnelStages.reduce((sum, stage) => {
      return sum + stage.contacts.reduce((stageSum, contact) => stageSum + (contact.value || 0), 0);
    }, 0);
    
    const conversionRates = funnelStages.map((stage, index, stages) => {
      if (index === 0 || stages[index - 1].contacts.length === 0) return 100;
      return Math.round((stage.contacts.length / stages[index - 1].contacts.length) * 100);
    });
    
    return {
      totalContacts,
      totalValue,
      conversionRates,
      stageDistribution: funnelStages.map(stage => ({
        name: stage.name,
        count: stage.contacts.length,
        percentage: totalContacts ? Math.round((stage.contacts.length / totalContacts) * 100) : 0
      }))
    };
  }, [funnelStages]);

  // Filtrar etapas basadas en la búsqueda y el filtro seleccionado
  const filteredStages = useMemo(() => {
    if (!funnelStages) return [];
    
    return funnelStages.map(stage => {
      const filteredContacts = stage.contacts.filter((contact: any) => {
        const matchesSearch = 
          !searchQuery || 
          contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
          contact.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          contact.email?.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesFilter = 
          selectedFilter === 'all' || 
          contact.status === selectedFilter;
        
        return matchesSearch && matchesFilter;
      });
      
      return {
        ...stage,
        contacts: filteredContacts
      };
    });
  }, [funnelStages, searchQuery, selectedFilter]);

  // Solo muestra las etapas relevantes cuando hay un filtro seleccionado
  const visibleStages = useMemo(() => {
    // Si el filtro es "all", mostramos todas las etapas, incluso las vacías
    if (selectedFilter === 'all') {
      return filteredStages;
    }
    
    // Si hay un filtro específico, solo mostramos las etapas que tienen contactos
    return filteredStages.filter(stage => stage.contacts.length > 0);
  }, [filteredStages, selectedFilter]);
  
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader 
        title="Embudo de Clientes" 
        subtitle="Visualiza y gestiona tu proceso de ventas"
      >
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="icon"
            className="h-8 w-8"
            onClick={() => setStatsOpen(true)}
            title="Ver estadísticas"
          >
            <BarChart3 className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            className="h-8 w-8"
            onClick={refreshData}
            disabled={refreshing}
            title="Actualizar datos"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button 
            variant="outline"
            size="sm"
            onClick={goToPipeline}
            className="h-8"
            title="Ver Pipeline completo"
          >
            <LayoutDashboard className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Pipeline</span>
          </Button>
          <Button 
            size="sm"
            onClick={() => handleAddContact(2)}
            className="h-8"
          >
            <PlusCircle className="h-4 w-4 mr-1" />
            Nuevo
          </Button>
        </div>
      </PageHeader>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Barra de Búsqueda y Filtros */}
        <div className="mb-4">
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Buscar contactos..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex justify-between items-center mb-2">
            <div className="flex overflow-x-auto gap-2 py-2 no-scrollbar">
              {filters.map(filter => (
                <button
                  key={filter.id}
                  className={`px-3 py-1 text-sm rounded-full whitespace-nowrap ${
                    selectedFilter === filter.id 
                      ? 'bg-funnl-primary text-white' 
                      : 'bg-gray-100 text-gray-700'
                  }`}
                  onClick={() => setSelectedFilter(filter.id)}
                >
                  {filter.name}
                </button>
              ))}
            </div>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={syncContacts}
              disabled={syncingContacts}
              title="Sincronizar contactos entre Pipeline y Funnel"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${syncingContacts ? 'animate-spin' : ''}`} />
              <span className="text-xs">Sincronizar</span>
            </Button>
          </div>
        </div>
        
        {/* Muestra el funnel */}
        {loading ? (
          <div className="py-10 flex flex-col items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-funnl-primary mb-2" />
            <p className="text-sm text-gray-500">Cargando datos del embudo...</p>
          </div>
        ) : error ? (
          <div className="py-10 text-center">
            <p className="text-red-500 mb-2">{error}</p>
            <Button variant="outline" onClick={loadFunnelData}>
              Reintentar
            </Button>
          </div>
        ) : (
          <>
            {visibleStages.some(stage => stage.contacts.length > 0) ? (
              <div className="space-y-4">
                {visibleStages.map(stage => (
                  <FunnelStage 
                    key={stage.id} 
                    stage={stage} 
                    onAddContact={handleAddContact}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center p-8 text-gray-500">
                No se encontraron contactos que coincidan con tu búsqueda.
              </div>
            )}
          </>
        )}
      </div>

      {/* Diálogo de estadísticas */}
      <Dialog open={statsOpen} onOpenChange={setStatsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Estadísticas del Embudo</DialogTitle>
            <DialogDescription>
              Análisis y métricas de tu embudo de ventas
            </DialogDescription>
          </DialogHeader>
          
          {stats && (
            <Tabs defaultValue="general">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="conversion">Conversión</TabsTrigger>
              </TabsList>
              
              <TabsContent value="general" className="mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">Contactos</CardTitle>
                    </CardHeader>
                    <CardContent className="py-2 px-4">
                      <p className="text-2xl font-bold">{stats.totalContacts}</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">Valor Total</CardTitle>
                    </CardHeader>
                    <CardContent className="py-2 px-4">
                      <p className="text-2xl font-bold">
                        {new Intl.NumberFormat('es-ES', {
                          style: 'currency',
                          currency: 'EUR',
                          maximumFractionDigits: 0
                        }).format(stats.totalValue)}
                      </p>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Distribución por etapa</h4>
                  {stats.stageDistribution.map((stage, index) => (
                    <div key={index} className="mb-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span>{stage.name}</span>
                        <span>{stage.count} ({stage.percentage}%)</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-funnl-primary" 
                          style={{ width: `${stage.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="conversion" className="mt-4">
                <h4 className="text-sm font-medium mb-2">Tasas de conversión entre etapas</h4>
                {stats.conversionRates.map((rate, index) => {
                  if (index === 0) return null;
                  return (
                    <div key={index} className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span>{funnelStages[index - 1]?.name} → {funnelStages[index]?.name}</span>
                        <span>{rate}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${rate > 50 ? 'bg-green-500' : rate > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Diálogo de creación de contacto */}
      {createContactOpen && pipelineStages.length > 0 && selectedStageId && (
        <CreateContactDialog 
          open={createContactOpen}
          onOpenChange={setCreateContactOpen}
          stages={pipelineStages}
          pipelineId="d5342cef-a927-435a-b30d-4958e9547b6d" // Pipeline ID fijo para este ejemplo
          onContactCreated={handleContactCreated}
        />
      )}
      
      <BottomNavbar />
    </div>
  );
};

export default Funnel;
