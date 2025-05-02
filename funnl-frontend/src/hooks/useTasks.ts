import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/lib/supabase";
import {
    getTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    getTasksByHubspotId,
    syncTaskWithHubspot,
    type Task
} from '@/services/supabaseService';
import apiClient from '@/lib/axiosClient';
import { useToast } from "@/components/ui/use-toast";

// URL de la API del servidor
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Query Key Factory
const tasksKeys = {
    all: ['tasks'] as const,
    lists: () => ['tasks', 'list'] as const,
    list: (filters: string) => ['tasks', 'list', filters] as const,
    details: () => ['tasks', 'detail'] as const,
    detail: (id: string) => ['tasks', 'detail', id] as const,
};

export const useTasksQuery = (enabled = true) => {
    return useQuery({
        queryKey: ['tasks'],
        queryFn: getTasks,
        enabled,
    });
};

export const useTaskByIdQuery = (id: string, enabled = true) => {
    return useQuery({
        queryKey: ['tasks', id],
        queryFn: () => getTaskById(id),
        enabled: !!id && enabled,
    });
};

export const useTasksByHubspotIdQuery = (hubspotId: string, hubspotType: string, enabled = true) => {
    return useQuery({
        queryKey: ['tasks', 'hubspot', hubspotId, hubspotType],
        queryFn: () => getTasksByHubspotId(hubspotId, hubspotType),
        enabled: !!hubspotId && !!hubspotType && enabled,
    });
};

export const useCreateTaskMutation = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: (newTask: Omit<Task, 'id' | 'created_at' | 'updated_at'>) =>
            createTask(newTask),
        onSuccess: (createdTask) => {
            queryClient.invalidateQueries({ queryKey: tasksKeys.all });

            if (createdTask.hubspot_id && createdTask.hubspot_type) {
                console.log(`Tarea ${createdTask.id} creada con asociación a HubSpot. Iniciando sincronización...`);
                syncTaskWithHubspot(createdTask.id, createdTask.hubspot_id, createdTask.hubspot_type)
                    .then(result => {
                        if (result.success) {
                            console.log(`Sincronización automática para tarea ${createdTask.id} completada.`);
                            queryClient.invalidateQueries({ queryKey: tasksKeys.detail(createdTask.id) });
                            queryClient.invalidateQueries({ queryKey: tasksKeys.all });
                        } else {
                            console.error(`Error en sincronización automática para tarea ${createdTask.id}: ${result.message}`);
                            toast({
                                title: "Error de sincronización",
                                description: `No se pudo sincronizar automáticamente la nueva tarea con HubSpot: ${result.message || 'Error desconocido'}`,
                                variant: "destructive",
                            });
                        }
                    })
                    .catch(error => {
                        console.error(`Error inesperado en sincronización automática para tarea ${createdTask.id}:`, error);
                        toast({
                            title: "Error inesperado",
                            description: `Ocurrió un error inesperado al intentar sincronizar la nueva tarea con HubSpot.`,
                            variant: "destructive",
                        });
                    });
            }
        },
        onError: (error) => {
            toast({
                title: "Error al crear tarea",
                description: error.message || "No se pudo guardar la nueva tarea.",
                variant: "destructive",
            });
        }
    });
};

export const useUpdateTaskMutation = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<Task> }) =>
            updateTask(id, updates),
        onSuccess: (updatedTask) => {
            queryClient.invalidateQueries({ queryKey: tasksKeys.all });
            queryClient.invalidateQueries({ queryKey: tasksKeys.detail(updatedTask.id) });

            if (updatedTask.hubspot_id && updatedTask.hubspot_type) {
                queryClient.invalidateQueries({
                    queryKey: ['tasks', 'hubspot', updatedTask.hubspot_id, updatedTask.hubspot_type]
                });

                console.log(`Tarea ${updatedTask.id} actualizada localmente. Iniciando sincronización con HubSpot...`);
                syncTaskWithHubspot(updatedTask.id, updatedTask.hubspot_id, updatedTask.hubspot_type)
                    .then(result => {
                        if (result.success) {
                            console.log(`Sincronización de actualización para tarea ${updatedTask.id} completada.`);
                            queryClient.invalidateQueries({ queryKey: tasksKeys.detail(updatedTask.id) });
                            queryClient.invalidateQueries({ queryKey: tasksKeys.all });
                        } else {
                            console.error(`Error sincronizando actualización de tarea ${updatedTask.id}: ${result.message}`);
                            toast({
                                title: "Error de Sincronización",
                                description: `La tarea se actualizó localmente, pero falló la sincronización con HubSpot: ${result.message || 'Error desconocido'}`,
                                variant: "destructive",
                                duration: 7000,
                            });
                        }
                    })
                    .catch(error => {
                        console.error(`Error inesperado sincronizando actualización de tarea ${updatedTask.id}:`, error);
                        toast({
                            title: "Error Inesperado de Sincronización",
                            description: `Ocurrió un error inesperado al intentar sincronizar la actualización con HubSpot.`,
                            variant: "destructive",
                        });
                    });
            }
        },
        onError: (error, variables) => {
            console.error(`Error actualizando tarea ${variables.id} en Supabase:`, error);
            toast({
                title: "Error al Actualizar Tarea",
                description: error.message || "No se pudo guardar la actualización de la tarea.",
                variant: "destructive",
            });
        }
    });
};

export const useDeleteTaskMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (taskId: string) => {
            const response = await apiClient.delete(`/api/tasks/${taskId}`);
            return response.data;
        },
        onSuccess: (_, taskId) => {
            queryClient.invalidateQueries({ queryKey: tasksKeys.all });
            queryClient.removeQueries({ queryKey: tasksKeys.detail(taskId) });
        },
        onError: (error, taskId) => {
            console.error(`Error deleting task ${taskId}:`, error);
            const { toast } = useToast();
            toast({
                title: "Error al eliminar tarea",
                description: error.message || "No se pudo eliminar la tarea.",
                variant: "destructive",
            });
        }
    });
};

