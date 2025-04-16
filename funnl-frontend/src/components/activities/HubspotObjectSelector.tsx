import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { Loader2, Search, Plus, X, User, Building, Briefcase, TicketIcon } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

// URL de la API
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Cache de búsquedas
const searchCache: Record<string, any[]> = {};

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
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [objects, setObjects] = useState<HubspotObject[]>([]);
  const [isConnectionChecked, setIsConnectionChecked] = useState(false);
  const [isHubspotConnected, setIsHubspotConnected] = useState(false);
  const { toast } = useToast();
  
  // Referencias para los timeouts
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Cuando se abre el selector, enfocar automáticamente el input
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Mantener la referencia al estado de apertura para el efecto de foco
  const wasOpen = useRef(open);

  // Al cambiar el estado de apertura, enfocar el input
  useEffect(() => {
    if (open && !wasOpen.current) {
      // Retrasamos ligeramente para permitir que el DOM se actualice
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
    wasOpen.current = open;
  }, [open]);

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

  // Manejar cambios en el input
  const handleInputChange = (value: string) => {
    setSearchTerm(value);
    setIsTyping(true);
    
    // Limpiar el timeout de escritura anterior
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Establecer un timeout corto para el indicador de escritura
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 500);
    
    // Verificar si el término ya está en caché
    const cacheKey = `${objectType}:${value.toLowerCase()}`;
    if (value.length >= 2 && searchCache[cacheKey]) {
      setObjects(searchCache[cacheKey]);
      return;
    }
  };

  // Buscar objetos cuando cambia el término de búsqueda (con debounce)
  useEffect(() => {
    if (!isHubspotConnected || searchTerm.length < 2) return;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Verificar en caché antes de realizar la búsqueda
    const cacheKey = `${objectType}:${searchTerm.toLowerCase()}`;
    if (searchCache[cacheKey]) {
      setObjects(searchCache[cacheKey]);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchObjects(searchTerm);
    }, 150); // Reducido a 150ms para mayor respuesta

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [searchTerm, isHubspotConnected, objectType]);
  
  // Abrir automáticamente el popover cuando se enfoca el botón
  const handleButtonFocus = () => {
    if (!open && isConnectionChecked && isHubspotConnected) {
      setOpen(true);
    }
  };

  const searchObjects = async (query: string) => {
    if (!isHubspotConnected || query.length < 2) return;
    
    const cacheKey = `${objectType}:${query.toLowerCase()}`;
    if (searchCache[cacheKey]) {
      setObjects(searchCache[cacheKey]);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');
      
      // Endpoint personalizado para buscar objetos en HubSpot
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
      const results = data.results || [];
      
      // Guardar en caché para futuras búsquedas
      searchCache[cacheKey] = results;
      
      // También almacenar resultados parciales si hay suficientes
      if (results.length > 0 && query.length >= 3) {
        const terms = query.toLowerCase().split(/\s+/);
        terms.forEach(term => {
          if (term.length >= 2) {
            const partialCacheKey = `${objectType}:${term}`;
            // Solo almacenar si no existe o si tiene menos resultados
            if (!searchCache[partialCacheKey] || searchCache[partialCacheKey].length < results.length) {
              searchCache[partialCacheKey] = results;
            }
          }
        });
      }
      
      setObjects(results);
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
      setIsTyping(false);
    }
  };

  const handleSelect = (object: HubspotObject) => {
    onSelect(object);
    setOpen(false);
    setSearchTerm(''); // Limpiar búsqueda al seleccionar
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
  
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deal': return <Briefcase className="h-3 w-3 mr-1" />;
      case 'ticket': return <TicketIcon className="h-3 w-3 mr-1" />;
      case 'contact': return <User className="h-3 w-3 mr-1" />;
      case 'company': return <Building className="h-3 w-3 mr-1" />;
      default: return null;
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
            {getTypeIcon(selectedObject.type)}
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
              onFocus={handleButtonFocus}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              <span>Buscar {getTypeLabel(objectType).toLowerCase()} en HubSpot...</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0" align="start" alignOffset={-5} style={{ width: "300px", maxHeight: "400px" }}>
            <Command shouldFilter={false}>
              <div className="relative">
                <CommandInput 
                  ref={inputRef}
                  placeholder={`Buscar ${getTypeLabel(objectType).toLowerCase()}...`} 
                  value={searchTerm}
                  onValueChange={handleInputChange}
                  className="pr-8"
                />
                {isTyping && (
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                )}
              </div>
              
              {searchTerm.length === 1 && (
                <div className="px-4 py-2 text-xs text-gray-500">
                  Escribe al menos 2 caracteres para buscar...
                </div>
              )}
              
              <CommandList>
                <CommandEmpty>
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-6">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500">Buscando en HubSpot...</p>
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
                
                {objects.length > 0 && (
                  <CommandGroup heading={`Resultados para ${getTypeLabel(objectType)}`}>
                    {objects.map((obj) => (
                      <CommandItem 
                        key={obj.id}
                        onSelect={() => handleSelect(obj)}
                        className="flex items-start gap-2 cursor-pointer hover:bg-gray-100 transition-colors p-2"
                      >
                        <div className="flex-1 overflow-hidden">
                          <div className="font-medium flex items-center truncate">
                            {getTypeIcon(obj.type)}
                            {obj.name}
                          </div>
                          {obj.properties?.email && (
                            <div className="text-xs text-gray-500 truncate">{obj.properties.email}</div>
                          )}
                          {obj.properties?.phone && (
                            <div className="text-xs text-gray-500 truncate">{obj.properties.phone}</div>
                          )}
                          {obj.properties?.amount && (
                            <div className="text-xs text-gray-500 truncate">{obj.properties.amount}</div>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
} 