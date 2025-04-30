import React, { useState } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import DealCard from './DealCard';
import ContactCard from './ContactCard';
import { PlusCircle, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Deal {
  id: string;
  title: string;
  company: string;
  value: number | null;
  owner_id: string | null;
  probability: number | null;
  expected_close_date: string | null;
}

interface Contact {
  id: string;
  name: string;
  company: string;
  position: string;
  email: string;
  phone: string;
  avatar: string | null;
  last_contact: string | null;
}

interface Stage {
  id: string;
  name: string;
  position: number;
  color: string | null;
  description: string | null;
  items: (Deal | Contact)[];
}

interface PipelineColumnProps {
  stage: Stage;
  pipelineId: string;
  isContactPipeline?: boolean;
  onContactDeleted: (contactId: string) => void;
}

const PipelineColumn: React.FC<PipelineColumnProps> = ({ 
  stage, 
  pipelineId,
  isContactPipeline = false,
  onContactDeleted
}) => {
  return (
    <div className="flex-shrink-0 w-72">
      {/* Column Header */}
      <div 
        className="mb-3 flex justify-between items-center"
        style={{
          borderBottom: stage.color ? `2px solid ${stage.color}` : '2px solid #e5e7eb'
        }}
      >
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-gray-800">{stage.name}</h3>
          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
            {stage.items.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {stage.description && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-gray-400 hover:text-gray-600">
                    <Info size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{stage.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <button
            className="text-gray-400 hover:text-gray-600"
            title={isContactPipeline ? "Añadir contacto a esta etapa" : "Añadir deal a esta etapa"}
          >
            <PlusCircle size={16} />
          </button>
        </div>
      </div>
      
      {/* Column Content */}
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`min-h-[100px] rounded-lg transition-colors ${
              snapshot.isDraggingOver ? 'bg-gray-50' : ''
            }`}
          >
            {stage.items.length > 0 ? (
              <div className="space-y-3">
                {stage.items.map((item, index) => (
                  isContactPipeline ? (
                    <ContactCard 
                      key={item.id} 
                      contact={item as Contact} 
                      index={index} 
                      stageId={stage.id}
                      stageColor={stage.color}
                      onContactDeleted={onContactDeleted}
                    />
                  ) : (
                    <DealCard 
                      key={item.id} 
                      deal={item as Deal} 
                      index={index} 
                      stageId={stage.id}
                      stageColor={stage.color}
                      isDraggable={true}
                    />
                  )
                ))}
              </div>
            ) : (
              <div className="p-2 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">
                {isContactPipeline ? "Arrastra contactos aquí" : "Arrastra deals aquí"}
              </div>
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};

export default PipelineColumn; 