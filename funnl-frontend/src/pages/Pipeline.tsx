import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import PageHeader from '@/components/layout/PageHeader';
import BottomNavbar from '@/components/layout/BottomNavbar';
import { PlusCircle, Filter, Search, RefreshCw } from 'lucide-react';
import PipelineColumn from '@/components/pipeline/PipelineColumn';
import PipelineSelector from '@/components/pipeline/PipelineSelector';
import CreateDealDialog from '@/components/pipeline/CreateDealDialog';
import CreateContactDialog from '@/components/pipeline/CreateContactDialog';
import { getPipelines, getPipelineWithStages, updateDeal } from '@/services/supabaseService';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { useSyncAllWithHubspotMutation } from '@/hooks/useHubspotSync';
import HubspotConfig from '@/components/automations/HubspotConfig';

interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  icon: string | null;
  color: string | null;
  sort_order: number;
}

const Pipeline = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [pipelineData, setPipelineData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [createDealOpen, setCreateDealOpen] = useState(false);
  const [createContactOpen, setCreateContactOpen] = useState(false);
  const [isHubspotConnected, setIsHubspotConnected] = useState(false);
  const { toast } = useToast();
  const syncAllMutation = useSyncAllWithHubspotMutation();
  
  // Determina si el pipeline actual es de contactos o ventas
  const isContactPipeline = selectedPipeline?.name.toLowerCase().includes('contacto');
  
  // Título y subtítulo dinámicos basados en el tipo de pipeline
  const pageTitle = isContactPipeline ? "Pipeline de Contactos" : "Pipeline de Ventas";
  const pageSubtitle = isContactPipeline 
    ? "Gestiona tus contactos a través del proceso de adquisición"
    : "Gestiona tus tratos a través del proceso de ventas";
  
  // Texto del botón de nuevo elemento
  const newItemText = isContactPipeline ? "Nuevo Contacto" : "Nuevo Trato";
  
  // Placeholder de búsqueda
  const searchPlaceholder = isContactPipeline ? "Buscar contactos..." : "Buscar tratos...";
  
  // Texto para pipeline vacío
  const emptyPipelineText = isContactPipeline
    ? "No se encontraron etapas de pipeline de contactos. Por favor, cree etapas para este pipeline."
    : "No se encontraron etapas de pipeline de ventas. Por favor, cree etapas para este pipeline.";
  
  useEffect(() => {
    const loadPipelines = async () => {
      try {
        const data = await getPipelines();
        setPipelines(data);
        if (data.length > 0) {
          setSelectedPipeline(data[0]);
        }
      } catch (error) {
        console.error('Failed to load pipelines:', error);
        toast({
          title: "Error",
          description: "Error al cargar los pipelines. Por favor, inténtelo de nuevo.",
          variant: "destructive",
        });
      }
    };

    loadPipelines();
  }, [toast]);

  const loadPipelineData = async () => {
    if (!selectedPipeline) return;
    
    setLoading(true);
    try {
      const data = await getPipelineWithStages(selectedPipeline.id);
      setPipelineData(data);
    } catch (error) {
      console.error('Failed to load pipeline data:', error);
      toast({
        title: "Error",
        description: "Error al cargar los datos del pipeline. Por favor, inténtelo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPipelineData();
  }, [selectedPipeline, toast]);

  const handlePipelineChange = (pipeline: Pipeline) => {
    setSelectedPipeline(pipeline);
  };

  // Filter deals based on search query
  const filteredPipelineData = pipelineData ? {
    ...pipelineData,
    stages: pipelineData.stages.map((stage: any) => {
      const filteredDeals = stage.deals.filter((deal: any) => {
        // Soporte para ambos tipos de pipelines (contactos y ventas)
        if (isContactPipeline) {
          const nameMatch = deal.name?.toLowerCase().includes(searchQuery.toLowerCase());
          const titleMatch = deal.title?.toLowerCase().includes(searchQuery.toLowerCase());
          const companyMatch = deal.company?.toLowerCase().includes(searchQuery.toLowerCase());
          const emailMatch = deal.email?.toLowerCase().includes(searchQuery.toLowerCase());
          return nameMatch || titleMatch || companyMatch || emailMatch;
        } else {
          // Pipeline de ventas
          const titleMatch = deal.title?.toLowerCase().includes(searchQuery.toLowerCase());
          const companyMatch = deal.company?.toLowerCase().includes(searchQuery.toLowerCase());
          return titleMatch || companyMatch;
        }
      });
      
      return {
        ...stage,
        deals: filteredDeals
      };
    })
  } : null;

  // Handle drag and drop functionality
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    
    // If dropped outside a droppable area
    if (!destination) return;
    
    // If dropped in the same position
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }
    
    // Get source and destination stages
    const sourceStage = pipelineData.stages.find((stage: any) => stage.id === source.droppableId);
    const destinationStage = pipelineData.stages.find((stage: any) => stage.id === destination.droppableId);
    
    if (!sourceStage || !destinationStage) return;
    
    // Create a new array of deals for the source stage
    const sourceDealsCopy = Array.from(sourceStage.deals);
    
    // Get the deal that was moved
    const [movedDeal] = sourceDealsCopy.splice(source.index, 1);
    
    let newStages;
    
    // If moved within the same stage, just reorder
    if (source.droppableId === destination.droppableId) {
      sourceDealsCopy.splice(destination.index, 0, movedDeal);
      
      newStages = pipelineData.stages.map((stage: any) => {
        if (stage.id === source.droppableId) {
          return {
            ...stage,
            deals: sourceDealsCopy,
          };
        }
        return stage;
      });
    } else {
      // If moved to a different stage
      const destinationDealsCopy = Array.from(destinationStage.deals);
      destinationDealsCopy.splice(destination.index, 0, movedDeal);
      
      newStages = pipelineData.stages.map((stage: any) => {
        if (stage.id === source.droppableId) {
          return {
            ...stage,
            deals: sourceDealsCopy,
          };
        }
        if (stage.id === destination.droppableId) {
          return {
            ...stage,
            deals: destinationDealsCopy,
          };
        }
        return stage;
      });
      
      // Update the deal in the database with the new stage_id
      try {
        await updateDeal(draggableId, { stage_id: destination.droppableId });
      } catch (error) {
        console.error('Failed to update deal stage:', error);
        toast({
          title: "Error",
          description: "Error al actualizar la etapa del trato. Por favor, inténtelo de nuevo.",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Update the state with the new arrangement
    setPipelineData({
      ...pipelineData,
      stages: newStages,
    });
  };

  // Función para manejar el botón "Nuevo Trato" o "Nuevo Contacto"
  const handleCreateNewItem = () => {
    if (isContactPipeline) {
      setCreateContactOpen(true);
    } else {
      setCreateDealOpen(true);
    }
  };

  const handleItemCreated = () => {
    // Recargar los datos del pipeline cuando se crea un nuevo trato o contacto
    loadPipelineData();
  };

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
    if (syncAllMutation.isSuccess) {
      toast({
        title: "Sincronización Completa",
        description: "Los datos de HubSpot han sido sincronizados con éxito.",
      });
      loadPipelineData(); // Recargar los datos después de la sincronización
    }
    if (syncAllMutation.isError) {
      toast({
        variant: "destructive",
        title: "Error de Sincronización",
        description: syncAllMutation.error?.message || "No se pudo completar la sincronización con HubSpot.",
      });
    }
  }, [syncAllMutation.isSuccess, syncAllMutation.isError, syncAllMutation.error, toast]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <PageHeader 
        title={pageTitle} 
        subtitle={pageSubtitle}
      />
      
      <div className="flex-1 overflow-hidden flex flex-col p-4">
        {/* Pipeline Selection and Actions */}
        <div className="flex justify-between items-center mb-4">
          {pipelines.length > 0 && (
            <PipelineSelector 
              pipelines={pipelines}
              selectedPipeline={selectedPipeline}
              onChange={handlePipelineChange}
            />
          )}
          
          <div className="flex gap-2">
            {isHubspotConnected && (
              <button 
                className="flex items-center gap-1 text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-sm"
                onClick={handleHubspotRefresh}
                disabled={syncAllMutation.isPending}
              >
                <RefreshCw size={16} className={syncAllMutation.isPending ? "animate-spin" : ""} />
                {syncAllMutation.isPending ? "Sincronizando..." : "Sincronizar con HubSpot"}
              </button>
            )}
            <button 
              className="flex items-center gap-1 text-white bg-funnl-primary px-3 py-1.5 rounded-lg text-sm"
              onClick={handleCreateNewItem}
            >
              <PlusCircle size={16} />
              {newItemText}
            </button>
          </div>
        </div>
        
        {/* HubSpot Connection Status */}
        {!isHubspotConnected && (
          <div className="mb-4">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-blue-100 p-1.5 rounded-full mr-3">
                  <img src="/hubspot-icon.png" alt="HubSpot" className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-800">Conecta con HubSpot</p>
                  <p className="text-xs text-blue-600">Sincroniza tus {isContactPipeline ? "contactos" : "tratos"} con HubSpot para una gestión integrada</p>
                </div>
              </div>
              <HubspotConfig 
                compact={true} 
                onConfigured={setIsHubspotConnected}
                onRefresh={handleHubspotRefresh}
              />
            </div>
          </div>
        )}
        
        {/* Search and Filter Bar */}
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <button className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg bg-white">
            <Filter size={16} className="text-gray-500" />
            <span className="text-sm whitespace-nowrap">Filtro</span>
          </button>
        </div>
        
        {/* Kanban Board */}
        {loading ? (
          <div className="flex-1 flex gap-4 overflow-x-auto py-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-shrink-0 w-72">
                <div className="animate-pulse bg-gray-100 h-8 mb-3 rounded"></div>
                <div className="animate-pulse bg-gray-100 h-32 mb-3 rounded-lg"></div>
                <div className="animate-pulse bg-gray-100 h-32 mb-3 rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex-1 flex gap-4 overflow-x-auto py-2 pb-24 md:pb-4">
              {filteredPipelineData?.stages?.map((stage: any) => (
                <PipelineColumn 
                  key={stage.id} 
                  stage={stage} 
                  pipelineId={selectedPipeline?.id || ''} 
                  isContactPipeline={isContactPipeline}
                />
              ))}
              
              {(!filteredPipelineData?.stages || filteredPipelineData.stages.length === 0) && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center p-8 text-gray-500">
                    {emptyPipelineText}
                  </div>
                </div>
              )}
            </div>
          </DragDropContext>
        )}
      </div>
      
      {/* Renderizamos condicionalmente el diálogo adecuado según el tipo de pipeline */}
      {isContactPipeline ? (
        <CreateContactDialog 
          open={createContactOpen} 
          onOpenChange={setCreateContactOpen} 
          pipelineId={selectedPipeline?.id || ''}
          stages={pipelineData?.stages || []}
          onContactCreated={handleItemCreated}
        />
      ) : (
        <CreateDealDialog 
          open={createDealOpen} 
          onOpenChange={setCreateDealOpen} 
          pipelineId={selectedPipeline?.id || ''}
          stages={pipelineData?.stages || []}
          onDealCreated={handleItemCreated}
        />
      )}
      
      <BottomNavbar />
    </div>
  );
};

export default Pipeline; 