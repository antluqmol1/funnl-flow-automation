import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/components/ui/use-toast";
import PageHeader from '@/components/layout/PageHeader';
import BottomNavbar from '@/components/layout/BottomNavbar';
import FunnelStage from '@/components/funnel/FunnelStage';
import CreateContactDialog from '@/components/pipeline/CreateContactDialog';
import { 
  getFunnelStagesWithContacts, 
  getPipelineStages, 
  deleteContact, 
  getPipelines,
  getSalesFunnelData,
  deleteDeal,
  type Deal,
  type FunnelStageWithItems,
  type Contact,
  type PipelineStage
} from '@/services/supabaseService';
import { Loader2, Search, PlusCircle, BarChart3, RefreshCw, LayoutDashboard, Link } from 'lucide-react';
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
import CreateDealDialog from '@/components/pipeline/CreateDealDialog';
import { useSyncAllContactsMutation, useSyncAllDealsMutation } from '@/hooks/useHubspotSync';

const Funnel = () => {
  // Estado
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedView, setSelectedView] = useState<'list' | 'funnel'>('funnel');
  const [funnelStages, setFunnelStages] = useState<FunnelStageWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [salesPipelineStages, setSalesPipelineStages] = useState<PipelineStage[]>([]);
  const [contactPipelineStages, setContactPipelineStages] = useState<PipelineStage[]>([]);
  const [statsOpen, setStatsOpen] = useState(false);
  const [createContactOpen, setCreateContactOpen] = useState(false);
  const [createDealOpen, setCreateDealOpen] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeFunnel, setActiveFunnel] = useState<'customer' | 'sales'>('customer');
  
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const customerFilters = [
    { id: 'all', name: 'Todos' },
    { id: 'Suscriptores', name: 'Suscriptor' },
    { id: 'Leads', name: 'Lead' },
    { id: 'MQLs', name: 'MQL' },
    { id: 'SQLs', name: 'SQL' },
    { id: 'Oportunidades', name: 'Oportunidad' },
    { id: 'Clientes', name: 'Cliente' },
    { id: 'Evangelistas', name: 'Evangelista' },
    { id: 'Otros', name: 'Otros' }
  ];
  
  const salesFilters = [
    { id: 'all', name: 'Todos' },
    { id: 'Captado', name: 'Captado' },
    { id: 'Cultivado', name: 'Cultivado' },
    { id: 'Demo', name: 'Demo' },
    { id: 'Negociación', name: 'Negociación' },
    { id: 'Ganado', name: 'Ganado' },
  ];

  const syncContactsMutation = useSyncAllContactsMutation();
  const syncDealsMutation = useSyncAllDealsMutation();

  useEffect(() => {
    const loadInitialData = async () => {
      await loadFunnelData(activeFunnel);
      await loadAllPipelinesAndStages();
    };
    loadInitialData();
  }, [activeFunnel]);

  const loadFunnelData = async (funnelType: 'customer' | 'sales') => {
    try {
      setLoading(true);
      setError(null);
      let data: FunnelStageWithItems[] = [];
      if (funnelType === 'customer') {
        data = await getFunnelStagesWithContacts();
      } else {
        data = await getSalesFunnelData();
      }
      setFunnelStages(data);
    } catch (error) {
      console.error(`Error al cargar las etapas del embudo (${funnelType}):`, error);
      setError(`No se pudieron cargar los datos del embudo de ${funnelType === 'customer' ? 'clientes' : 'ventas'}`);
      toast({
        title: "Error",
        description: `No se pudieron cargar los datos del embudo. Por favor, inténtalo de nuevo.`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAllPipelinesAndStages = async () => {
    try {
      const allPipelines = await getPipelines();
      const contactPipeline = allPipelines.find(p => p.name.toLowerCase().includes('contacto'));
      const salesPipeline = allPipelines.find(p => !p.name.toLowerCase().includes('contacto'));

      if (contactPipeline) {
        const stages = await getPipelineStages(contactPipeline.id);
        setContactPipelineStages(stages);
      } else {
        console.warn("Contact Pipeline not found.");
        setContactPipelineStages([]);
      }

      if (salesPipeline) {
        const stages = await getPipelineStages(salesPipeline.id);
        setSalesPipelineStages(stages);
      } else {
        console.warn("Sales Pipeline not found.");
        setSalesPipelineStages([]);
      }

    } catch (error) {
      console.error('Error loading pipelines or their stages:', error);
      toast({ title: "Error", description: "No se pudieron cargar las configuraciones del pipeline.", variant: "destructive" });
    }
  };

  const refreshData = async () => {
    try {
      setRefreshing(true);
      await loadFunnelData(activeFunnel);
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

  const handleSyncContacts = () => {
    toast({ title: "Iniciando sincronización", description: "Sincronizando contactos con HubSpot..." });
    syncContactsMutation.mutate(undefined, {
      onSuccess: (data) => {
        const { linked_contacts = 0, imported_contacts = 0, errors = [] } = data.details || {};
        toast({
          title: "Sincronización de Contactos Completa",
          description: `${linked_contacts} vinculados, ${imported_contacts} importados. ${errors.length > 0 ? `${errors.length} errores.` : ''}`,
        });
      },
      onError: (error) => {
        toast({
          title: "Error en Sincronización",
          description: error.message || "No se pudo sincronizar contactos.",
          variant: "destructive",
        });
      }
    });
  };

  const handleSyncDeals = () => {
    toast({ title: "Iniciando sincronización", description: "Sincronizando tratos con HubSpot..." });
    syncDealsMutation.mutate(undefined, {
        onSuccess: (data) => {
            const { linked_deals = 0, imported_deals = 0, errors = [] } = data.details || {};
            toast({
                title: "Sincronización de Tratos Completa",
                description: `${linked_deals} vinculados, ${imported_deals} importados. ${errors.length > 0 ? `${errors.length} errores.` : ''}`,
            });
        },
        onError: (error) => {
            toast({
                title: "Error en Sincronización",
                description: error.message || "No se pudo sincronizar tratos.",
                variant: "destructive",
            });
        }
    });
  };

  const handleAddContact = (stageId: number) => {
    setSelectedStageId(stageId);
    setCreateContactOpen(true);
  };

  const handleAddDeal = (stageId: number) => {
    setSelectedStageId(stageId);
    setCreateDealOpen(true);
  };

  const handleContactCreated = () => {
    setCreateContactOpen(false);
    toast({
      title: "Contacto creado",
      description: "El contacto se ha añadido al embudo correctamente",
    });
    loadFunnelData('customer');
  };

  const handleDealCreated = () => {
    setCreateDealOpen(false);
    toast({
      title: "Trato creado",
      description: "El trato se ha añadido al embudo de ventas correctamente",
    });
    loadFunnelData('sales');
  };

  const goToPipeline = () => {
    navigate('/pipeline');
  };

  const stats = useMemo(() => {
    if (!funnelStages || funnelStages.length === 0) return null;
    
    const totalItems = funnelStages.reduce((sum, stage) => sum + stage.items.length, 0);
    const totalValue = funnelStages.reduce((sum, stage) => {
      return sum + stage.items.reduce((stageSum, item) => {
        const value = 'value' in item ? item.value : 0;
        return stageSum + (value || 0);
      }, 0);
    }, 0);
    
    const conversionRates = funnelStages.map((stage, index, stages) => {
      if (index === 0 || stages[index - 1].items.length === 0) return 100;
      const previousStageCount = stages[index - 1].items.length;
      return previousStageCount > 0 ? Math.round((stage.items.length / previousStageCount) * 100) : 0;
    });
    
    return {
      totalItems,
      totalValue,
      conversionRates,
      stageDistribution: funnelStages.map(stage => ({
        name: stage.name,
        count: stage.items.length,
        percentage: totalItems ? Math.round((stage.items.length / totalItems) * 100) : 0
      }))
    };
  }, [funnelStages]);

  const filteredStages = useMemo(() => {
    if (!funnelStages) return [];
    
    const currentFilters = activeFunnel === 'customer' ? customerFilters : (
        salesPipelineStages.length > 0
            ? [{ id: 'all', name: 'Todos' }, ...salesPipelineStages.map(s => ({ id: s.name, name: s.name }))]
            : salesFilters
    );
    const currentFilterValue = selectedFilter;
    
    return funnelStages.map(stage => {
      const filteredItems = stage.items.filter((item: Contact | Deal) => {
        let matchesSearch = !searchQuery;
        
        if (!matchesSearch) {
          if ('name' in item && activeFunnel === 'customer') {
            matchesSearch = 
              item.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
              item.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.email?.toLowerCase().includes(searchQuery.toLowerCase());
          } else if ('title' in item && activeFunnel === 'sales'){
             matchesSearch = 
              item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.company?.toLowerCase().includes(searchQuery.toLowerCase());
          }
        }
        
        let matchesFilter = currentFilterValue === 'all';
        if (!matchesFilter) {
           if (activeFunnel === 'customer' && 'status' in item) {
             matchesFilter = item.status === currentFilterValue;
           } else if (activeFunnel === 'sales') {
             matchesFilter = stage.name === currentFilterValue;
           }
        }
        
        return matchesSearch && matchesFilter;
      });
      
      return {
        ...stage,
        items: filteredItems
      };
    });
  }, [funnelStages, searchQuery, selectedFilter, activeFunnel, salesPipelineStages]);

  const visibleStages = useMemo(() => {
    if (selectedFilter === 'all') {
      return filteredStages;
    }
    return filteredStages.filter(stage => stage.items.length > 0);
  }, [filteredStages, selectedFilter]);
  
  const handleDeleteContact = async (contactId: string) => {
    if (activeFunnel !== 'customer') return;
    try {
      await deleteContact(contactId);
      toast({
        title: "Contacto eliminado",
        description: "El contacto ha sido eliminado correctamente.",
      });
      await loadFunnelData('customer');
    } catch (error) {
      console.error('Error al eliminar contacto:', error);
      toast({
        title: "Error al eliminar",
        description: "No se pudo eliminar el contacto. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDeal = async (dealId: string) => {
    if (activeFunnel !== 'sales') return;
    try {
      await deleteDeal(dealId);
      toast({
        title: "Trato eliminado",
        description: "El trato ha sido eliminado correctamente.",
      });
      await loadFunnelData('sales');
    } catch (error) {
      console.error('Error al eliminar trato:', error);
      toast({
        title: "Error al eliminar",
        description: "No se pudo eliminar el trato. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  };

  const handleAddNewItem = () => {
    const firstStage = funnelStages.length > 0 ? funnelStages[0] : null;
    if (!firstStage) {
      toast({ title: "Error", description: "No hay etapas definidas para añadir.", variant: "destructive" });
      return;
    }
    if (activeFunnel === 'customer') {
      handleAddContact(firstStage.id);
    } else {
      handleAddDeal(firstStage.id);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader 
        title={activeFunnel === 'customer' ? "Embudo de Clientes" : "Embudo de Ventas"} 
        subtitle={activeFunnel === 'customer' ? "Visualiza y gestiona tu proceso de adquisición" : "Visualiza y gestiona tu proceso de ventas"}
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
            size="icon"
            className="h-8 w-8"
            onClick={activeFunnel === 'customer' ? handleSyncContacts : handleSyncDeals}
            disabled={syncContactsMutation.isPending || syncDealsMutation.isPending}
            title={`Sincronizar ${activeFunnel === 'customer' ? 'contactos' : 'tratos'} con HubSpot`}
          >
            <Link className={`h-4 w-4 ${syncContactsMutation.isPending || syncDealsMutation.isPending ? 'animate-pulse text-blue-500' : ''}`} />
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
            onClick={handleAddNewItem}
            className="h-8"
            disabled={funnelStages.length === 0}
          >
            <PlusCircle className="h-4 w-4 mr-1" />
            {activeFunnel === 'customer' ? 'Nuevo Contacto' : 'Nuevo Trato'}
          </Button>
        </div>
      </PageHeader>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Tabs value={activeFunnel} onValueChange={(value) => {
          setSelectedFilter('all');
          setSearchQuery('');
          setActiveFunnel(value as 'customer' | 'sales');
        }} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="customer">Embudo de Clientes</TabsTrigger>
            <TabsTrigger value="sales">Embudo de Ventas</TabsTrigger>
          </TabsList>

          <TabsContent value="customer">
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
                  {customerFilters.map(filter => (
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
              </div>
            </div>
            
            {loading ? (
              <div className="py-10 flex flex-col items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-funnl-primary mb-2" />
                <p className="text-sm text-gray-500">Cargando datos del embudo de clientes...</p>
              </div>
            ) : error ? (
              <div className="py-10 text-center">
                <p className="text-red-500 mb-2">{error}</p>
                <Button variant="outline" onClick={() => loadFunnelData('customer')}>
                  Reintentar
                </Button>
              </div>
            ) : (
              <>
                {visibleStages.length > 0 ? (
                  <div className="space-y-4">
                    {visibleStages.map(stage => (
                      <FunnelStage 
                        key={`customer-${stage.id}`} 
                        stage={stage} 
                        isSalesFunnel={false}
                        onAddContact={handleAddContact} 
                        onContactDeleted={handleDeleteContact} 
                        onAddDeal={undefined} 
                        onDealDeleted={undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-8 text-gray-500">
                    {searchQuery || selectedFilter !== 'all' 
                      ? "No se encontraron contactos que coincidan con tu búsqueda o filtro."
                      : "Este embudo aún no tiene contactos."
                    }
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="sales">
            <div className="mb-4">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Buscar tratos..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex justify-between items-center mb-2">
                <div className="flex overflow-x-auto gap-2 py-2 no-scrollbar">
                  {(salesPipelineStages.length > 0 ? [{ id: 'all', name: 'Todos' }, ...salesPipelineStages.map(s => ({ id: s.name, name: s.name }))] : salesFilters)
                    .map(filter => (
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
              </div>
            </div>

            {loading ? (
              <div className="py-10 flex flex-col items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-funnl-primary mb-2" />
                <p className="text-sm text-gray-500">Cargando datos del embudo de ventas...</p>
              </div>
            ) : error ? (
               <div className="py-10 text-center">
                <p className="text-red-500 mb-2">{error}</p>
                <Button variant="outline" onClick={() => loadFunnelData('sales')}> 
                  Reintentar
                </Button>
              </div>
            ) : (
               <>
                {visibleStages.length > 0 ? (
                  <div className="space-y-4">
                    {visibleStages.map(stage => (
                      <FunnelStage 
                        key={`sales-${stage.id}`} 
                        stage={stage} 
                        isSalesFunnel={true}
                        onAddDeal={handleAddDeal} 
                        onDealDeleted={handleDeleteDeal} 
                        onAddContact={undefined} 
                        onContactDeleted={undefined}
                      />
                    ))}
                  </div>
                ) : (
                   <div className="text-center p-8 text-gray-500">
                    {searchQuery || selectedFilter !== 'all' 
                      ? "No se encontraron tratos que coincidan con tu búsqueda o filtro."
                      : "Este embudo aún no tiene tratos."
                    }
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={statsOpen} onOpenChange={setStatsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Estadísticas del Embudo</DialogTitle>
            <DialogDescription>
              Análisis y métricas de tu embudo de {activeFunnel === 'customer' ? 'clientes' : 'ventas'} 
            </DialogDescription>
          </DialogHeader>
          
          {stats ? (
            <Tabs defaultValue="general">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="conversion">Conversión</TabsTrigger>
              </TabsList>
              
              <TabsContent value="general" className="mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">{activeFunnel === 'customer' ? 'Contactos' : 'Tratos'}</CardTitle>
                    </CardHeader>
                    <CardContent className="py-2 px-4">
                      <p className="text-2xl font-bold">{stats.totalItems}</p>
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
                {stats.conversionRates.length > 1 ? stats.conversionRates.map((rate, index) => {
                  if (index === 0) return null;
                  const fromStageName = funnelStages[index - 1]?.name || 'Inicio';
                  const toStageName = funnelStages[index]?.name || 'Fin';
                  return (
                    <div key={index} className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span>{fromStageName} → {toStageName}</span>
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
                }) : (
                  <p className="text-xs text-gray-500">Se necesita más de una etapa para calcular la conversión.</p>
                )}
              </TabsContent>
            </Tabs>
          ) : (
             <p className="text-sm text-gray-500">Cargando estadísticas...</p> 
          )}
        </DialogContent>
      </Dialog>
      
      {createContactOpen && contactPipelineStages.length > 0 && (
        <CreateContactDialog 
          open={createContactOpen}
          onOpenChange={setCreateContactOpen}
          stages={contactPipelineStages}
          pipelineId={contactPipelineStages.find(s => s.position === 0)?.pipeline_id || ''}
          onContactCreated={handleContactCreated}
        />
      )}
      
      {createDealOpen && salesPipelineStages.length > 0 && (
        <CreateDealDialog 
          open={createDealOpen}
          onOpenChange={setCreateDealOpen}
          stages={salesPipelineStages}
          pipelineId={salesPipelineStages.find(s => s.position === 0)?.pipeline_id || ''}
          onDealCreated={handleDealCreated}
        />
      )}
      
      <BottomNavbar />
    </div>
  );
};

export default Funnel;
