import React, { useState } from 'react';
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
  // Campos de HubSpot opcionales
  link_to_hubspot: z.boolean().default(false),
  hubspot_id: z.string().nullable().optional(),
  hubspot_type: z.enum(['deal', 'ticket', 'contact', 'company']).nullable().optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

const TaskForm: React.FC<TaskFormProps> = ({ task, onComplete }) => {
  const { toast } = useToast();
  const [showHubspotFields, setShowHubspotFields] = useState(!!task?.hubspot_id);
  
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
      link_to_hubspot: !!task.hubspot_id,
      hubspot_id: task.hubspot_id,
      hubspot_type: task.hubspot_type
    } : {
      title: '',
      type: 'call',
      time: new Date().toISOString().substring(0, 16), // Formato YYYY-MM-DDThh:mm
      contact_id: null,
      status: 'pending',
      priority: 'medium',
      link_to_hubspot: false,
      hubspot_id: null,
      hubspot_type: null
    },
  });

  const onSubmit = async (values: TaskFormValues) => {
    try {
      // Si no enlazamos con HubSpot, quitamos esos valores
      if (!values.link_to_hubspot) {
        values.hubspot_id = null;
        values.hubspot_type = null;
      } else if (values.hubspot_id && values.hubspot_type) {
        console.log(`Vinculando tarea con objeto de HubSpot: ${values.hubspot_type} (ID: ${values.hubspot_id})`);
      }
      
      // Omitimos el campo link_to_hubspot ya que no es parte del modelo Task
      const { link_to_hubspot, ...taskData } = values;
      
      if (task) {
        // Actualizar tarea existente
        await updateTaskMutation.mutateAsync({
          id: task.id,
          updates: taskData
        });
        toast({
          title: "Tarea actualizada",
          description: "La tarea ha sido actualizada correctamente.",
        });
      } else {
        // Crear nueva tarea
        await createTaskMutation.mutateAsync(taskData as Omit<Task, 'id' | 'created_at' | 'updated_at'>);
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

  // Toggle para mostrar/ocultar campos de HubSpot
  const handleHubspotToggle = (checked: boolean) => {
    setShowHubspotFields(checked);
    form.setValue('link_to_hubspot', checked);
    
    if (!checked) {
      form.setValue('hubspot_id', null);
      form.setValue('hubspot_type', null);
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

        <FormField
          control={form.control}
          name="link_to_hubspot"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    field.onChange(checked);
                    handleHubspotToggle(checked as boolean);
                  }}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Vincular con HubSpot</FormLabel>
                <p className="text-sm text-gray-500">
                  Relaciona esta tarea con un objeto de HubSpot, te permitirá buscar por nombre en lugar de usar el ID
                </p>
              </div>
            </FormItem>
          )}
        />

        {showHubspotFields && (
          <div className="space-y-4 border p-4 rounded-md">
            <h3 className="text-sm font-medium">Información de HubSpot</h3>
            
            <FormField
              control={form.control}
              name="hubspot_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Objeto en HubSpot</FormLabel>
                  <FormControl>
                    <HubspotObjectSelector
                      objectType={field.value as any || 'contact'}
                      onSelect={(object) => {
                        if (object) {
                          form.setValue('hubspot_type', object.type);
                          form.setValue('hubspot_id', object.id);
                        } else {
                          form.setValue('hubspot_type', null);
                          form.setValue('hubspot_id', null);
                        }
                      }}
                      selectedObject={
                        field.value && form.getValues('hubspot_id')
                          ? {
                              id: form.getValues('hubspot_id') || '',
                              name: `ID: ${form.getValues('hubspot_id')}`, // Mostramos el ID si no tenemos el nombre
                              type: field.value as any,
                            }
                          : null
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Selecciona el objeto de HubSpot al que deseas vincular esta tarea
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

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