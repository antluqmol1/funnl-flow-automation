import { useMutation, useQueryClient } from '@tanstack/react-query';
import { syncDealWithHubspot } from '@/services/supabaseService';

interface SyncDealResult {
    status: string;
    data?: any;
    message: string;
    details?: {
        deal?: any;
        errors?: string[];
    };
}

export const useSyncDealWithHubspotMutation = () => {
    const queryClient = useQueryClient();

    return useMutation<SyncDealResult, Error, string>({
        mutationFn: async (dealId: string) => {
            return await syncDealWithHubspot(dealId);
        },
        onSuccess: (data) => {
            console.log("Sincronización de trato exitosa:", data);
            // Invalidar queries relevantes para refrescar datos
            queryClient.invalidateQueries({ queryKey: ['deals'] });
            queryClient.invalidateQueries({ queryKey: ['pipeline'] });
        },
        onError: (error) => {
            console.error("Error en la sincronización de trato:", error);
        }
    });
}; 