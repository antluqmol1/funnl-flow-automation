import express, { Request, Response, Router } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { storeHubspotTokensForUser } from '../services/hubspotTokenManager';
import { verifySupabaseToken } from '../middleware/authMiddleware';

dotenv.config(); // Cargar variables de entorno

const router: Router = express.Router();

// --- Variables de Configuración ---
const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const HUBSPOT_REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI;
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Define los scopes (permisos) que tu aplicación necesita.
// Ajustados según error de scopes inválidos.
const HUBSPOT_SCOPES = [
    'crm.objects.contacts.read',
    'crm.objects.contacts.write',
    'crm.objects.companies.read',
    'crm.objects.companies.write',
    'crm.objects.deals.read',
    'crm.objects.deals.write',
    // 'crm.objects.tickets.read', // Inválido según error
    // 'crm.objects.tickets.write', // Inválido según error
    'tickets', // Scope general de tickets
    // 'crm.pipelines.read', // Inválido según error
    'oauth' // Scope básico requerido
].join(' ');

// --- Rutas OAuth ---

/**
 * GET /api/auth/hubspot/connect
 * Inicia el flujo OAuth redirigiendo al usuario a la página de autorización de HubSpot.
 * Requiere que el usuario esté autenticado (para obtener el userId).
 * Añade un parámetro 'state' JWT que contiene el userId.
 */
router.get('/hubspot/connect', verifySupabaseToken, (req: Request, res: Response) => {
    console.log("Ruta: GET /api/auth/hubspot/connect - Iniciando flujo OAuth");

    // Usar req.user.id proporcionado por verifySupabaseToken
    const userId = req.user?.id;

    if (!userId) {
        console.error("Error: No se pudo obtener el userId del usuario autenticado.");
        return res.status(401).send("Usuario no autenticado.");
    }

    if (!HUBSPOT_CLIENT_ID || !HUBSPOT_REDIRECT_URI || !JWT_SECRET_KEY) {
        console.error("Error: Configuración OAuth incompleta en .env (CLIENT_ID, REDIRECT_URI, JWT_SECRET_KEY).");
        return res.status(500).send("Error de configuración del servidor para OAuth.");
    }

    // Crear el JWT para el parámetro state
    const statePayload = { userId: userId };
    const stateToken = jwt.sign(statePayload, JWT_SECRET_KEY, { expiresIn: '10m' }); // Expira en 10 minutos

    const authUrl = `https://app.hubspot.com/oauth/authorize?client_id=${encodeURIComponent(HUBSPOT_CLIENT_ID)}&redirect_uri=${encodeURIComponent(HUBSPOT_REDIRECT_URI)}&scope=${encodeURIComponent(HUBSPOT_SCOPES)}&response_type=code&state=${encodeURIComponent(stateToken)}`;

    console.log(`Redirigiendo a HubSpot para autorización para el usuario ${userId}...`);
    res.redirect(authUrl);
});

/**
 * GET /api/auth/hubspot/initiate
 * Paso 1 del flujo OAuth iniciado por el frontend.
 * Verifica la autenticación del usuario, genera el state JWT y la URL de autorización de HubSpot,
 * y devuelve la URL al frontend para la redirección.
 */
router.get('/hubspot/initiate', verifySupabaseToken, (req: Request, res: Response) => {
    console.log("Ruta: GET /api/auth/hubspot/initiate - Iniciando autorización OAuth");
    const userId = req.user?.id;

    if (!userId) {
        // Este caso no debería ocurrir si verifySupabaseToken funciona, pero por si acaso.
        console.error("[Hubspot Initiate] Error: No se pudo obtener el userId del usuario autenticado.");
        return res.status(401).json({ message: "Usuario no autenticado." });
    }

    if (!HUBSPOT_CLIENT_ID || !HUBSPOT_REDIRECT_URI || !JWT_SECRET_KEY) {
        console.error("[Hubspot Initiate] Error: Configuración OAuth incompleta en .env (CLIENT_ID, REDIRECT_URI, JWT_SECRET_KEY).");
        return res.status(500).json({ message: "Error de configuración del servidor para OAuth." });
    }

    try {
        // Crear el JWT para el parámetro state
        const statePayload = { userId: userId };
        const stateToken = jwt.sign(statePayload, JWT_SECRET_KEY, { expiresIn: '10m' });

        const authUrl = `https://app.hubspot.com/oauth/authorize?client_id=${encodeURIComponent(HUBSPOT_CLIENT_ID)}&redirect_uri=${encodeURIComponent(HUBSPOT_REDIRECT_URI)}&scope=${encodeURIComponent(HUBSPOT_SCOPES)}&response_type=code&state=${encodeURIComponent(stateToken)}`;

        console.log(`[Hubspot Initiate] Generada URL de autorización para usuario ${userId}.`);
        // Devolver la URL al frontend
        res.status(200).json({ authUrl: authUrl });

    } catch (error: any) {
        console.error(`[Hubspot Initiate] Error generando state/URL para usuario ${userId}:`, error);
        res.status(500).json({ message: "Error interno al iniciar la autorización de HubSpot." });
    }
});

