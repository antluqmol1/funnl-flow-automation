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
import { Loader2, Search, Plus, X, User, Building, Briefcase, TicketIcon, ChevronsUpDown, PlusCircle } from 'lucide-react';
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import apiClient from "@/lib/axiosClient";
import { HubspotObject } from "@/types/hubspot";

// URL de la API
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Cache de búsquedas
const searchCache: Record<string, any[]> = {};

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
    // Solo buscar si el término es suficientemente largo
    if (searchTerm.length < 2) {
      // Opcional: limpiar resultados si el término es muy corto
      // setObjects([]); 
      return; 
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    const cacheKey = `${objectType}:${searchTerm.toLowerCase()}`;
    if (searchCache[cacheKey]) {
      setObjects(searchCache[cacheKey]);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      // Llamar a la búsqueda directamente
      searchObjects(searchTerm);
    }, 300); // Aumentado ligeramente el debounce para no saturar

    // Limpieza del timeout
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  // Dependencias simplificadas
  }, [searchTerm, objectType]); 
  
  // Abrir automáticamente el popover cuando se enfoca el botón
  const handleButtonFocus = () => {
    if (!open /* && isConnectionChecked && isHubspotConnected */) { // Chequeos eliminados
      setOpen(true);
    }
  };

  const searchObjects = async (query: string) => {
    if (query.length < 2) return; 

    const cacheKey = `${objectType}:${query.toLowerCase()}`;
    if (searchCache[cacheKey]) {
      setObjects(searchCache[cacheKey]);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    // --- MODIFICADO: Determinar API URL y función de transformación ---
    let apiUrl = '';
    let transformFunction = (item: any): HubspotObject => ({ 
        id: item.id, 
        name: 'Objeto Desconocido', 
        type: objectType,
        properties: item.properties // Incluir propiedades siempre
    });

    switch (objectType) {
      case 'contact':
        apiUrl = '/api/hubspot/contacts/search';
        transformFunction = (item: any) => ({
          id: item.id,
          name: `${item.properties?.firstname || ''} ${item.properties?.lastname || ''}`.trim() || 'Contacto sin nombre',
          type: 'contact',
          properties: item.properties 
        });
        break;
      case 'company':
        apiUrl = '/api/hubspot/companies/search'; // Endpoint para empresas
        transformFunction = (item: any) => ({
          id: item.id,
          name: item.properties?.name || 'Empresa sin nombre', // Usar propiedad name
          type: 'company',
          properties: item.properties
        });
        break;
      // Añadir casos para 'deal' y 'ticket' si es necesario
      // case 'deal':
      //   apiUrl = '/api/hubspot/deals/search';
      //   transformFunction = (item: any) => ({ /* ... */ });
      //   break;
      // case 'ticket':
      //   apiUrl = '/api/hubspot/tickets/search';
      //   transformFunction = (item: any) => ({ /* ... */ });
      //   break;
      default:
        console.error(`Tipo de objeto no soportado para búsqueda: ${objectType}`);
        setError(`Tipo de objeto no soportado: ${objectType}`);
        setIsLoading(false);
        return;
    }
    // --- FIN MODIFICADO ---

    try {
      // --- MODIFICADO: Usar apiUrl dinámica ---
      console.log(`[HubspotObjectSelector] Searching ${objectType} with query "${query}" at ${apiUrl}`);
      const response = await apiClient.post<{ 
        success: boolean; 
        // Asumir la misma estructura de respuesta { data: { results: [...] } }
        data: { total: number; results: any[] } 
      }>(apiUrl, { // Solo enviar searchTerm según las rutas del backend
        searchTerm: query 
      });
      
      // Extraer resultados (asumiendo la estructura anidada)
      const rawResults = response.data?.data?.results || []; 
      console.log(`[HubspotObjectSelector] Raw ${objectType} results:`, rawResults);

      // --- MODIFICADO: Usar transformFunction dinámica ---
      const transformedResults: HubspotObject[] = rawResults.map(transformFunction);

      console.log(`[HubspotObjectSelector] Transformed ${objectType} results:`, transformedResults);

      searchCache[cacheKey] = transformedResults;
      setObjects(transformedResults);

    } catch (err: any) {
      console.error(`Error searching HubSpot ${objectType}:`, err);
      const errorMessage = err.response?.data?.message || err.response?.data?.detail || err.message || `Error buscando ${getTypeLabel(objectType)}`;
      setError(errorMessage);
      toast({ variant: "destructive", title: "Error de Búsqueda", description: errorMessage });
      setObjects([]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const handleSelect = (object: HubspotObject) => {
    console.log('[HubspotObjectSelector] handleSelect called with:', object);
    onSelect(object);
    setOpen(false);
    setSearchTerm('');
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

  // Obtener nombre y botón para mostrar
  const selectedObjectName = selectedObject?.name || null;
  const displayButtonText = selectedObjectName ? selectedObjectName : `Seleccionar ${getTypeLabel(objectType)}...`;

  return (
    <div className="flex items-center space-x-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[200px] justify-between"
            onFocus={handleButtonFocus}
          >
            {selectedObject ? (
              <>
                {getTypeIcon(selectedObject.type)}
                <span className="truncate">{selectedObject.name}</span>
              </>
            ) : (
              `Seleccionar ${getTypeLabel(objectType)}...`
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0">
          <Command shouldFilter={false}>
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <CommandInput 
                ref={inputRef}
                placeholder={`Buscar ${getTypeLabel(objectType)}...`}
                value={searchTerm}
                onValueChange={handleInputChange}
                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0 focus:ring-0"
              />
              {(isLoading || isTyping) && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
            </div>
            <CommandList>
              {error && <CommandEmpty>{error}</CommandEmpty>}
              {!isLoading && !error && objects.length === 0 && searchTerm.length >= 2 && (
                 <CommandEmpty>No se encontraron resultados.</CommandEmpty>
              )}
              {!error && objects.length === 0 && searchTerm.length < 2 && (
                <CommandEmpty>Escribe para buscar...</CommandEmpty>
              )}
              {!error && objects.length > 0 && (
                <CommandGroup>
                  {objects.map((object) => (
                    <CommandItem
                      key={object.id}
                      value={object.name} 
                      onSelect={() => handleSelect(object)}
                      className="flex items-center justify-between"
                    >
                      <span className="flex items-center truncate">
                        {getTypeIcon(object.type)}
                        {object.name}
                      </span>
                      {/* --- MODIFICADO: Mostrar info relevante según el tipo --- */}
                      {object.type === 'contact' && object.properties?.email && <Badge variant="outline" className="ml-2 text-xs">{object.properties.email}</Badge>}
                      {object.type === 'company' && object.properties?.domain && <Badge variant="outline" className="ml-2 text-xs">{object.properties.domain}</Badge>}
                      {/* Añadir más casos si es necesario */}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
          {onCreate && (
            <div className="p-2 border-t">
              <Button variant="ghost" className="w-full justify-start" onClick={() => { onCreate(); setOpen(false); }}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Crear nuevo {getTypeLabel(objectType)}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {selectedObject && (
        <Button variant="ghost" size="sm" onClick={clearSelection} className="text-muted-foreground">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}