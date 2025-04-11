import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
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

// URL de la API del servidor
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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

    return useMutation({
        mutationFn: (newTask: Omit<Task, 'id' | 'created_at' | 'updated_at'>) =>
            createTask(newTask),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        },
    });
};

export const useUpdateTaskMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<Task> }) =>
            updateTask(id, updates),
        onSuccess: (updatedTask) => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            queryClient.invalidateQueries({ queryKey: ['tasks', updatedTask.id] });

            // Invalidar consultas relacionadas con HubSpot si es relevante
            if (updatedTask.hubspot_id && updatedTask.hubspot_type) {
                queryClient.invalidateQueries({
                    queryKey: ['tasks', 'hubspot', updatedTask.hubspot_id, updatedTask.hubspot_type]
                });
            }
        },
    });
};

export const useDeleteTaskMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteTask(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            queryClient.invalidateQueries({ queryKey: ['tasks', id] });
        },
    });
};

export const useSyncTaskWithHubspotMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ taskId, hubspotId, hubspotType }: {
            taskId: string;
            hubspotId: string;
            hubspotType: string;
        }) => {
            try {
                // Primero obtenemos el token de sesión
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw new Error('No hay sesión activa');

                // Verificar si hay una conexión con HubSpot configurada
                try {
                    // Primero marcamos la tarea como "sincronizando"
                    await updateTask(taskId, {
                        hubspot_id: hubspotId,
                        hubspot_type: hubspotType as Task['hubspot_type'],
                        sync_status: 'pending',
                        hubspot_last_synced: new Date().toISOString(),
                    });

                    // Llamamos a la API del servidor para sincronizar con HubSpot
                    const response = await fetch(`${API_URL}/hubspot/sync`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${session.access_token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            type: hubspotType,
                            id: hubspotId,
                            force: true
                        })
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.detail || errorData.message || 'Error sincronizando con HubSpot');
                    }

                    // Analizamos la respuesta, con verificación de estructura
                    const responseData = await response.json();

                    // Verificamos que la estructura de la respuesta sea la esperada
                    const hubspotData = responseData.data || responseData;
                    const properties = hubspotData.properties || {};

                    // Ahora actualizamos la tarea local con los datos recuperados
                    const updates: Partial<Task> = {
                        hubspot_id: hubspotId,
                        hubspot_type: hubspotType as Task['hubspot_type'],
                        // Buscamos el estado en diferentes ubicaciones posibles en la respuesta
                        hubspot_status: hubspotData.status ||
                            properties.status ||
                            properties.dealstage ||
                            properties.hs_ticket_status ||
                            'active',
                        // Buscamos el propietario en diferentes ubicaciones
                        hubspot_owner: hubspotData.owner ||
                            properties.hubspot_owner_id ||
                            properties.hs_owner_id ||
                            null,
                        hubspot_last_synced: new Date().toISOString(),
                        sync_status: 'synced'
                    };

                    return await updateTask(taskId, updates);
                } catch (error) {
                    console.error("Error sincronizando con HubSpot:", error);

                    // Actualizar la tarea para indicar que hubo un error
                    const errorUpdates: Partial<Task> = {
                        // Mantenemos el ID y tipo de HubSpot aunque haya error
                        hubspot_id: hubspotId,
                        hubspot_type: hubspotType as Task['hubspot_type'],
                        sync_status: 'error',
                        hubspot_last_synced: new Date().toISOString()
                    };

                    const updatedTask = await updateTask(taskId, errorUpdates);

                    // Re-lanzamos el error para que se capture en onError
                    throw error;
                }
            } catch (error) {
                console.error("Error en el proceso de sincronización:", error);
                throw error;
            }
        },
        onSuccess: (updatedTask) => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            queryClient.invalidateQueries({ queryKey: ['tasks', updatedTask.id] });

            if (updatedTask.hubspot_id && updatedTask.hubspot_type) {
                queryClient.invalidateQueries({
                    queryKey: ['tasks', 'hubspot', updatedTask.hubspot_id, updatedTask.hubspot_type]
                });
            }
        },
        onError: (error) => {
            console.error("Error capturado en la mutación:", error);
            // Podríamos mostrar un toast aquí, pero lo manejamos en el componente
        }
    });
}; 