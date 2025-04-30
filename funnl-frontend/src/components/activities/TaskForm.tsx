import React, { useState, useEffect, useMemo } from 'react';
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
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import apiClient from '@/lib/axiosClient';
import { useAuthContext } from '@/contexts/AuthContext';
import { HubspotObject } from '@/types/hubspot';
import { Task as SupabaseTaskType } from '@/services/supabaseService';

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
  const { user } = useAuthContext();
  const createTaskMutation = useCreateTaskMutation();
  const updateTaskMutation = useUpdateTaskMutation();

  // Estado para saber si HubSpot está conectado
  const [isHubspotConnected, setIsHubspotConnected] = useState<boolean | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(true);

  // Verificar conexión con HubSpot al montar el componente
  useEffect(() => {
    const checkConnection = async () => {
      if (!user) {
        setIsHubspotConnected(false);
        setCheckingConnection(false);
        return;
      }
      setCheckingConnection(true);
      try {
        const response = await apiClient.get<{ success: boolean; connected: boolean; message?: string }>('/api/hubspot/status'); 
        
        console.log('Full response.data from /api/hubspot/status:', response.data);

        setIsHubspotConnected(response.data.connected); 
      } catch (error) {
        console.error("Error checking HubSpot connection:", error);
        setIsHubspotConnected(false);
      }
      setCheckingConnection(false);
    };
    checkConnection();
  }, [user]);

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
      contact_id: undefined,
      status: 'pending',
      priority: 'medium',
      hubspot_id: undefined,
      hubspot_type: 'contact' // Mantener o cambiar a undefined si se prefiere
    },
  });

  // --- NUEVO: Observar valores del formulario para pasarlos al selector --- 
  const watchedHubspotId = form.watch('hubspot_id');
  const watchedHubspotType = form.watch('hubspot_type');

  // Reconstruir el objeto para pasar como prop (puede no tener el nombre)
  const currentSelectedObject: HubspotObject | null = useMemo(() => {
      if (watchedHubspotId && watchedHubspotType) {
          // Idealmente, aquí tendríamos el nombre guardado en algún sitio.
          // Como no lo tenemos, HubspotObjectSelector mostrará un texto genérico
          // o podríamos intentar construirlo si tuviéramos más datos.
          // Por ahora, pasamos lo que tenemos.
          return {
              id: watchedHubspotId,
              type: watchedHubspotType,
              name: 'Objeto seleccionado' // Placeholder si el nombre no está disponible
          };
      }
      return null;
  }, [watchedHubspotId, watchedHubspotType]);
  // --- FIN NUEVO ---

  const onSubmit = async (values: TaskFormValues) => {
    let savedTask: SupabaseTaskType | null = null;
    try {
      // Copiar los valores del formulario
      const submissionData = { ...values };

      // Si se seleccionó un objeto de HubSpot, asegurar que contact_id (UUID) sea null
      if (submissionData.hubspot_id) {
        submissionData.contact_id = null; 
      } else {
        submissionData.contact_id = submissionData.contact_id || null;
      }

      console.log("[TaskForm] Datos a enviar a Supabase:", submissionData);

      if (task) {
        // Actualizar tarea existente
        // La mutación de actualización podría no devolver la tarea actualizada directamente
        // Necesitamos la data actualizada para el sync
        const updatePayload = {
          id: task.id,
          updates: submissionData
        };
        // Actualizar y asumir que los datos en `submissionData` son los correctos para el sync
        // Si la mutación devolviera el objeto actualizado, sería mejor usar ese
        await updateTaskMutation.mutateAsync(updatePayload);
        savedTask = { 
            ...task, // Empezar con los datos antiguos
            ...submissionData, // Sobrescribir con los nuevos
            // Asegurarse que los campos obligatorios de Task estén (aunque sean null)
            created_at: task.created_at, 
            updated_at: new Date().toISOString(), // Actualizar timestamp
            id: task.id, // Mantener el id original
            hubspot_task_id: task.hubspot_task_id // Mantener el hubspot_task_id existente
        };
        toast({
          title: "Tarea actualizada",
          description: "La tarea ha sido actualizada correctamente.",
        });
      } else {
        // Crear nueva tarea - Capturamos la respuesta que contiene la nueva tarea
        savedTask = await createTaskMutation.mutateAsync(submissionData as Omit<Task, 'id' | 'created_at' | 'updated_at' | 'hubspot_task_id'>);
        toast({
          title: "Tarea creada",
          description: "La tarea ha sido creada correctamente.",
        });
        // No hacer form.reset() aquí, hacerlo después del sync o al cerrar
      }
      
      // --- INICIO: Llamada para sincronizar con HubSpot --- 
      if (savedTask && savedTask.hubspot_id && savedTask.hubspot_type && isHubspotConnected === true) {
        console.log(`[TaskForm] Intentando sincronizar Tarea ${savedTask.id} con HubSpot...`);
        try {
          const syncPayload = {
            supabaseTaskId: savedTask.id,
            hubspotObjectId: savedTask.hubspot_id, 
            hubspotObjectType: savedTask.hubspot_type,
            existingHubspotTaskId: savedTask.hubspot_task_id, // Enviar el ID si existe
            taskData: {
              title: savedTask.title,
              status: savedTask.status,
              priority: savedTask.priority,
              time: savedTask.time,
            }
          };
          
          console.log("[TaskForm] Payload para /tasks/sync:", syncPayload);

          const syncResponse = await apiClient.post('/api/hubspot/tasks/sync', syncPayload);
          
          console.log("[TaskForm] Respuesta de sincronización HubSpot:", syncResponse.data);

          // Podríamos mostrar un toast secundario de éxito para el sync si quisiéramos
          // toast({ title: "Sincronización HubSpot", description: "Tarea sincronizada." });

        } catch (syncError: any) {
          console.error("[TaskForm] Error durante la sincronización con HubSpot:", syncError);
          // Mostrar un toast de advertencia, ya que la tarea principal se guardó
          toast({
            title: "Advertencia de Sincronización",
            description: `La tarea se guardó localmente, pero falló la sincronización con HubSpot: ${syncError.response?.data?.message || syncError.message}`,
            variant: "destructive", // Usar destructivo para que sea visible, aunque sea advertencia
            duration: 7000, // Duración más larga
          });
        }
      } else if (savedTask && savedTask.hubspot_id && isHubspotConnected !== true) {
         console.warn(`[TaskForm] Tarea ${savedTask.id} guardada, pero no se sincroniza porque HubSpot no está conectado.`);
         // Podríamos mostrar un toast informativo
         toast({ title: "Información", description: "Tarea guardada localmente. Conecta HubSpot para sincronizar." });
      }
      // --- FIN: Llamada para sincronizar con HubSpot --- 

      // Limpiar y cerrar solo después de que todo (incluido el intento de sync) haya terminado
      if (!task) { // Solo resetear si era una creación
         form.reset();
      }
      if (onComplete) {
        onComplete(); // Llamar a onComplete para cerrar el modal/drawer
      }

    } catch (error: any) { // Capturar error de guardado en Supabase
      console.error('Error saving task to Supabase:', error);
      
      // Intentar obtener más detalles del error si es posible
      let errorMessage = "Hubo un problema al guardar la tarea.";
      if (error.message) {
          errorMessage = error.message;
      }
      // Si el error viene de Supabase, puede tener más detalles
      if (error.details) {
          errorMessage += ` Detalles: ${error.details}`;
      }
      if (error.hint) {
           errorMessage += ` Pista: ${error.hint}`;
      }

      toast({
        title: "Error al guardar tarea",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Manejador para cuando se selecciona un objeto de HubSpot
  const handleHubspotObjectSelect = (object: HubspotObject | null) => {
    // Log añadido
    console.log('[TaskForm] handleHubspotObjectSelect received:', object);
    
    if (object) {
      console.log(`[TaskForm] Setting form values: hubspot_type=${object.type}, hubspot_id=${object.id}`);
      form.setValue('hubspot_type', object.type);
      form.setValue('hubspot_id', object.id);
      // Actualizar nombre también si lo recibimos (aunque no lo usemos para mostrar)
      // form.setValue('title', object.name); // Opcional: ¿actualizar título?
      
      if (object.type === 'contact') {
        console.log(`[TaskForm] Setting contact_id to ${object.id}`);
        form.setValue('contact_id', object.id);
      }
    } else {
      console.log('[TaskForm] Clearing HubSpot fields');
      form.setValue('hubspot_type', undefined);
      form.setValue('hubspot_id', undefined);
      form.setValue('contact_id', undefined);
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
        
        {/* Sección de vinculación con HubSpot actualizada */}
        <div className="space-y-2 border p-4 rounded-md min-h-[100px]">
          <h3 className="text-sm font-medium text-gray-700">Contacto de HubSpot</h3>
          {checkingConnection ? (
            <p className="text-xs text-gray-500 italic">Verificando conexión...</p>
          ) : isHubspotConnected === true ? (
            <HubspotObjectSelector 
              objectType="contact"
              onSelect={handleHubspotObjectSelect} 
              selectedObject={currentSelectedObject}
            />
          ) : isHubspotConnected === false ? (
            <div className="flex flex-col items-start space-y-2">
               <Link to="/automations" className="w-full">
                 <Button variant="outline" className="w-full border-dashed border-orange-500 text-orange-600 hover:bg-orange-50">
                   <Plus className="h-4 w-4 mr-2"/>
                   Conectar con HubSpot primero
                 </Button>
               </Link>
               <p className="text-xs text-gray-500">
                 Para vincular tareas con objetos de HubSpot, primero debes conectar tu cuenta.
               </p>
             </div>
          ) : null}
          
          <FormField control={form.control} name="hubspot_id" render={({ field }) => <input type="hidden" {...field} value={field.value ?? ''} />} />
          <FormField control={form.control} name="hubspot_type" render={({ field }) => <input type="hidden" {...field} value={field.value ?? ''} />} />
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="ghost" onClick={onComplete}>
            Cancelar
          </Button>
          <Button type="submit" disabled={checkingConnection || createTaskMutation.isPending || updateTaskMutation.isPending}>
            {task ? 'Actualizar Tarea' : 'Crear Tarea'}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default TaskForm; 