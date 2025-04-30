import React from 'react';
import ContactCard from './ContactCard';
import { type Contact, type Deal, type FunnelStageWithItems } from '@/services/supabaseService';
import DealCard from '../pipeline/DealCard';
import { PlusCircle, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/services/supabaseService';

interface FunnelStageProps {
  stage: FunnelStageWithItems;
  isSalesFunnel?: boolean;
  onAddContact?: (stageId: number) => void;
  onAddDeal?: (stageId: number) => void;
  onContactDeleted?: (contactId: string) => void;
  onDealDeleted?: (dealId: string) => void;
}

const FunnelStage: React.FC<FunnelStageProps> = ({ 
  stage, 
  isSalesFunnel = false, 
  onAddContact, 
  onAddDeal, 
  onContactDeleted, 
  onDealDeleted 
}) => {
  const [collapsed, setCollapsed] = React.useState(false);
  
  const totalValue = stage.items.reduce((sum, item) => {
    const value = 'value' in item ? item.value : 0;
    return sum + (value || 0);
  }, 0);
  
  const conversionRate = stage.items.length 
    ? Math.round(stage.items.filter(item => 'probability' in item && item.probability && item.probability > 50).length / stage.items.length * 100)
    : 0;
  
  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };
  
  const handleAddClick = () => {
    if (isSalesFunnel && onAddDeal) {
      onAddDeal(stage.id);
    } else if (!isSalesFunnel && onAddContact) {
      onAddContact(stage.id);
    }
  };
  
  return (
    <div className="mb-6 relative">
      <div 
        className="rounded-t-lg px-4 py-3 flex justify-between items-center" 
        style={{ backgroundColor: `${stage.color}20` }}
      >
        <div className="flex items-center">
          <div 
            className="w-3 h-3 rounded-full mr-3"
            style={{ backgroundColor: stage.color }}  
          />
          <h3 className="font-semibold text-gray-800">{stage.name}</h3>
          <div className="ml-2 flex items-center bg-white/70 px-2 py-0.5 rounded text-xs font-medium">
            <Users className="h-3 w-3 mr-1 text-gray-500" />
            {stage.items.length}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {totalValue > 0 && (
            <div className="text-xs font-medium bg-white/70 px-2 py-0.5 rounded">
              {formatCurrency(totalValue, 'EUR')}
            </div>
          )}
          
          {conversionRate > 0 && !isSalesFunnel && (
            <div className="text-xs font-medium bg-white/70 px-2 py-0.5 rounded">
              {conversionRate}% conv.
            </div>
          )}
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 hover:bg-white/50"
            onClick={toggleCollapsed}
          >
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 hover:bg-white/50 text-gray-700"
            onClick={handleAddClick}
          >
            <PlusCircle size={16} />
          </Button>
        </div>
      </div>
      
      <div 
        className={cn(
          "space-y-3 border-x border-b rounded-b-lg pb-3 transition-all",
          collapsed ? "h-0 overflow-hidden border-0 pb-0" : "pt-3 px-3"
        )}
        style={{ borderColor: `${stage.color}40` }}
      >
        {stage.items.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            {isSalesFunnel ? "No hay tratos en esta etapa" : "No hay contactos en esta etapa"}
          </div>
        ) : (
          <div className="space-y-3">
            {stage.items.map((item, index) => (
              isSalesFunnel ? (
                <DealCard 
                  key={item.id} 
                  deal={item as Deal} 
                  index={index} 
                  stageId={stage.id.toString()} 
                  stageColor={stage.color}
                />
              ) : (
                <ContactCard 
                  key={item.id} 
                  contact={item as Contact}
                  onContactDeleted={onContactDeleted ? () => onContactDeleted(item.id) : undefined}
                />
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FunnelStage;
