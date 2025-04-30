import React, { useState } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Mail, Phone, User, Building, Calendar, RefreshCw, MoreHorizontal, Trash2 } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link } from 'react-router-dom';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";

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
  onContactDeleted: (contactId: string) => void;
}

const ContactCard: React.FC<ContactCardProps> = ({ contact, index, stageId, stageColor, onContactDeleted }) => {
  const [showActions, setShowActions] = useState(false);
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

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

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    onContactDeleted(contact.id);
    setIsDeleteDialogOpen(false);
  };

  return (
    <>
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
              <CardHeader className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={contact.avatar || undefined} alt={displayName} />
                      <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                    </Avatar>
                    <CardTitle className="text-sm font-medium truncate">{displayName}</CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to={`/contact/${contact.id}`} className="flex items-center">
                          <User className="h-4 w-4 mr-2" /> Ver Detalles
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-red-600 focus:bg-red-50 focus:text-red-700"
                        onSelect={(e) => { 
                          e.preventDefault(); 
                          handleDeleteClick(); 
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        <span>Eliminar Contacto</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="p-3 text-xs text-gray-600 space-y-1">
                {contact.company && (
                  <div className="flex items-center gap-1.5">
                    <Building className="h-3 w-3" />
                    <span className="truncate">{contact.company}</span>
                  </div>
                )}
                {contact.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{contact.email}</span>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3" />
                    <span>{contact.phone}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </Draggable>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el contacto 
              <strong className="px-1">{contact.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ContactCard; 