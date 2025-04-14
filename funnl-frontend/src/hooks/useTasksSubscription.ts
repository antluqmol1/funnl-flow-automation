import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';

export const useTasksSubscription = () => {
    const [subscribed, setSubscribed] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();

    useEffect(() => {
        // Crear suscripción a cambios en la tabla 'tasks'
        const subscription = supabase
            .channel('tasks-changes')
            .on(
                'postgres_changes',
                {
                    event: '*', // Escuchar a todos los eventos (INSERT, UPDATE, DELETE)
                    schema: 'public',
                    table: 'tasks',
                },
                (payload) => {
                    console.log('Cambio recibido:', payload);

                    // Invalidar la consulta de tareas para que se actualice
                    queryClient.invalidateQueries({ queryKey: ['tasks'] });

                    // Mostrar notificación según el tipo de evento
                    let title = '';
                    let description = '';

                    switch (payload.eventType) {
                        case 'INSERT':
                            title = 'Nueva tarea creada';
                            description = 'Se ha creado una nueva tarea.';
                            break;
                        case 'UPDATE':
                            title = 'Tarea actualizada';
                            description = 'Una tarea ha sido actualizada.';
                            break;
                        case 'DELETE':
                            title = 'Tarea eliminada';
                            description = 'Una tarea ha sido eliminada.';
                            break;
                    }

                    toast({
                        title,
                        description,
                        variant: 'default',
                    });
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Suscripción a tareas activada');
                    setSubscribed(true);
                } else {
                    console.error('Error en la suscripción:', status);
                    setError(new Error(`Error en la suscripción: ${status}`));
                    setSubscribed(false);
                }
            });

        // Limpiar suscripción cuando el componente se desmonte
        return () => {
            subscription.unsubscribe();
        };
    }, [queryClient, toast]);

    return { subscribed, error };
};

export default useTasksSubscription; 