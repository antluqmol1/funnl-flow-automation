import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useToast } from "@/components/ui/use-toast";
import { createDeal } from '@/services/supabaseService';

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
import { Loader2 } from "lucide-react";

interface Stage {
  id: string;
  name: string;
}

interface FormValues {
  title: string;
  company: string;
  description?: string;
  value?: string;
  probability?: string;
  expected_close_date?: string;
  stageId: string;
  contact_id?: string;
}

interface CreateDealDialogProps {
  stages: Stage[];
  pipelineId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onDealCreated?: () => void;
}

export default function CreateDealDialog({ 
  stages, 
  pipelineId, 
  open = false, 
  onOpenChange, 
  onDealCreated 
}: CreateDealDialogProps) {
  const [loading, setLoading] = React.useState(false);
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
      
      await createDeal({
        title: data.title,
        company: data.company,
        description: data.description || null,
        stage_id: data.stageId,
        value: data.value ? parseInt(data.value) : null,
        probability: data.probability ? parseInt(data.probability) : null,
        expected_close_date: data.expected_close_date || null,
        contact_id: data.contact_id || null,
        currency: 'EUR',
        owner_id: null,
        tags: [],
        status: 'active',
      });

      toast({
        title: "Deal creado",
        description: "El deal ha sido creado exitosamente",
      });

      if (onOpenChange) {
        onOpenChange(false);
      }
      reset();
      
      if (onDealCreated) {
        onDealCreated();
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Hubo un error al crear el deal",
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
          <Button variant="default">Nuevo Deal</Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Crear nuevo deal</DialogTitle>
          <DialogDescription>
            Completa la información para crear un nuevo deal.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                placeholder="Ej. Proyecto de Website"
                {...register('title', {
                  required: 'El título es obligatorio',
                })}
                className="mt-1"
              />
              {errors.title && (
                <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="company">Empresa *</Label>
              <Input
                id="company"
                placeholder="Nombre de la empresa"
                {...register('company', { required: 'La empresa es obligatoria' })}
                className="mt-1"
              />
              {errors.company && (
                <p className="text-xs text-red-500 mt-1">{errors.company.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                placeholder="Describe el deal"
                {...register('description')}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="value">Valor</Label>
                <Input
                  id="value"
                  type="number"
                  placeholder="Ej. 5000"
                  {...register('value')}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="probability">Probabilidad (%)</Label>
                <Input
                  id="probability"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Ej. 75"
                  {...register('probability')}
                  className="mt-1"
                />
              </div>
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

            <div>
              <Label htmlFor="expected_close_date">Fecha estimada de cierre</Label>
              <Input
                id="expected_close_date"
                type="date"
                {...register('expected_close_date')}
                className="mt-1"
              />
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
                "Crear Deal"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 