import React from 'react';
import ContactCard from './ContactCard';
import { type Contact } from '@/services/supabaseService';
import { PlusCircle, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/services/supabaseService';

interface FunnelStageType {
  id: number;
  name: string;
  color: string;
  contacts: (Contact & { tasksCount?: number })[];
}

interface FunnelStageProps {
  stage: FunnelStageType;
  onAddContact?: (stageId: number) => void;
}

const FunnelStage: React.FC<FunnelStageProps> = ({ stage, onAddContact }) => {
  const [collapsed, setCollapsed] = React.useState(false);
  
  // Calcular el valor total de la etapa
  const totalValue = stage.contacts.reduce((sum, contact) => {
    return sum + (contact.value || 0);
  }, 0);
  
  // Calcular la tasa de conversión si hay contactos en la etapa
  const conversionRate = stage.contacts.length 
    ? Math.round(stage.contacts.filter(c => c.probability && c.probability > 50).length / stage.contacts.length * 100)
    : 0;
  
  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
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
            {stage.contacts.length}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {totalValue > 0 && (
            <div className="text-xs font-medium bg-white/70 px-2 py-0.5 rounded">
              {formatCurrency(totalValue, 'EUR')}
            </div>
          )}
          
          {conversionRate > 0 && (
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
            onClick={() => onAddContact && onAddContact(stage.id)}
          >
            <PlusCircle size={16} />
          </Button>
        </div>
      </div>
      
      <div 
        className={cn(
          "space-y-3 border-x border-b rounded-b-lg pb-3 transition-all",
          collapsed ? "h-0 overflow-hidden border-0 pb-0" : ""
        )}
      >
        {stage.contacts.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            No hay contactos en esta etapa
          </div>
        ) : (
          <div className="pt-3 px-3 space-y-3">
            {stage.contacts.map(contact => (
              <ContactCard key={contact.id} contact={contact} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FunnelStage;
