import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import PageHeader from '@/components/layout/PageHeader';
import BottomNavbar from '@/components/layout/BottomNavbar';
import { PlusCircle, Filter, Search, RefreshCw } from 'lucide-react';
import PipelineColumn from '@/components/pipeline/PipelineColumn';
import PipelineSelector from '@/components/pipeline/PipelineSelector';
import CreateDealDialog from '@/components/pipeline/CreateDealDialog';
import CreateContactDialog from '@/components/pipeline/CreateContactDialog';
import { getPipelines, getPipelineWithStages, updateDeal, updateContact, deleteContact } from '@/services/supabaseService';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { useSyncAllContactsMutation, useSyncAllDealsMutation } from '@/hooks/useHubspotSync';
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
  const syncContactsMutation = useSyncAllContactsMutation();
  const syncDealsMutation = useSyncAllDealsMutation();
  
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

  // Filter items based on search query
  const filteredPipelineData = pipelineData ? {
    ...pipelineData,
    stages: pipelineData.stages.map((stage: any) => {
      const items = stage.items || []; // Default to empty array
      
      const filteredItems = items.filter((item: any) => {
        if (isContactPipeline) {
          const nameMatch = item.name?.toLowerCase().includes(searchQuery.toLowerCase());
          const companyMatch = item.company?.toLowerCase().includes(searchQuery.toLowerCase());
          const emailMatch = item.email?.toLowerCase().includes(searchQuery.toLowerCase());
          return nameMatch || companyMatch || emailMatch;
        } else { // Deal Pipeline
          const titleMatch = item.title?.toLowerCase().includes(searchQuery.toLowerCase());
          const companyMatch = item.company?.toLowerCase().includes(searchQuery.toLowerCase());
          return titleMatch || companyMatch;
        }
      });
      
      return {
        ...stage,
        items: filteredItems // <-- Return filtered items under 'items' key
      };
    })
  } : null;

  // Handle drag and drop functionality
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination || !pipelineData) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const sourceStage = pipelineData.stages.find((stage: any) => stage.id === source.droppableId);
    const destinationStage = pipelineData.stages.find((stage: any) => stage.id === destination.droppableId);
    if (!sourceStage || !destinationStage) return;

    const sourceItems = Array.from(sourceStage.items || []); // Use items
    const [movedItem] = sourceItems.splice(source.index, 1);

    // Optimistic UI update
    let newStages;
    if (source.droppableId === destination.droppableId) {
      sourceItems.splice(destination.index, 0, movedItem);
      newStages = pipelineData.stages.map((stage: any) => 
        stage.id === source.droppableId ? { ...stage, items: sourceItems } : stage // Use items
      );
    } else {
      const destinationItems = Array.from(destinationStage.items || []); // Use items
      destinationItems.splice(destination.index, 0, movedItem);
      newStages = pipelineData.stages.map((stage: any) => {
        if (stage.id === source.droppableId) return { ...stage, items: sourceItems }; // Use items
        if (stage.id === destination.droppableId) return { ...stage, items: destinationItems }; // Use items
        return stage;
      });
    }
    setPipelineData({ ...pipelineData, stages: newStages }); // Apply optimistic update

    // Update database based on pipeline type
    if (source.droppableId !== destination.droppableId) { 
      try {
        if (isContactPipeline) {
          let newStatus = 'otro';
          const destStageName = destinationStage.name.toLowerCase();
          if (destStageName.includes('suscriptor')) newStatus = 'suscriptor';
          else if (destStageName.includes('lead')) newStatus = 'lead';
          else if (destStageName.includes('mql')) newStatus = 'mql';
          else if (destStageName.includes('sql')) newStatus = 'sql';
          else if (destStageName.includes('oportunidad')) newStatus = 'oportunidad';
          else if (destStageName.includes('cliente')) newStatus = 'cliente';
          else if (destStageName.includes('evangelista')) newStatus = 'evangelista';
          
          await updateContact(draggableId, { 
            stage_id: destination.droppableId, 
            status: newStatus 
          });
          toast({ title: "Contacto movido", description: `Movido a la etapa ${destinationStage.name}.` });
        } else {
          await updateDeal(draggableId, { stage_id: destination.droppableId });
          toast({ title: "Trato movido", description: `Movido a la etapa ${destinationStage.name}.` });
        }
      } catch (error) {
        console.error(`Failed to update ${isContactPipeline ? 'contact' : 'deal'} stage:`, error);
        toast({
          title: "Error",
          description: `Error al actualizar la etapa del ${isContactPipeline ? 'contacto' : 'trato'}. Revirtiendo cambio visual.`,
          variant: "destructive",
        });
        setPipelineData(pipelineData);
      }
    }
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
    const mutationToUse = isContactPipeline ? syncContactsMutation : syncDealsMutation;
    const type = isContactPipeline ? 'contactos' : 'tratos';

    toast({
      title: "Sincronizando",
      description: `Actualizando ${type} con HubSpot...`,
      duration: 3000,
    });

    // Llamar a la mutación correspondiente
    mutationToUse.mutate(undefined, {
      onSuccess: (data) => {
        const successMessage = data.message || `Sincronización de ${type} completada.`;
        let details = "";
        if (isContactPipeline && data.details) {
            const d = data.details as any; // Cast para acceder a detalles
            details = `${d.linked_contacts ?? 0} vinculados, ${d.imported_contacts ?? 0} importados.`;
        } else if (!isContactPipeline && data.details) {
            const d = data.details as any; // Cast para acceder a detalles
            details = `${d.linked_deals ?? 0} vinculados, ${d.imported_deals ?? 0} importados.`;
        }
        const errorsCount = data.details?.errors?.length ?? 0;
        if (errorsCount > 0) details += ` ${errorsCount} errores.`;

        toast({
          title: `Sincronización Completa (${type})`,
          description: `${successMessage} ${details}`.trim(),
        });
        loadPipelineData(); // Recargar los datos después de la sincronización
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: `Error de Sincronización (${type})`,
          description: error.message || `No se pudo completar la sincronización de ${type}.`,
        });
      }
    });
  };

  // --- Added: Handler for deleting contact --- 
  const handleDeleteContact = async (contactId: string) => {
    try {
      await deleteContact(contactId); // Call service
      toast({
        title: "Contacto eliminado",
        description: "El contacto ha sido eliminado del pipeline.",
      });
      await loadPipelineData(); // Reload data
    } catch (error) {
      console.error('Error deleting contact from pipeline:', error);
      toast({
        title: "Error al eliminar",
        description: "No se pudo eliminar el contacto. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  };

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
                disabled={syncContactsMutation.isPending || syncDealsMutation.isPending}
              >
                <RefreshCw size={16} className={(syncContactsMutation.isPending || syncDealsMutation.isPending) ? "animate-spin" : ""} />
                {(syncContactsMutation.isPending || syncDealsMutation.isPending) ? "Sincronizando..." : `Sinc. ${isContactPipeline ? 'Contactos' : 'Tratos'}`}
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
                  onContactDeleted={handleDeleteContact}
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