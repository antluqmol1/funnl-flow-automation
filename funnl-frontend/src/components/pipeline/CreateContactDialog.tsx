import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useToast } from "@/components/ui/use-toast";
import { createContact } from '@/services/supabaseService';

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
import { Loader2, Mail, Phone, Building, User } from "lucide-react";

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
  
  const onSubmit = async (data: FormValues) => {
    try {
      setLoading(true);
      
      if (!data.stageId) {
        throw new Error("La etapa es obligatoria");
      }
      
      const selectedStage = stages.find(stage => stage.id === data.stageId);
      if (!selectedStage) {
        throw new Error("Etapa seleccionada no encontrada");
      }
      
      let status: string;
      const stageName = selectedStage.name.toLowerCase();
      
      if (stageName.includes('suscriptor')) status = 'suscriptor';
      else if (stageName.includes('lead')) status = 'lead';
      else if (stageName.includes('mql')) status = 'mql';
      else if (stageName.includes('sql')) status = 'sql';
      else if (stageName.includes('oportunidad')) status = 'oportunidad';
      else if (stageName.includes('cliente')) status = 'cliente';
      else if (stageName.includes('evangelista')) status = 'evangelista';
      else status = 'otro';
      
      await createContact({
        name: data.name,
        email: data.email,
        company: data.company || 'Independiente',
        position: data.position || '',
        phone: data.phone || '',
        status: status,
        stage_id: data.stageId
      });

      toast({
        title: "Contacto creado",
        description: "El contacto ha sido creado exitosamente",
      });

      if (onOpenChange) {
        onOpenChange(false);
      }
      reset();
      
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

            <div>
              <Label htmlFor="company">Empresa</Label>
              <div className="flex items-center mt-1">
                <Building className="w-4 h-4 mr-2 text-gray-400" />
                <Input
                  id="company"
                  placeholder="Nombre de la empresa"
                  {...register('company')}
                  className="flex-1"
                />
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