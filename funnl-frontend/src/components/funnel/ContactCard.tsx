import React, { useState } from 'react';
import { Phone, Mail, MessageSquare, ChevronRight, Calendar, Clock, Tag, Users, ExternalLink, Activity, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { type Contact } from '@/services/supabaseService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface ContactCardProps {
  contact: Contact & { tasksCount?: number };
  onContactDeleted: (contactId: string) => void;
}

const ContactCard: React.FC<ContactCardProps> = ({ contact, onContactDeleted }) => {
  const [expanded, setExpanded] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const getContactValue = () => {
    if (!contact.value) return null;
    
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(contact.value);
  };
  
  const getStatusClass = () => {
    switch (contact.status) {
      case 'subscriber':
        return 'bg-slate-100 text-slate-800';
      case 'lead':
        return 'bg-yellow-100 text-yellow-800';
      case 'mql':
        return 'bg-rose-100 text-rose-800';
      case 'sql':
        return 'bg-orange-100 text-orange-800';
      case 'opportunity':
        return 'bg-indigo-100 text-indigo-800';
      case 'customer':
        return 'bg-emerald-100 text-emerald-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };
  
  const getLastContactDate = () => {
    if (!contact.last_contact) return 'Sin contacto previo';
    
    return formatDistanceToNow(new Date(contact.last_contact), { 
      addSuffix: true,
      locale: es
    });
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
      <div className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-all">
        <div className="p-3">
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={contact.avatar || undefined} alt={contact.name} />
                <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-medium text-gray-800">{contact.name}</h3>
                <p className="text-sm text-gray-600 line-clamp-1">
                  {contact.position && `${contact.position} · `}{contact.company}
                </p>
                
                <div className="flex gap-2 mt-1 flex-wrap">
                  {contact.value && (
                    <Badge variant="secondary" className="bg-funnl-soft-purple text-funnl-secondary">
                      {getContactValue()}
                    </Badge>
                  )}
                  {contact.probability && (
                    <Badge variant="outline" className="bg-gray-50">
                      {contact.probability}% Prob.
                    </Badge>
                  )}
                  <Badge className={`${getStatusClass()}`}>
                    {contact.status.charAt(0).toUpperCase() + contact.status.slice(1)}
                  </Badge>
                </div>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded(!expanded)}
              className="h-8 w-8"
            >
              <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </Button>
          </div>
          
          {expanded && (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  <span className="truncate">{contact.email}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  <span>{contact.phone || 'Sin teléfono'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{getLastContactDate()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  <span>{contact.tasksCount || 0} tareas</span>
                </div>
              </div>
              
              {contact.tags && contact.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {contact.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs px-1.5 py-0">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="border-t px-3 py-2 flex justify-between items-center bg-gray-50 rounded-b-lg">
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <a href={`tel:${contact.phone}`}>
                <Phone className="h-4 w-4 text-gray-700" />
              </a>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <a href={`mailto:${contact.email}`}>
                <Mail className="h-4 w-4 text-gray-700" />
              </a>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Users className="h-4 w-4 text-gray-700" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Calendar className="h-4 w-4 mr-2" />
                  <span>Programar tarea</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  <span>Registrar llamada</span>
                </DropdownMenuItem>
                {contact.hubspot_id && (
                  <DropdownMenuItem asChild>
                    <a href={`https://app.hubspot.com/contacts/${contact.hubspot_id}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      <span>Ver en HubSpot</span>
                    </a>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                  className="text-red-600 focus:bg-red-50 focus:text-red-700"
                  onSelect={(e) => { 
                    e.preventDefault();
                    handleDeleteClick(); 
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  <span>Eliminar contacto</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <Link to={`/contact/${contact.id}`} className="text-xs font-medium text-funnl-primary flex items-center">
            Ver detalles
            <ChevronRight className="h-3 w-3 ml-1" />
          </Link>
        </div>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el contacto 
              <strong className="px-1">{contact.name}</strong> 
              y todos sus datos asociados.
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
