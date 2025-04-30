import React, { useState } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { CalendarIcon, DollarSign, UserCircle2, BarChart2, ExternalLink, RefreshCw, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSyncDealWithHubspotMutation } from '@/hooks/useHubspotDealSync';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';

interface Deal {
  id: string;
  title: string;
  company: string;
  value: number | null;
  owner_id: string | null;
  probability: number | null;
  expected_close_date: string | null;
}

interface DealCardProps {
  deal: Deal;
  index: number;
  stageId: string;
  stageColor: string | null;
  onDealDeleted?: (dealId: string) => void;
  isDraggable?: boolean;
}

const DealCard: React.FC<DealCardProps> = ({ deal, index, stageId, stageColor, onDealDeleted, isDraggable = false }) => {
  const [showActions, setShowActions] = useState(false);
  const syncDealMutation = useSyncDealWithHubspotMutation();
  const { toast } = useToast();

  const formattedDate = deal.expected_close_date
    ? new Date(deal.expected_close_date).toLocaleDateString('es-ES')
    : null;

  const handleSyncWithHubspot = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    toast({
      title: "Sincronizando",
      description: "Sincronizando trato con HubSpot...",
      duration: 3000,
    });
    
    syncDealMutation.mutate(deal.id, {
      onSuccess: (data) => {
        toast({
          title: "Éxito",
          description: "Trato sincronizado con HubSpot correctamente",
        });
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "No se pudo sincronizar con HubSpot",
        });
      }
    });
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDealDeleted) {
      onDealDeleted(deal.id);
    }
  };

  return (
    isDraggable ? (
      <Draggable draggableId={deal.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`${snapshot.isDragging ? 'shadow-lg scale-105' : ''}`}
            style={{
              ...provided.draggableProps.style,
              borderLeft: stageColor ? `4px solid ${stageColor}` : '4px solid #e5e7eb',
              padding: '0.75rem',
              backgroundColor: 'white',
              borderRadius: '0.5rem',
              borderWidth: '1px',
              boxShadow: snapshot.isDragging ? '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' : '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
            }}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
          >
            <div className="flex justify-between items-start mb-1.5">
              <h4 className="font-medium text-gray-800 text-sm line-clamp-1 flex-1 mr-2">{deal.title}</h4>
              <div className={`flex items-center transition-opacity duration-200 ${showActions ? 'opacity-100' : 'opacity-0'}`}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-blue-600" onClick={handleSyncWithHubspot} disabled={syncDealMutation.isPending}>
                        <RefreshCw size={14} className={syncDealMutation.isPending ? "animate-spin" : ""} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Sincronizar con HubSpot</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {onDealDeleted && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-red-600" onClick={handleDeleteClick}>
                          <Trash2 size={14} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Eliminar Trato</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-2 line-clamp-1">{deal.company}</p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1">
              {deal.value != null && (<div className="flex items-center gap-1 text-xs text-gray-600"><DollarSign size={12} className="text-green-600 flex-shrink-0" /><span className="truncate">{formatCurrency(deal.value)}</span></div>)}
              {deal.probability != null && (<div className="flex items-center gap-1 text-xs text-gray-600"><BarChart2 size={12} className="text-blue-600 flex-shrink-0" /><span className="truncate">{deal.probability}%</span></div>)}
              {formattedDate && (<div className="flex items-center gap-1 text-xs text-gray-600"><CalendarIcon size={12} className="text-orange-600 flex-shrink-0" /><span className="truncate">{formattedDate}</span></div>)}
              {deal.owner_id && (<div className="flex items-center gap-1 text-xs text-gray-600"><UserCircle2 size={12} className="text-purple-600 flex-shrink-0" /><span className="truncate">Responsable</span></div>)}
            </div>
          </div>
        )}
      </Draggable>
    ) : (
      <div
        className={`p-3 bg-white rounded-lg border shadow-sm transition-all hover:shadow-md`}
        style={{
          borderLeft: stageColor ? `4px solid ${stageColor}` : '4px solid #e5e7eb'
        }}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <div className="flex justify-between items-start mb-1.5">
          <h4 className="font-medium text-gray-800 text-sm line-clamp-1 flex-1 mr-2">{deal.title}</h4>
          <div className={`flex items-center transition-opacity duration-200 ${showActions ? 'opacity-100' : 'opacity-0'}`}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-blue-600" onClick={handleSyncWithHubspot} disabled={syncDealMutation.isPending}>
                    <RefreshCw size={14} className={syncDealMutation.isPending ? "animate-spin" : ""} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Sincronizar con HubSpot</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {onDealDeleted && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-red-600" onClick={handleDeleteClick}>
                      <Trash2 size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Eliminar Trato</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-2 line-clamp-1">{deal.company}</p>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1">
          {deal.value != null && (<div className="flex items-center gap-1 text-xs text-gray-600"><DollarSign size={12} className="text-green-600 flex-shrink-0" /><span className="truncate">{formatCurrency(deal.value)}</span></div>)}
          {deal.probability != null && (<div className="flex items-center gap-1 text-xs text-gray-600"><BarChart2 size={12} className="text-blue-600 flex-shrink-0" /><span className="truncate">{deal.probability}%</span></div>)}
          {formattedDate && (<div className="flex items-center gap-1 text-xs text-gray-600"><CalendarIcon size={12} className="text-orange-600 flex-shrink-0" /><span className="truncate">{formattedDate}</span></div>)}
          {deal.owner_id && (<div className="flex items-center gap-1 text-xs text-gray-600"><UserCircle2 size={12} className="text-purple-600 flex-shrink-0" /><span className="truncate">Responsable</span></div>)}
        </div>
      </div>
    )
  );
};

export default DealCard; 