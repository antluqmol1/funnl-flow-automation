import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";

// URL de la API del servidor
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface SyncAllResult {
    status: string;
    message: string;
    details?: {
        linked_contacts?: number;
        errors?: string[];
    };
}

export const useSyncAllWithHubspotMutation = () => {
    const queryClient = useQueryClient();

    return useMutation<SyncAllResult, Error, void>({ // Especificamos tipos genéricos
        mutationFn: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No hay sesión activa');

            const response = await fetch(`${API_URL}/hubspot/sync-all`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || errorData.message || 'Error iniciando sincronización completa');
            }

            return await response.json();
        },
        onSuccess: (data) => {
            console.log("Sincronización completa exitosa:", data);
            // Invalidar queries relevantes para refrescar datos
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            queryClient.invalidateQueries({ queryKey: ['contacts'] }); // Asumiendo que existe queryKey para contactos
            // Podrías invalidar más queries si es necesario
        },
        onError: (error) => {
            console.error("Error en la mutación de sincronización completa:", error);
            // El error ya debería haberse mostrado por toast en Index.tsx
        }
    });
}; 