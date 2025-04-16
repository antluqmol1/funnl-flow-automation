import React, { useState } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Mail, Phone, User, Building, Calendar, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Contact {
  id: string;
  name?: string;
  title?: string; // Para compatibilidad con Deal
  company?: string;
  position?: string;
  email?: string;
  phone?: string;
  avatar?: string | null;
  last_contact?: string | null;
  expected_close_date?: string | null; // Para compatibilidad con Deal
}

interface ContactCardProps {
  contact: Contact;
  index: number;
  stageId: string;
  stageColor: string | null;
}

const ContactCard: React.FC<ContactCardProps> = ({ contact, index, stageId, stageColor }) => {
  const [showActions, setShowActions] = useState(false);
  const { toast } = useToast();

  // Compatibilidad entre Contact y Deal
  const displayName = contact.name || contact.title || "Sin nombre";
  const displayDate = contact.last_contact || contact.expected_close_date;
  
  const formattedLastContact = displayDate
    ? new Date(displayDate).toLocaleDateString('es-ES')
    : null;

  const getInitials = (name: string) => {
    if (!name) return "??";
    
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const handleSyncWithHubspot = (e: React.MouseEvent) => {
    e.stopPropagation(); // Evitar propagar el evento al Draggable
    
    toast({
      title: "Sincronizando",
      description: "Sincronizando contacto con HubSpot...",
      duration: 3000,
    });
    
    // Aquí iría la llamada a la API para sincronizar el contacto
    setTimeout(() => {
      toast({
        title: "Éxito",
        description: "Contacto sincronizado con HubSpot correctamente",
      });
    }, 1500);
  };

  return (
    <Draggable draggableId={contact.id} index={index}>
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
              <div className="mb-2 flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={contact.avatar || undefined} alt={displayName} />
                    <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-medium text-gray-800 text-sm">{displayName}</h3>
                    {contact.position && (
                      <p className="text-xs text-gray-500">{contact.position}</p>
                    )}
                  </div>
                </div>
                
                {showActions && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6" 
                          onClick={handleSyncWithHubspot}
                        >
                          <RefreshCw size={14} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Sincronizar con HubSpot</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-1">
                {contact.company && (
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <Building size={12} className="text-green-600" />
                    <span className="truncate">{contact.company}</span>
                  </div>
                )}
                
                {contact.email && (
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <Mail size={12} className="text-blue-600" />
                    <span className="truncate">{contact.email}</span>
                  </div>
                )}
                
                {contact.phone && (
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <Phone size={12} className="text-purple-600" />
                    <span>{contact.phone}</span>
                  </div>
                )}
                
                {formattedLastContact && (
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <Calendar size={12} className="text-orange-600" />
                    <span>{formattedLastContact}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Draggable>
  );
};

export default ContactCard; 