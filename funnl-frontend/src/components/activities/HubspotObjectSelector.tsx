import React, { useState, useEffect } from 'react';
import { 
  Command, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList 
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, Search, Plus, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

// URL de la API
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface HubspotObject {
  id: string;
  name: string;
  type: 'deal' | 'ticket' | 'contact' | 'company';
  properties?: Record<string, string>;
}

interface HubspotObjectSelectorProps {
  objectType: 'deal' | 'ticket' | 'contact' | 'company';
  onSelect: (object: HubspotObject | null) => void;
  selectedObject?: HubspotObject | null;
  onCreate?: () => void; // Callback opcional para crear nuevo objeto
}

export default function HubspotObjectSelector({
  objectType,
  onSelect,
  selectedObject,
  onCreate
}: HubspotObjectSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [objects, setObjects] = useState<HubspotObject[]>([]);
  const [isConnectionChecked, setIsConnectionChecked] = useState(false);
  const [isHubspotConnected, setIsHubspotConnected] = useState(false);
  const { toast } = useToast();

  // Verificar si HubSpot está conectado al montar el componente
  useEffect(() => {
    const checkHubspotConnection = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setIsHubspotConnected(false);
          setIsConnectionChecked(true);
          return;
        }

        const response = await fetch(`${API_URL}/hubspot/status`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          setIsHubspotConnected(false);
          setIsConnectionChecked(true);
          return;
        }

        const data = await response.json();
        setIsHubspotConnected(data.connected);
        setIsConnectionChecked(true);
      } catch (err) {
        console.error('Error checking HubSpot connection:', err);
        setIsHubspotConnected(false);
        setIsConnectionChecked(true);
      }
    };

    if (!isConnectionChecked) {
      checkHubspotConnection();
    }
  }, [isConnectionChecked]);

  // Buscar objetos cuando se abre el popover o cambia el término de búsqueda
  useEffect(() => {
    if (open && isHubspotConnected && searchTerm.length >= 2) {
      searchObjects(searchTerm);
    }
  }, [open, searchTerm, isHubspotConnected]);

  const searchObjects = async (query: string) => {
    if (!isHubspotConnected || query.length < 2) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');
      
      // Endpoint personalizado para buscar objetos en HubSpot (necesitarías implementarlo en el backend)
      const response = await fetch(`${API_URL}/hubspot/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: objectType,
          query: query
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error buscando en HubSpot: ${response.statusText}`);
      }
      
      const data = await response.json();
      setObjects(data.results || []);
    } catch (err) {
      console.error('Error searching HubSpot objects:', err);
      setError(err instanceof Error ? err.message : 'Error buscando objetos');
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudieron cargar los objetos de HubSpot"
      });
      setObjects([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (object: HubspotObject) => {
    onSelect(object);
    setOpen(false);
  };

  const clearSelection = () => {
    onSelect(null);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'deal': return 'Deal';
      case 'ticket': return 'Ticket';
      case 'contact': return 'Contacto';
      case 'company': return 'Empresa';
      default: return type;
    }
  };

  // Si no hay conexión a HubSpot, mostrar botón de conectar
  if (isConnectionChecked && !isHubspotConnected) {
    return (
      <div className="space-y-2">
        <Button 
          variant="outline" 
          className="w-full text-orange-600 border-orange-200"
          onClick={() => {
            // Redirigir a la página de configuración de HubSpot
            window.location.href = '/settings';
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Conectar con HubSpot primero
        </Button>
        <p className="text-xs text-gray-500">
          Para vincular tareas con objetos de HubSpot, primero debes conectar tu cuenta en Configuración.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      {/* Mostrar el objeto seleccionado o el selector */}
      {selectedObject ? (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <span className="text-sm font-medium">{getTypeLabel(selectedObject.type)}:</span>
            <span className="text-sm">{selectedObject.name}</span>
          </Badge>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearSelection}
            className="h-6 w-6 p-0 text-gray-400"
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Quitar</span>
          </Button>
        </div>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full justify-start text-left font-normal"
              disabled={!isConnectionChecked || isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              <span>Buscar en HubSpot...</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0" align="start" alignOffset={-5} style={{ width: "300px", maxHeight: "400px" }}>
            <Command>
              <CommandInput 
                placeholder={`Buscar ${getTypeLabel(objectType).toLowerCase()}...`} 
                value={searchTerm}
                onValueChange={setSearchTerm}
              />
              <CommandList>
                <CommandEmpty>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <>
                      <p className="py-3 text-center text-sm">No se encontraron resultados.</p>
                      {onCreate && (
                        <Button 
                          variant="link" 
                          className="w-full justify-center" 
                          onClick={() => {
                            setOpen(false);
                            onCreate();
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Crear nuevo
                        </Button>
                      )}
                    </>
                  )}
                </CommandEmpty>
                <CommandGroup heading={`Resultados para ${getTypeLabel(objectType)}`}>
                  {objects.map((obj) => (
                    <CommandItem 
                      key={obj.id}
                      onSelect={() => handleSelect(obj)}
                      className="flex items-center"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{obj.name}</span>
                        {obj.properties?.email && (
                          <span className="text-xs text-gray-500">{obj.properties.email}</span>
                        )}
                        {obj.properties?.company && (
                          <span className="text-xs text-gray-500">{obj.properties.company}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
      
      {/* Mostrar error si existe */}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
} 