/**
 * GET /api/auth/hubspot/callback
 * Ruta a la que HubSpot redirige después de la autorización del usuario.
 * Verifica el 'state', intercambia el código por tokens y guarda los tokens.
 */
router.get('/hubspot/callback', async (req: Request, res: Response) => {
    const authCode = req.query.code as string;
    const stateToken = req.query.state as string;
    const errorParam = req.query.error as string;

    console.log("Ruta: GET /api/auth/hubspot/callback - Recibido código:", authCode ? "Sí" : "No", "- State:", stateToken ? "Sí" : "No");

    // Redirección base para éxito/error en el frontend
    const successRedirectUrl = `${FRONTEND_URL}/settings/integrations?status=hubspot-success`; // Placeholder
    const errorRedirectUrl = `${FRONTEND_URL}/settings/integrations?status=hubspot-error`; // Placeholder

    if (errorParam) {
        console.error(`Error recibido de HubSpot en callback: ${errorParam}`);
        return res.redirect(`${errorRedirectUrl}&message=${encodeURIComponent(errorParam)}`);
    }

    if (!authCode || !stateToken) {
        console.error("Error: No se recibió el código de autorización o el parámetro state de HubSpot.");
        return res.redirect(`${errorRedirectUrl}&message=Missing_code_or_state`);
    }

    if (!HUBSPOT_CLIENT_ID || !HUBSPOT_CLIENT_SECRET || !HUBSPOT_REDIRECT_URI || !JWT_SECRET_KEY) {
        console.error("Error: Configuración OAuth incompleta en .env para el callback.");
        return res.redirect(`${errorRedirectUrl}&message=Server_config_error`);
    }

    // 1. Verificar el state JWT
    let userId: string;
    try {
        const decodedState = jwt.verify(stateToken, JWT_SECRET_KEY) as { userId: string };
        userId = decodedState.userId;
        if (!userId) throw new Error('userId no encontrado en el payload del state.');
        console.log(`State verificado exitosamente para el usuario: ${userId}`);
    } catch (err) {
        console.error("Error verificando el token state:", err);
        return res.redirect(`${errorRedirectUrl}&message=Invalid_state`);
    }

    // 2. Intercambiar código por tokens
    const tokenUrl = 'https://api.hubapi.com/oauth/v1/token';
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', HUBSPOT_CLIENT_ID);
    params.append('client_secret', HUBSPOT_CLIENT_SECRET);
    params.append('redirect_uri', HUBSPOT_REDIRECT_URI);
    params.append('code', authCode);

    try {
        console.log(`Intercambiando código por tokens para el usuario ${userId}...`);
        const response = await axios.post(tokenUrl, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const tokens = response.data; // Contiene access_token, refresh_token, expires_in
        console.log(`Tokens recibidos de HubSpot para el usuario ${userId}.`);

        // 3. Guardar tokens en Supabase
        await storeHubspotTokensForUser(userId, tokens);

        console.log(`Tokens guardados en DB para ${userId}. Redirigiendo al frontend...`);
        res.redirect(successRedirectUrl);

    } catch (error: any) {
        console.error(`Error en el proceso de callback para el usuario ${userId}:`);
        if (axios.isAxiosError(error) && error.response) {
            console.error("- Status:", error.response.status);
            console.error("- Data:", error.response.data);
        } else {
            console.error(error.message);
        }
        const errorMessage = error.response?.data?.message || error.message || "Unknown_error";
        res.redirect(`${errorRedirectUrl}&message=${encodeURIComponent(errorMessage)}`);
    }
});

export default router; // Exportar el router