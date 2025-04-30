import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Interfaz para extender el objeto Request de Express
declare global {
    namespace Express {
        interface Request {
            user?: { id: string;[key: string]: any }; // Adjuntamos el ID del usuario de Supabase
        }
    }
}

let supabase: SupabaseClient | null = null;

const initializeSupabaseClient = () => {
    const supabaseUrl = process.env.SUPABASE_URL;
    // Usamos la Service Role Key para la verificación en el backend
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        console.error('[AuthMiddleware] Error: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no definidos en .env');
        // En un caso real, podríamos lanzar un error o manejarlo de forma más robusta
        return null;
    }

    try {
        // Importante: Usar la Service Role Key aquí
        return createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: {
                // No necesitamos persistencia en el backend
                persistSession: false,
                autoRefreshToken: false
            }
        });
    } catch (error) {
        console.error('[AuthMiddleware] Error al inicializar el cliente Supabase:', error);
        return null;
    }
};

// Inicializar el cliente una vez
supabase = initializeSupabaseClient();

export const verifySupabaseToken = async (req: Request, res: Response, next: NextFunction) => {
    if (!supabase) {
        console.error('[AuthMiddleware] Cliente Supabase no inicializado.');
        return res.status(500).json({ error: 'Error de configuración del servidor.' });
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('[AuthMiddleware] Token no encontrado o formato incorrecto en la cabecera Authorization.');
        return res.status(401).json({ error: 'No autorizado: Token no proporcionado.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Verificar el token usando el cliente del backend
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error) {
            console.warn(`[AuthMiddleware] Error al verificar token: ${error.message} (Status: ${error.status})`);
            // Devolver un error específico basado en el estado de Supabase
            const status = error.status || 401;
            return res.status(status).json({ error: `No autorizado: ${error.message}` });
        }

        if (!user) {
            console.warn('[AuthMiddleware] Token válido pero no se encontró usuario asociado.');
            return res.status(401).json({ error: 'No autorizado: Usuario no encontrado.' });
        }

        // Token válido y usuario encontrado
        console.log(`[AuthMiddleware] Token verificado. Usuario ID: ${user.id}`);
        // Adjuntar información del usuario a la solicitud para uso posterior
        req.user = { ...user }; // Adjuntamos el objeto user completo (que incluye id).
        next(); // Pasar al siguiente middleware o handler

    } catch (err: any) {
        // Capturar cualquier otro error inesperado durante la verificación
        console.error('[AuthMiddleware] Error inesperado durante la verificación del token:', err);
        res.status(500).json({ error: 'Error interno del servidor durante la autenticación.' });
    }
}; 