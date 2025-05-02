import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/lib/supabase";

// URL de la API del servidor
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// --- Interfaces de Respuesta ---
interface SyncContactsResult {
    success: boolean;
    message: string;
    details?: {
        linked_contacts: number;
        imported_contacts: number;
        errors: string[];
    };
}

interface SyncDealsResult {
    success: boolean;
    message: string;
    details?: {
        linked_deals: number;
        imported_deals: number;
        errors: string[];
    };
}

// <<< INICIO NUEVA INTERFAZ >>>
interface SyncTasksResult {
    success: boolean;
    message: string;
    details?: {
        imported_tasks: number;
        errors: string[];
    };
}
// <<< FIN NUEVA INTERFAZ >>>

// --- Hook para Sincronizar Contactos ---
export const useSyncAllContactsMutation = () => {
    const queryClient = useQueryClient();

    return useMutation<SyncContactsResult, Error, void>({
        mutationFn: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No hay sesión activa');

            const response = await fetch(`${API_URL}/api/hubspot/sync-all-contacts`, { // <-- Endpoint de Contactos
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                // Intentar obtener el mensaje de error específico de la API
                const errorMessage = errorData?.details?.errors?.[0] || errorData?.message || errorData?.error || 'Error iniciando sincronización de contactos';
                throw new Error(errorMessage);
            }

            return await response.json();
        },
        onSuccess: (data) => {
            console.log("Sincronización de contactos exitosa:", data);
            // Invalidar queries relevantes para refrescar datos
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
            queryClient.invalidateQueries({ queryKey: ['funnelData', 'customer'] }); // Invalidar datos del funnel de clientes
            queryClient.invalidateQueries({ queryKey: ['pipelineData'] }); // Invalidar pipeline genérico (si aplica)

        },
        onError: (error) => {
            console.error("Error en la mutación de sincronización de contactos:", error);
        }
    });
};

// --- Hook para Sincronizar Deals ---
export const useSyncAllDealsMutation = () => {
    const queryClient = useQueryClient();

    return useMutation<SyncDealsResult, Error, void>({
        mutationFn: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No hay sesión activa');

            const response = await fetch(`${API_URL}/api/hubspot/sync-all-deals`, { // <-- Endpoint de Deals
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                // Intentar obtener el mensaje de error específico de la API
                const errorMessage = errorData?.details?.errors?.[0] || errorData?.message || errorData?.error || 'Error iniciando sincronización de deals';
                throw new Error(errorMessage);
            }

            return await response.json();
        },
        onSuccess: (data) => {
            console.log("Sincronización de deals exitosa:", data);
            // Invalidar queries relevantes para refrescar datos
            queryClient.invalidateQueries({ queryKey: ['deals'] });
            queryClient.invalidateQueries({ queryKey: ['funnelData', 'sales'] }); // Invalidar datos del funnel de ventas
            queryClient.invalidateQueries({ queryKey: ['pipelineData'] }); // Invalidar pipeline genérico (si aplica)
        },
        onError: (error) => {
            console.error("Error en la mutación de sincronización de deals:", error);
        }
    });
};

// <<< INICIO NUEVO HOOK >>>
// --- Hook para Sincronizar Tareas (HubSpot -> Supabase) ---
export const useSyncAllTasksMutation = () => {
    const queryClient = useQueryClient();

    return useMutation<SyncTasksResult, Error, void>({
        mutationFn: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No hay sesión activa');

            const response = await fetch(`${API_URL}/api/hubspot/sync-all-tasks`, { // <-- Endpoint de Tareas
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                // No necesita body para este endpoint
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData?.message || errorData?.error || 'Error iniciando sincronización de tareas';
                throw new Error(errorMessage);
            }

            return await response.json();
        },
        onSuccess: (data) => {
            console.log("Sincronización de tareas (HubSpot -> Supabase) completada:", data);
            // Invalidar la query principal de tareas para refrescar la lista
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        },
        onError: (error) => {
            console.error("Error en la mutación de sincronización de tareas:", error);
        }
    });
};
// <<< FIN NUEVO HOOK >>> 