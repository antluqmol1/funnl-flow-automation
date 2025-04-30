import { supabase } from '../lib/supabase';
import { encrypt, decrypt } from '../utils/cryptoUtils';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;

// Asumiendo que tienes este tipo definido en algún lugar
// import { HubspotTokens } from '../types'; 
// Temporalmente, definimos un tipo básico aquí si no existe:
type HubspotTokens = {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type?: string; // Opcional
};

/**
 * Almacena los tokens de HubSpot para un usuario específico en la base de datos,
 * encriptando el access token y el refresh token.
 * Utiliza upsert para insertar o actualizar si ya existe un registro para el usuario.
 *
 * @param userId - El ID del usuario de Supabase.
 * @param tokens - El objeto de tokens recibido de HubSpot.
 */
export async function storeHubspotTokensForUser(userId: string, tokens: HubspotTokens): Promise<void> {
    if (!userId) {
        throw new Error('Se requiere userId para almacenar los tokens.');
    }
    if (!tokens || !tokens.access_token || !tokens.refresh_token || !tokens.expires_in) {
        throw new Error('El objeto de tokens es inválido o incompleto.');
    }

    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = encrypt(tokens.refresh_token);

    // Calcula expires_at restando un pequeño margen (ej. 5 minutos) para evitar usar un token justo antes de que expire
    const expiresInMilliseconds = (tokens.expires_in - 300) * 1000;
    const expiresAt = new Date(Date.now() + expiresInMilliseconds);

    const { error } = await supabase
        .from('user_hubspot_tokens')
        .upsert(
            {
                user_id: userId,
                encrypted_access_token: encryptedAccessToken,
                encrypted_refresh_token: encryptedRefreshToken,
                expires_at: expiresAt.toISOString(),
                // created_at y updated_at se manejan automáticamente por la DB (trigger y default)
            },
            { onConflict: 'user_id' } // Especifica que user_id es la columna para detectar conflictos
        );

    if (error) {
        console.error('Error al guardar tokens de HubSpot en Supabase:', error);
        throw new Error(`No se pudieron guardar los tokens de HubSpot: ${error.message}`);
    }

    console.log(`Tokens de HubSpot guardados/actualizados exitosamente para el usuario: ${userId}`);
}

/**
 * Intenta renovar los tokens de HubSpot usando un refresh token.
 * @param refreshToken - El refresh token desencriptado.
 * @returns Un objeto HubspotTokens con los nuevos tokens si la renovación es exitosa, o null si falla.
 */
async function refreshHubspotToken(refreshToken: string): Promise<HubspotTokens | null> {
    console.log('[TokenManager] Intentando renovar token de HubSpot...');
    if (!HUBSPOT_CLIENT_ID || !HUBSPOT_CLIENT_SECRET) {
        console.error('[TokenManager] Error: HUBSPOT_CLIENT_ID o HUBSPOT_CLIENT_SECRET no configurados para renovar token.');
        return null;
    }

    const tokenUrl = 'https://api.hubapi.com/oauth/v1/token';
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('client_id', HUBSPOT_CLIENT_ID);
    params.append('client_secret', HUBSPOT_CLIENT_SECRET);
    params.append('refresh_token', refreshToken);

    try {
        const response = await axios.post<HubspotTokens>(tokenUrl, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        // HubSpot devuelve nuevos access_token, refresh_token y expires_in
        console.log('[TokenManager] Token renovado exitosamente.');
        return response.data;

    } catch (error: any) {
        console.error('[TokenManager] Error al renovar token de HubSpot:');
        if (axios.isAxiosError(error) && error.response) {
            console.error("- Status:", error.response.status);
            console.error("- Data:", error.response.data);
            // Si el refresh token es inválido (ej. revocado), HubSpot suele devolver 400 o 403
            if (error.response.status === 400 || error.response.status === 403) {
                console.warn('[TokenManager] El refresh token parece ser inválido o ha sido revocado.');
            }
        } else {
            console.error(error.message);
        }
        return null; // Indicar fallo en la renovación
    }
}

/**
 * Obtiene el access token de HubSpot válido para un usuario específico desde la base de datos.
 * Devuelve null si no hay tokens, si están expirados o si ocurre un error.
 * Por ahora, no maneja la renovación automática del token.
 *
 * @param userId - El ID del usuario de Supabase.
 * @returns El access token desencriptado o null.
 */
export async function getHubspotAccessTokenForUser(userId: string): Promise<string | null> {
    if (!userId) {
        console.error('Se requiere userId para obtener el token de acceso.');
        return null;
    }

    const { data, error } = await supabase
        .from('user_hubspot_tokens')
        .select('encrypted_access_token, expires_at, encrypted_refresh_token') // Incluimos refresh token para futura lógica de renovación
        .eq('user_id', userId)
        .single(); // Esperamos solo un registro por usuario

    if (error) {
        if (error.code === 'PGRST116') { // Código de error de PostgREST para "No rows found"
            console.log(`No se encontraron tokens de HubSpot para el usuario: ${userId}`);
        } else {
            console.error('Error al obtener tokens de HubSpot desde Supabase:', error);
        }
        return null;
    }

    if (!data) {
        console.log(`No se encontraron datos de token para el usuario: ${userId}`);
        return null;
    }

    const { encrypted_access_token, expires_at, encrypted_refresh_token } = data;

    if (!encrypted_access_token || !expires_at || !encrypted_refresh_token) {
        console.error(`[TokenManager] Datos de token incompletos para el usuario: ${userId}`);
        return null;
    }

    const expiresAtDate = new Date(expires_at);

    // Verificar si el token ha expirado (o expirará pronto)
    if (expiresAtDate <= new Date()) {
        console.log(`[TokenManager] El token de HubSpot para el usuario ${userId} ha expirado. Intentando renovar...`);
        try {
            const refreshToken = decrypt(encrypted_refresh_token);
            const newTokens = await refreshHubspotToken(refreshToken);

            if (newTokens) {
                // Guardar los nuevos tokens en la DB
                await storeHubspotTokensForUser(userId, newTokens);
                console.log(`[TokenManager] Nuevos tokens guardados para usuario ${userId}.`);
                // Devolver el nuevo access token
                return newTokens.access_token;
            } else {
                // La renovación falló (refresh token inválido o error de API)
                console.error(`[TokenManager] Falló la renovación del token para el usuario ${userId}. Se requiere reconexión manual.`);
                // Podríamos opcionalmente eliminar el registro inválido de la DB aquí
                // await supabase.from('user_hubspot_tokens').delete().eq('user_id', userId);
                return null; // Indicar que no se pudo obtener un token válido
            }
        } catch (refreshError: any) {
            console.error(`[TokenManager] Error durante el proceso de renovación para usuario ${userId}:`, refreshError);
            return null;
        }
    }

    // Si el token NO ha expirado, simplemente desencriptar y devolver el actual
    try {
        const accessToken = decrypt(encrypted_access_token);
        return accessToken;
    } catch (decryptionError) {
        console.error(`[TokenManager] Error al desencriptar el token de HubSpot para el usuario ${userId}:`, decryptionError);
        return null;
    }
}

// TODO: Implementar función para refrescar el token usando el refresh_token
// async function refreshHubspotToken(refreshToken: string): Promise<HubspotTokens | null> { ... }