// export const useSyncTaskWithHubspotMutation = () => { <-- Inicio de la sección a eliminar
//     const queryClient = useQueryClient();
// 
//     return useMutation({
//         mutationFn: async ({ taskId, hubspotId, hubspotType }: {
//             taskId: string;
//             hubspotId: string;
//             hubspotType: string;
//         }) => {
//             try {
//                 // Primero obtenemos el token de sesión
//                 const { data: { session } } = await supabase.auth.getSession();
//                 if (!session) throw new Error('No hay sesión activa');
// 
//                 // Verificar si hay una conexión con HubSpot configurada
//                 try {
//                     // Primero marcamos la tarea como "sincronizando"
//                     await updateTask(taskId, {
//                         hubspot_id: hubspotId,
//                         hubspot_type: hubspotType as Task['hubspot_type'],
//                         sync_status: 'pending',
//                         hubspot_last_synced: new Date().toISOString(),
//                     });
// 
//                     // 1. Primero obtener la tarea completa de Supabase
//                     const taskData = await getTaskById(taskId);
//                     if (!taskData) {
//                         throw new Error('No se pudo encontrar la tarea en Supabase');
//                     }
// 
//                     // 2. Sincronizar la tarea con HubSpot (primero enviar a HubSpot)
//                     // Preparar datos para enviar a HubSpot
//                     const hubspotTaskData = {
//                         taskId,
//                         hubspotId,
//                         hubspotType,
//                         title: taskData.title,
//                         status: taskData.status,
//                         priority: taskData.priority,
//                         time: taskData.time
//                     };
// 
//                     // Enviar datos a HubSpot
//                     const updateHubspotResponse = await fetch(`${API_URL}/hubspot/update-task`, {
//                         method: 'POST',
//                         headers: {
//                             'Authorization': `Bearer ${session.access_token}`,
//                             'Content-Type': 'application/json'
//                         },
//                         body: JSON.stringify(hubspotTaskData)
//                     });
// 
//                     if (!updateHubspotResponse.ok) {
//                         const errorData = await updateHubspotResponse.json();
//                         throw new Error(errorData.detail || errorData.message || 'Error actualizando la tarea en HubSpot');
//                     }
// 
//                     // 3. Sincronizar los datos del objeto relacionado de HubSpot
//                     const syncResponse = await fetch(`${API_URL}/hubspot/sync`, {
//                         method: 'POST',
//                         headers: {
//                             'Authorization': `Bearer ${session.access_token}`,
//                             'Content-Type': 'application/json'
//                         },
//                         body: JSON.stringify({
//                             type: hubspotType,
//                             id: hubspotId,
//                             force: true
//                         })
//                     });
// 
//                     if (!syncResponse.ok) {
//                         const errorData = await syncResponse.json();
//                         throw new Error(errorData.detail || errorData.message || 'Error sincronizando con HubSpot');
//                     }
// 
//                     // Analizamos la respuesta, con verificación de estructura
//                     const responseData = await syncResponse.json();
// 
//                     // Verificamos que la estructura de la respuesta sea la esperada
//                     const hubspotData = responseData.data || responseData;
//                     const properties = hubspotData.properties || {};
// 
//                     // Ahora actualizamos la tarea local con los datos recuperados
//                     const updates: Partial<Task> = {
//                         hubspot_id: hubspotId,
//                         hubspot_type: hubspotType as Task['hubspot_type'],
//                         // Buscamos el estado en diferentes ubicaciones posibles en la respuesta
//                         hubspot_status: hubspotData.status ||
//                             properties.status ||
//                             properties.dealstage ||
//                             properties.hs_ticket_status ||
//                             'active',
//                         // Buscamos el propietario en diferentes ubicaciones
//                         hubspot_owner: hubspotData.owner ||
//                             properties.hubspot_owner_id ||
//                             properties.hs_owner_id ||
//                             null,
//                         hubspot_last_synced: new Date().toISOString(),
//                         sync_status: 'synced'
//                     };
// 
//                     return await updateTask(taskId, updates);
//                 } catch (error) {
//                     console.error("Error sincronizando con HubSpot:", error);
// 
//                     // Actualizar la tarea para indicar que hubo un error
//                     const errorUpdates: Partial<Task> = {
//                         // Mantenemos el ID y tipo de HubSpot aunque haya error
//                         hubspot_id: hubspotId,
//                         hubspot_type: hubspotType as Task['hubspot_type'],
//                         sync_status: 'error',
//                         hubspot_last_synced: new Date().toISOString()
//                     };
// 
//                     const updatedTask = await updateTask(taskId, errorUpdates);
// 
//                     // Re-lanzamos el error para que se capture en onError
//                     throw error;
//                 }
//             } catch (error) {
//                 console.error("Error en el proceso de sincronización:", error);
//                 throw error;
//             }
//         },
//         onSuccess: (updatedTask) => {
//             queryClient.invalidateQueries({ queryKey: ['tasks'] });
//             queryClient.invalidateQueries({ queryKey: ['tasks', updatedTask.id] });
// 
//             if (updatedTask.hubspot_id && updatedTask.hubspot_type) {
//                 queryClient.invalidateQueries({
//                     queryKey: ['tasks', 'hubspot', updatedTask.hubspot_id, updatedTask.hubspot_type]
//                 });
//             }
//         },
//         onError: (error) => {
//             console.error("Error capturado en la mutación:", error);
//             // Podríamos mostrar un toast aquí, pero lo manejamos en el componente
//         }
//     });
// }; <-- Fin de la sección a eliminar 