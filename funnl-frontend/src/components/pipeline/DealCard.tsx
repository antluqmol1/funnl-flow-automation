import React, { useState } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { CalendarIcon, DollarSign, UserCircle2, BarChart2, ExternalLink, RefreshCw } from 'lucide-react';
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
}

const DealCard: React.FC<DealCardProps> = ({ deal, index, stageId, stageColor }) => {
  const [showActions, setShowActions] = useState(false);
  const syncDealMutation = useSyncDealWithHubspotMutation();
  const { toast } = useToast();

  const formattedDate = deal.expected_close_date
    ? new Date(deal.expected_close_date).toLocaleDateString('es-ES')
    : null;

  const handleSyncWithHubspot = (e: React.MouseEvent) => {
    e.stopPropagation(); // Evitar propagar el evento al Draggable
    
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

  return (
    <Draggable draggableId={deal.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`p-3 bg-white rounded-lg border shadow-sm transition-all hover:shadow-md ${
            snapshot.isDragging ? 'shadow-md' : ''
          }`}
          style={{
            ...provided.draggableProps.style,
            borderLeft: stageColor ? `3px solid ${stageColor}` : undefined
          }}
          onMouseEnter={() => setShowActions(true)}
          onMouseLeave={() => setShowActions(false)}
        >
          <Card className="bg-white shadow-sm hover:shadow transition-shadow">
            <CardContent className="p-3">
              <div className="mb-1.5 flex justify-between items-start">
                <h3 className="font-medium text-gray-800 text-sm">{deal.title}</h3>
                
                {showActions && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6" 
                          onClick={handleSyncWithHubspot}
                          disabled={syncDealMutation.isPending}
                        >
                          <RefreshCw size={14} className={syncDealMutation.isPending ? "animate-spin" : ""} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Sincronizar con HubSpot</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div>
                  <h4 className="font-medium text-gray-800 line-clamp-1">{deal.title}</h4>
                  <p className="text-sm text-gray-500 line-clamp-1">{deal.company}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {deal.value && (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <DollarSign size={12} className="text-green-600" />
                      <span>{formatCurrency(deal.value)}</span>
                    </div>
                  )}
                  
                  {deal.probability && (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <BarChart2 size={12} className="text-blue-600" />
                      <span>{deal.probability}%</span>
                    </div>
                  )}
                  
                  {formattedDate && (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <CalendarIcon size={12} className="text-orange-600" />
                      <span>{formattedDate}</span>
                    </div>
                  )}
                  
                  {deal.owner_id && (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <UserCircle2 size={12} className="text-purple-600" />
                      <span>Responsable</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Draggable>
  );
};

export default DealCard; 