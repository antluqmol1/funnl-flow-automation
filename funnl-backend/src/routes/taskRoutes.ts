import express, { Request, Response, Router } from 'express';
import { verifySupabaseToken } from '../middleware/authMiddleware';
import { getHubspotAccessTokenForUser } from '../services/hubspotTokenManager';
import { HubSpotService } from '../services/hubspotService';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// --- Inicializar Cliente Supabase (igual que en otros routers) ---
let supabase: SupabaseClient | null = null;
const initializeSupabaseClient = () => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceRoleKey) {
        console.error('[TaskRoutes] Error: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no definidos.');
        return null;
    }
    try {
        return createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        });
    } catch (error) {
        console.error('[TaskRoutes] Error al inicializar el cliente Supabase:', error);
        return null;
    }
};
supabase = initializeSupabaseClient();
// --- Fin Inicialización Supabase ---

// Extender Request si es necesario (copiado de hubspotRoutes)
declare global {
    namespace Express {
        interface Request {
            user?: { id: string;[key: string]: any };
            hubspotAccessToken?: string; // Podríamos necesitarlo si el servicio lo requiere
        }
    }
}

const router: Router = express.Router();
const hubspotService = new HubSpotService(); // Instancia del servicio HubSpot

// Aplicar middleware de autenticación de Supabase a todas las rutas de tareas
router.use(verifySupabaseToken);

// DELETE /api/tasks/:id - Eliminar una tarea (en Supabase y HubSpot)
router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
    const supabaseTaskId = req.params.id;
    const userId = req.user?.id;

    console.log(`API Recibido: DELETE /tasks/${supabaseTaskId} (User: ${userId})`);

    if (!supabase) {
        return res.status(500).json({ success: false, message: 'Error de configuración del servidor (Supabase).' });
    }
    if (!userId) {
        // Esto no debería pasar si verifySupabaseToken funcionó
        return res.status(401).json({ success: false, message: "Usuario no autenticado." });
    }

    let hubspotTaskId: string | null = null;
    let hubspotToken: string | null = null;

    try {
        // 1. Obtener la tarea de Supabase para ver si tiene hubspot_task_id
        const { data: taskData, error: fetchError } = await supabase
            .from('tasks')
            .select('hubspot_task_id') // Solo necesitamos el ID de HubSpot
            .eq('id', supabaseTaskId)
            // Podríamos añadir .eq('user_id', userId) si hubiera user_id en tasks y RLS no lo cubriera
            .maybeSingle();

        if (fetchError) {
            console.error(`[TaskRoutes] Error buscando tarea ${supabaseTaskId} en Supabase:`, fetchError);
            return res.status(500).json({ success: false, message: `Error buscando tarea: ${fetchError.message}` });
        }

        if (!taskData) {
            // Si la tarea no existe en Supabase, devolvemos 404
            return res.status(404).json({ success: false, message: 'Tarea no encontrada.' });
        }

        hubspotTaskId = taskData.hubspot_task_id;

        // 2. Si tiene ID de HubSpot, intentar borrarla de HubSpot
        if (hubspotTaskId) {
            console.log(`[TaskRoutes] Tarea ${supabaseTaskId} tiene Hubspot Task ID: ${hubspotTaskId}. Intentando borrar de HubSpot...`);
            try {
                hubspotToken = await getHubspotAccessTokenForUser(userId);
                if (!hubspotToken) {
                    // Si no hay token, no podemos borrar en HubSpot, pero sí en Supabase. Loguear advertencia.
                    console.warn(`[TaskRoutes] No se encontró token de HubSpot para usuario ${userId}. No se puede borrar tarea ${hubspotTaskId} de HubSpot.`);
                } else {
                    await hubspotService.deleteHubspotTask(hubspotTaskId, hubspotToken);
                    console.log(`[TaskRoutes] Tarea ${hubspotTaskId} borrada/verificada como borrada en HubSpot.`);
                }
            } catch (hubspotError: any) {
                // Si falla el borrado en HubSpot, registramos el error pero continuamos para borrar en Supabase
                console.error(`[TaskRoutes] Error borrando tarea ${hubspotTaskId} de HubSpot (continuando con borrado en Supabase):`, hubspotError.message);
                // Podríamos devolver un estado 207 Multi-Status o añadir info al success=true
            }
        } else {
            console.log(`[TaskRoutes] Tarea ${supabaseTaskId} no tiene Hubspot Task ID. Saltando borrado en HubSpot.`);
        }

        // 3. Borrar la tarea de Supabase
        console.log(`[TaskRoutes] Borrando tarea ${supabaseTaskId} de Supabase...`);
        const { error: deleteError } = await supabase
            .from('tasks')
            .delete()
            .eq('id', supabaseTaskId);

        if (deleteError) {
            console.error(`[TaskRoutes] Error borrando tarea ${supabaseTaskId} de Supabase:`, deleteError);
            // Si HubSpot se borró pero Supabase falló, estamos en un estado inconsistente
            return res.status(500).json({
                success: false,
                message: `Error al borrar la tarea de la base de datos local: ${deleteError.message}`,
                hubspot_deleted: !!hubspotTaskId // Informar si se intentó borrar en HubSpot
            });
        }

        console.log(`[TaskRoutes] Tarea ${supabaseTaskId} borrada exitosamente de Supabase.`);

        // 4. Devolver éxito
        res.status(200).json({
            success: true,
            message: 'Tarea eliminada correctamente.'
            // Podríamos añadir info si el borrado en HubSpot falló pero el local no
        });

    } catch (error: any) {
        console.error(`[TaskRoutes] Error inesperado en DELETE /tasks/${supabaseTaskId}:`, error);
        res.status(500).json({ success: false, message: error.message || "Error interno del servidor." });
    }
});

export default router; 