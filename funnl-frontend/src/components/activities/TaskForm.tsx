import React, { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { type Task } from '@/services/supabaseService';
import { useCreateTaskMutation, useUpdateTaskMutation } from '@/hooks/useTasks';
import { useToast } from '@/components/ui/use-toast';
import HubspotObjectSelector from "./HubspotObjectSelector";

interface TaskFormProps {
  task?: Task;
  onComplete?: () => void;
}

const taskSchema = z.object({
  title: z.string().min(3, 'El título debe tener al menos 3 caracteres'),
  type: z.enum(['call', 'email', 'meeting', 'follow-up', 'other']),
  time: z.string(),
  contact_id: z.string().nullable(),
  status: z.enum(['pending', 'completed', 'overdue']),
  priority: z.enum(['high', 'medium', 'low']),
  // Campos de HubSpot
  hubspot_id: z.string().nullable().optional(),
  hubspot_type: z.enum(['deal', 'ticket', 'contact', 'company']).nullable().optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

const TaskForm: React.FC<TaskFormProps> = ({ task, onComplete }) => {
  const { toast } = useToast();
  
  const createTaskMutation = useCreateTaskMutation();
  const updateTaskMutation = useUpdateTaskMutation();

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: task ? {
      title: task.title,
      type: task.type,
      time: task.time,
      contact_id: task.contact_id,
      status: task.status,
      priority: task.priority,
      hubspot_id: task.hubspot_id,
      hubspot_type: task.hubspot_type
    } : {
      title: '',
      type: 'call',
      time: new Date().toISOString().substring(0, 16), // Formato YYYY-MM-DDThh:mm
      contact_id: null,
      status: 'pending',
      priority: 'medium',
      hubspot_id: null,
      hubspot_type: 'contact' // Valor predeterminado 'contact'
    },
  });

  const onSubmit = async (values: TaskFormValues) => {
    try {
      // Si se seleccionó un contacto, actualizamos el contact_id
      if (values.hubspot_type === 'contact' && values.hubspot_id) {
        values.contact_id = values.hubspot_id;
      }
      
      if (task) {
        // Actualizar tarea existente
        await updateTaskMutation.mutateAsync({
          id: task.id,
          updates: values
        });
        toast({
          title: "Tarea actualizada",
          description: "La tarea ha sido actualizada correctamente.",
        });
      } else {
        // Crear nueva tarea
        await createTaskMutation.mutateAsync(values as Omit<Task, 'id' | 'created_at' | 'updated_at'>);
        toast({
          title: "Tarea creada",
          description: "La tarea ha sido creada correctamente.",
        });
        form.reset(); // Limpiar formulario después de crear
      }
      
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Error saving task:', error);
      toast({
        title: "Error",
        description: "Hubo un problema al guardar la tarea.",
        variant: "destructive",
      });
    }
  };

  // Manejador para cuando se selecciona un objeto de HubSpot
  const handleHubspotObjectSelect = (object: any) => {
    if (object) {
      form.setValue('hubspot_type', object.type);
      form.setValue('hubspot_id', object.id);
      
      // Si el objeto es un contacto, actualizamos también el contact_id
      if (object.type === 'contact') {
        form.setValue('contact_id', object.id);
      }
    } else {
      form.setValue('hubspot_type', null);
      form.setValue('hubspot_id', null);
      form.setValue('contact_id', null);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título</FormLabel>
              <FormControl>
                <Input placeholder="Título de la tarea" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="call">Llamada</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="meeting">Reunión</SelectItem>
                    <SelectItem value="follow-up">Seguimiento</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha y hora</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prioridad</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar prioridad" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="low">Baja</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="completed">Completada</SelectItem>
                    <SelectItem value="overdue">Vencida</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        {/* Sección de vinculación con HubSpot (siempre visible) */}
        <div className="space-y-4 border p-4 rounded-md">
          <h3 className="text-sm font-medium">Contacto de HubSpot</h3>
          
          <FormField
            control={form.control}
            name="hubspot_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contacto</FormLabel>
                <FormControl>
                  <HubspotObjectSelector
                    objectType="contact"
                    onSelect={handleHubspotObjectSelect}
                    selectedObject={
                      form.getValues('hubspot_id')
                        ? {
                            id: form.getValues('hubspot_id') || '',
                            name: form.getValues('hubspot_id')?.includes('hubspot-') 
                              ? `Contacto de HubSpot (${form.getValues('hubspot_id')?.substring(8, 16)}...)`
                              : 'Contacto seleccionado',
                            type: 'contact',
                          }
                        : null
                    }
                  />
                </FormControl>
                <FormDescription>
                  Selecciona un contacto de HubSpot para vincular con esta tarea
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onComplete && onComplete()}
          >
            Cancelar
          </Button>
          <Button 
            type="submit"
            disabled={createTaskMutation.isPending || updateTaskMutation.isPending}
          >
            {createTaskMutation.isPending || updateTaskMutation.isPending
              ? 'Guardando...'
              : task ? 'Actualizar' : 'Crear'}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default TaskForm; 