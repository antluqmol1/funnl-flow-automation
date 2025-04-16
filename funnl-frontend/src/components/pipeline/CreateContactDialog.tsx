import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useToast } from "@/components/ui/use-toast";
import { createContact, searchHubspotCompanies } from '@/services/supabaseService';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Loader2, Mail, Phone, Building, User, Search, Plus } from "lucide-react";

// Cache para almacenar resultados de búsqueda
const searchCache: Record<string, any[]> = {};

interface Stage {
  id: string;
  name: string;
}

interface FormValues {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  position?: string;
  stageId: string;
  notes?: string;
}

interface CreateContactDialogProps {
  stages: Stage[];
  pipelineId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onContactCreated?: () => void;
}

export default function CreateContactDialog({ 
  stages, 
  pipelineId, 
  open = false, 
  onOpenChange, 
  onContactCreated 
}: CreateContactDialogProps) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset, formState: { errors }, setValue, watch } = useForm<FormValues>({
    defaultValues: {
      stageId: ''
    }
  });
  const { toast } = useToast();
  
  const selectedStageId = watch('stageId');
  const companyValue = watch('company') || '';
  
  // Estados para la búsqueda de empresas
  const [hubspotCompanies, setHubspotCompanies] = useState<any[]>([]);
  const [isSearchingCompanies, setIsSearchingCompanies] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [companyPopoverOpen, setCompanyPopoverOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [companySearchQuery, setCompanySearchQuery] = useState<string>('');
  
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Enfoque automático al abrir el popover
  useEffect(() => {
    if (companyPopoverOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [companyPopoverOpen]);

  // Handler para los cambios en el input de búsqueda
  const handleCompanySearchChange = (value: string) => {
    setValue('company', value);
    setCompanySearchQuery(value);
    setIsTyping(true);
    
    // Limpiar el timeout de escritura anterior
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Establecer un timeout corto para el indicador de escritura
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 500);
    
    // Verificar si el término ya está en caché para respuesta inmediata
    if (value.length >= 2 && searchCache[value.toLowerCase()]) {
      setHubspotCompanies(searchCache[value.toLowerCase()]);
      return;
    }
  };

  // Efecto para manejar la búsqueda de empresas con debounce
  useEffect(() => {
    if (companySearchQuery.length < 2) return;
    
    // Verificar primero la caché
    const cacheKey = companySearchQuery.toLowerCase();
    if (searchCache[cacheKey]) {
      setHubspotCompanies(searchCache[cacheKey]);
      return;
    }
    
    // Limpiamos el timeout anterior si existe
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Creamos un nuevo timeout para realizar la búsqueda
    searchTimeoutRef.current = setTimeout(() => {
      setIsSearchingCompanies(true);
      searchHubspotCompanies(companySearchQuery)
        .then(result => {
          if (result.results) {
            const companies = result.results;
            
            // Guardar en caché para búsquedas futuras
            searchCache[cacheKey] = companies;
            
            // También almacenar resultados parciales si hay suficientes
            if (companies.length > 0 && companySearchQuery.length >= 3) {
              const terms = companySearchQuery.toLowerCase().split(/\s+/);
              terms.forEach(term => {
                if (term.length >= 2) {
                  // Solo almacenar si no existe o si tiene menos resultados
                  if (!searchCache[term] || searchCache[term].length < companies.length) {
                    searchCache[term] = companies;
                  }
                }
              });
            }
            
            setHubspotCompanies(companies);
          }
        })
        .catch(error => {
          console.error('Error buscando empresas:', error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "No se pudieron cargar las empresas de HubSpot"
          });
        })
        .finally(() => {
          setIsSearchingCompanies(false);
          setIsTyping(false);
        });
    }, 150); // Reducido a 150ms para mejor fluidez

    // Cleanup del efecto
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [companySearchQuery, toast]);

  const selectCompany = (company: any) => {
    setValue('company', company.name);
    setSelectedCompany(company.name);
    setSelectedCompanyId(company.id);
    setCompanySearchQuery(company.name);
    setCompanyPopoverOpen(false);
  };

  const onSubmit = async (data: FormValues) => {
    try {
      setLoading(true);
      
      if (!data.stageId) {
        throw new Error("La etapa es obligatoria");
      }
      
      // Encontrar la etapa seleccionada para obtener su nombre
      const selectedStage = stages.find(stage => stage.id === data.stageId);
      if (!selectedStage) {
        throw new Error("Etapa seleccionada no encontrada");
      }
      
      // Mapear el nombre de la etapa al valor correcto de status según la nueva restricción
      let status: string;
      const stageName = selectedStage.name.toLowerCase();
      
      // Mapeo directo con los nuevos valores permitidos
      if (stageName.includes('suscriptor')) {
        status = 'suscriptor';
      } else if (stageName.includes('lead')) {
        status = 'lead';
      } else if (stageName.includes('mql')) {
        status = 'mql';
      } else if (stageName.includes('sql')) {
        status = 'sql';
      } else if (stageName.includes('oportunidad')) {
        status = 'oportunidad';
      } else if (stageName.includes('cliente')) {
        status = 'cliente';
      } else if (stageName.includes('evangelista')) {
        status = 'evangelista';
      } else {
        status = 'otro';
      }
      
      // Creamos el contacto con los datos del formulario
      await createContact({
        name: data.name,
        email: data.email,
        company: selectedCompany || data.company || 'Independiente',
        position: data.position || '',
        phone: data.phone || '',
        status: status, // Usamos el status mapeado correctamente
        hubspot_company_id: selectedCompanyId, // Añadimos el ID de la empresa de HubSpot si fue seleccionada
        stage_id: data.stageId // Pasamos el ID de la etapa para asociarlo al pipeline
      });

      toast({
        title: "Contacto creado",
        description: "El contacto ha sido creado exitosamente",
      });

      if (onOpenChange) {
        onOpenChange(false);
      }
      reset();
      setCompanySearchQuery('');
      setSelectedCompany(null);
      setSelectedCompanyId(null);
      setHubspotCompanies([]);
      
      if (onContactCreated) {
        onContactCreated();
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Hubo un error al crear el contacto",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStageChange = (value: string) => {
    setValue('stageId', value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!onOpenChange && (
        <DialogTrigger asChild>
          <Button variant="default">Nuevo Contacto</Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Crear nuevo contacto</DialogTitle>
          <DialogDescription>
            Completa la información para crear un nuevo contacto.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="name">Nombre *</Label>
              <div className="flex items-center mt-1">
                <User className="w-4 h-4 mr-2 text-gray-400" />
                <Input
                  id="name"
                  placeholder="Nombre completo"
                  {...register('name', {
                    required: 'El nombre es obligatorio',
                  })}
                  className="flex-1"
                />
              </div>
              {errors.name && (
                <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <div className="flex items-center mt-1">
                <Mail className="w-4 h-4 mr-2 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  {...register('email', {
                    required: 'El email es obligatorio',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Email inválido',
                    },
                  })}
                  className="flex-1"
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="phone">Teléfono</Label>
              <div className="flex items-center mt-1">
                <Phone className="w-4 h-4 mr-2 text-gray-400" />
                <Input
                  id="phone"
                  placeholder="+34 666 123 456"
                  {...register('phone')}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="company">Empresa</Label>
              <div className="flex flex-col space-y-2">
                <Popover open={companyPopoverOpen} onOpenChange={setCompanyPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="justify-between w-full"
                    >
                      <div className="flex items-center">
                        <Building className="w-4 h-4 mr-2 text-gray-400" />
                        <span>{selectedCompany || companyValue || "Seleccionar empresa"}</span>
                      </div>
                      {isSearchingCompanies ? (
                        <Loader2 className="ml-2 h-4 w-4 shrink-0 opacity-50 animate-spin" />
                      ) : (
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command shouldFilter={false}>
                      <div className="relative">
                        <CommandInput 
                          ref={inputRef}
                          placeholder="Buscar empresa..." 
                          onValueChange={handleCompanySearchChange}
                          value={companySearchQuery}
                          className="pr-8"
                        />
                        {isTyping && (
                          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                          </div>
                        )}
                      </div>
                      
                      {companySearchQuery.length === 1 && (
                        <div className="px-4 py-2 text-xs text-gray-500">
                          Escribe al menos 2 caracteres para buscar...
                        </div>
                      )}
                      
                      <CommandList>
                        <CommandEmpty>
                          {isSearchingCompanies ? (
                            <div className="flex flex-col items-center justify-center py-6">
                              <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-2" />
                              <span className="text-sm text-gray-500">Buscando empresas...</span>
                            </div>
                          ) : companySearchQuery.length >= 2 ? (
                            <div className="py-4 text-center">
                              <p className="text-sm">No se encontraron empresas.</p>
                              <p className="text-xs text-gray-500 mt-1">Puedes usar "{companySearchQuery}" como nombre de empresa.</p>
                            </div>
                          ) : companySearchQuery.length > 0 ? (
                            <div className="px-4 py-3 text-xs text-gray-500">
                              Escribe al menos 2 caracteres para buscar empresas en HubSpot
                            </div>
                          ) : (
                            <div className="px-4 py-3 text-xs text-gray-500">
                              Escribe para buscar empresas en HubSpot
                            </div>
                          )}
                        </CommandEmpty>
                        
                        {hubspotCompanies.length > 0 && (
                          <CommandGroup heading="Empresas">
                            {hubspotCompanies.map((company) => (
                              <CommandItem
                                key={company.id}
                                onSelect={() => selectCompany(company)}
                                className="flex items-start gap-2 cursor-pointer hover:bg-gray-100 transition-colors p-2"
                              >
                                <div className="flex-1 overflow-hidden">
                                  <div className="font-medium flex items-center truncate">
                                    <Building className="h-3 w-3 mr-1 text-gray-500" />
                                    {company.name}
                                  </div>
                                  {company.properties?.domain && (
                                    <div className="text-xs text-gray-500 truncate">
                                      {company.properties.domain}
                                    </div>
                                  )}
                                  {company.properties?.city && company.properties?.country && (
                                    <div className="text-xs text-gray-500 truncate">
                                      {company.properties.city}, {company.properties.country}
                                    </div>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                        
                        <CommandGroup>
                          <CommandItem 
                            onSelect={() => {
                              setSelectedCompany(null);
                              setSelectedCompanyId(null);
                              setCompanyPopoverOpen(false);
                            }}
                            className="flex items-center text-blue-600 hover:bg-blue-50"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Usar "{companySearchQuery || 'Nombre personalizado'}"
                          </CommandItem>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {!selectedCompany && (
                  <Input
                    id="company"
                    {...register('company')}
                    placeholder="Nombre de la empresa"
                    className="hidden"
                  />
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="position">Puesto</Label>
              <Input
                id="position"
                placeholder="Ej. Marketing Manager"
                {...register('position')}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                placeholder="Añade notas adicionales sobre este contacto"
                {...register('notes')}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="stageId">Etapa *</Label>
              <Select 
                value={selectedStageId} 
                onValueChange={handleStageChange}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecciona una etapa" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input 
                type="hidden" 
                {...register('stageId', { required: 'La etapa es obligatoria' })} 
              />
              {errors.stageId && (
                <p className="text-xs text-red-500 mt-1">{errors.stageId.message}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange && onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear Contacto"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 