import express, { Request, Response, Router } from 'express';
import axios from 'axios'; // <-- Importar axios
import { HubSpotService } from '../services/hubspotService'; // Ajusta la ruta si es necesario
// Importar middleware y gestor de tokens
import { verifySupabaseToken } from '../middleware/authMiddleware';
import { getHubspotAccessTokenForUser } from '../services/hubspotTokenManager';
import { createClient, SupabaseClient } from '@supabase/supabase-js'; // <-- Importar createClient
import dotenv from 'dotenv'; // <-- Importar dotenv
// <<< INICIO CORRECCIÓN IMPORTACIÓN/DEFINICIÓN TIPO >>>
// Intentar importar desde una ruta común o definir aquí si no existe
// import { Task as SupabaseTask } from '../types'; // Ruta tentativa
// Definición actualizada basada en tipos generados
interface SupabaseTask {
    id: string;
    title: string;
    // Mantener tipos específicos para claridad en TS, aunque la DB sea text
    type: 'call' | 'email' | 'meeting' | 'follow-up' | 'other';
    time: string;                     // <-- Cambiado a NO NULO
    contact_id: string | null;
    status: 'pending' | 'completed' | 'overdue';
    priority: 'high' | 'medium' | 'low';
    created_at: string | null;
    updated_at: string | null;
    hubspot_id: string | null;
    hubspot_type: 'deal' | 'ticket' | 'contact' | 'company' | null;
    hubspot_owner: string | null;
    hubspot_status: string | null;
    hubspot_last_synced: string | null;
    sync_status: 'synced' | 'pending' | 'error' | null;
    hubspot_task_id: string | null;     // <-- Cambiado a no opcional
    // user_id: string | null;        // <-- Eliminado
}
// <<< FIN CORRECCIÓN IMPORTACIÓN/DEFINICIÓN TIPO >>>

dotenv.config(); // <-- Cargar variables de entorno

// --- Inicializar Cliente Supabase (igual que en authMiddleware) ---
let supabase: SupabaseClient | null = null;
const initializeSupabaseClient = () => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceRoleKey) {
        console.error('[HubspotRoutes] Error: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no definidos.');
        return null;
    }
    try {
        return createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        });
    } catch (error) {
        console.error('[HubspotRoutes] Error al inicializar el cliente Supabase:', error);
        return null;
    }
};
supabase = initializeSupabaseClient();
// --- Fin Inicialización Supabase ---

// Extender Request para incluir hubspotAccessToken opcional
declare global {
    namespace Express {
        interface Request {
            hubspotAccessToken?: string;
            user?: { id: string;[key: string]: any }; // <-- CORREGIR TIPO DE USER
        }
    }
}

// Crear una instancia del Router de Express
const router: Router = express.Router();

// Crear una instancia de nuestro servicio HubSpot
const hubspotService = new HubSpotService();

console.log("Router HubSpot: Cargado y servicio instanciado.");

// --- Aplicar Middleware de Autenticación a TODAS las rutas de HubSpot ---
router.use(verifySupabaseToken);

// Middleware de manejo de errores específico para token de HubSpot no encontrado
const requireHubspotToken = async (req: Request, res: Response, next: express.NextFunction) => {
    if (!req.user?.id) {
        // Esto no debería ocurrir si verifySupabaseToken funcionó, pero por seguridad
        return res.status(401).json({ success: false, message: "Usuario no autenticado." });
    }
    try {
        const userAccessToken = await getHubspotAccessTokenForUser(req.user.id);
        if (!userAccessToken) {
            console.warn(`[HubspotRoutes] Usuario ${req.user.id} no tiene token de HubSpot asociado.`);
            // 403 Forbidden - Autenticado pero no autorizado para esta acción específica (requiere conexión HubSpot)
            return res.status(403).json({
                success: false,
                message: "Acción requiere conexión con HubSpot. Por favor, conecta tu cuenta.",
                errorCode: 'HUBSPOT_CONNECTION_REQUIRED' // Código para que el frontend pueda guiar al usuario
            });
        }
        // Adjuntar el token de HubSpot a la request para fácil acceso en los handlers
        // Usamos la propiedad tipada
        req.hubspotAccessToken = userAccessToken;
        next();
    } catch (error: any) {
        console.error(`[HubspotRoutes] Error obteniendo token de HubSpot para usuario ${req.user.id}:`, error);
        return res.status(500).json({ success: false, message: "Error interno al verificar la conexión con HubSpot." });
    }
};

// Aplicar el middleware para verificar el token de HubSpot a todas las rutas
router.use(requireHubspotToken);

// GET /api/hubspot/status - Verificar si el usuario tiene conexión activa con HubSpot
router.get('/status', async (req: Request, res: Response) => {
    // El middleware verifySupabaseToken ya se ejecutó y nos da req.user.id
    // El middleware requireHubspotToken también se ejecutó y nos da req.hubspotAccessToken si todo está OK
    // Si llegamos aquí, significa que el usuario está autenticado Y tiene un token de HubSpot válido.

    // El middleware requireHubspotToken ya maneja el caso de no estar conectado (devuelve 403)
    // o de error interno (devuelve 500).
    // Si la ejecución llega hasta aquí, significa que la conexión está activa.
    console.log(`[HubspotRoutes] Verificación de estado para User ${req.user?.id}: Conectado.`);
    res.status(200).json({
        success: true,
        connected: true,
        message: "Conectado a HubSpot."
    });
    // Nota: No necesitamos llamar a getHubspotAccessTokenForUser aquí de nuevo,
    // porque el middleware requireHubspotToken ya lo hizo. Si ese middleware
    // hubiera fallado (por token no encontrado o expirado), no habría llegado aquí.
});

// --- Rutas para Contactos ---

// POST /api/hubspot/contacts/search - Buscar contactos
router.post('/contacts/search', async (req: Request, res: Response) => {
    const { searchTerm } = req.body;
    const userAccessToken = req.hubspotAccessToken; // Obtener token usando la propiedad tipada
    console.log(`API Recibido: POST /contacts/search con searchTerm: '${searchTerm}' (User: ${req.user?.id})`);

    if (!userAccessToken) {
        // Este caso ya debería estar cubierto por el middleware requireHubspotToken,
        // pero añadimos una comprobación por si acaso.
        return res.status(403).json({ success: false, message: "Token de HubSpot no disponible." });
    }
    if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim() === '') {
        return res.status(400).json({ success: false, message: "Parámetro 'searchTerm' es requerido." });
    }

    try {
        // Pasar el token del usuario al servicio
        const result = await hubspotService.findContact(searchTerm, userAccessToken);
        console.log(`API Éxito: Búsqueda contacto para '${searchTerm}' completada (User: ${req.user?.id}).`);
        res.status(200).json({ success: true, data: result });
    } catch (error: any) {
        console.error(`API Error en /contacts/search (User: ${req.user?.id}):`, error.message);
        res.status(500).json({ success: false, message: error.message || "Error interno buscando contactos." });
    }
});

// POST /api/hubspot/contacts - Crear un contacto
router.post('/contacts', async (req: Request, res: Response) => {
    const contactProperties = req.body;
    const userAccessToken = req.hubspotAccessToken; // Obtener token usando la propiedad tipada
    console.log(`API Recibido: POST /contacts (User: ${req.user?.id}) props:`, contactProperties);

    if (!userAccessToken) {
        return res.status(403).json({ success: false, message: "Token de HubSpot no disponible." });
    }
    if (!contactProperties || typeof contactProperties !== 'object') {
        return res.status(400).json({ success: false, message: "Cuerpo inválido." })
    }
    if (!contactProperties.firstname || typeof contactProperties.firstname !== 'string') {
        return res.status(400).json({ success: false, message: "'firstname' requerido." });
    }
    if (!contactProperties.email || typeof contactProperties.email !== 'string') {
        return res.status(400).json({ success: false, message: "'email' requerido." });
    }

    try {
        const result = await hubspotService.createContact(contactProperties, userAccessToken);
        console.log(`API Éxito: Contacto creado ID: ${result.id} (User: ${req.user?.id})`);
        res.status(201).json({ success: true, data: result });
    } catch (error: any) {
        console.error(`API Error en /contacts (User: ${req.user?.id}):`, error.message);
        let statusCode = 500;
        if (error.message.includes("Ya existe un contacto")) {
            statusCode = 409;
        }
        res.status(statusCode).json({ success: false, message: error.message || "Error interno creando contacto." });
    }
});

// --- Rutas para Empresas ---

// POST /api/hubspot/companies/search - Buscar empresas
router.post('/companies/search', async (req: Request, res: Response) => {
    const { searchTerm } = req.body;
    const userAccessToken = req.hubspotAccessToken; // Obtener token usando la propiedad tipada
    console.log(`API Recibido: POST /companies/search '${searchTerm}' (User: ${req.user?.id})`);
    if (!userAccessToken) {
        return res.status(403).json({ success: false, message: "Token de HubSpot no disponible." });
    }
    if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim() === '') {
        return res.status(400).json({ success: false, message: "'searchTerm' requerido." });
    }
    try {
        const result = await hubspotService.findCompany(searchTerm, userAccessToken);
        res.status(200).json({ success: true, data: result });
    } catch (error: any) {
        console.error(`API Error en /companies/search (User: ${req.user?.id}):`, error.message);
        res.status(500).json({ success: false, message: error.message || "Error interno buscando empresas." });
    }
});

// GET /api/hubspot/companies/:id - Obtener una empresa por ID
router.get('/companies/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const userAccessToken = req.hubspotAccessToken; // Obtener token usando la propiedad tipada
    console.log(`API Recibido: GET /companies/${id} (User: ${req.user?.id})`);
    if (!userAccessToken) {
        return res.status(403).json({ success: false, message: "Token de HubSpot no disponible." });
    }
    if (!id) {
        return res.status(400).json({ success: false, message: "Falta ID de empresa." });
    }
    try {
        const result = await hubspotService.getCompany(id, userAccessToken);
        res.status(200).json({ success: true, data: result });
    } catch (error: any) {
        console.error(`API Error en /companies/${id} (User: ${req.user?.id}):`, error.message);
        let statusCode = 500;
        if (error.message.includes("404")) {
            statusCode = 404;
        }
        res.status(statusCode).json({ success: false, message: error.message || `Error obteniendo empresa ${id}.` });
    }
});

// POST /api/hubspot/companies - Crear una empresa
router.post('/companies', async (req: Request, res: Response) => {
    const companyProperties = req.body;
    const userAccessToken = req.hubspotAccessToken; // Obtener token usando la propiedad tipada
    console.log(`API Recibido: POST /companies (User: ${req.user?.id}) props:`, companyProperties);
    if (!userAccessToken) {
        return res.status(403).json({ success: false, message: "Token de HubSpot no disponible." });
    }
    if (!companyProperties || typeof companyProperties !== 'object') {
        return res.status(400).json({ success: false, message: "Cuerpo inválido." })
    }
    if (!companyProperties.name || typeof companyProperties.name !== 'string') {
        return res.status(400).json({ success: false, message: "'name' requerido." });
    }
    try {
        const result = await hubspotService.createCompany(companyProperties, userAccessToken);
        console.log(`API Éxito: Empresa creada ID: ${result.id} (User: ${req.user?.id})`);
        res.status(201).json({ success: true, data: result });
    } catch (error: any) {
        console.error(`API Error en /companies (User: ${req.user?.id}):`, error.message);
        res.status(500).json({ success: false, message: error.message || "Error interno creando empresa." });
    }
});

// PATCH /api/hubspot/companies/:id - Actualizar una empresa
router.patch('/companies/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const propertiesToUpdate = req.body;
    const userAccessToken = req.hubspotAccessToken; // Obtener token usando la propiedad tipada
    console.log(`API Recibido: PATCH /companies/${id} (User: ${req.user?.id}) props:`, propertiesToUpdate);
    if (!userAccessToken) {
        return res.status(403).json({ success: false, message: "Token de HubSpot no disponible." });
    }
    if (!id) {
        return res.status(400).json({ success: false, message: "Falta ID de empresa." });
    }
    if (!propertiesToUpdate || typeof propertiesToUpdate !== 'object' || Object.keys(propertiesToUpdate).length === 0) {
        return res.status(400).json({ success: false, message: "Cuerpo inválido o vacío." });
    }

    try {
        const result = await hubspotService.updateCompany(id, propertiesToUpdate, userAccessToken);
        console.log(`API Éxito: Empresa ${id} actualizada (User: ${req.user?.id}).`);
        res.status(200).json({ success: true, data: result });
    } catch (error: any) {
        console.error(`API Error en PATCH /companies/${id} (User: ${req.user?.id}):`, error.message);
        let statusCode = 500;
        if (error.message.includes("404")) {
            statusCode = 404;
        }
        if (error.message.includes("No se proporcionaron propiedades")) {
            statusCode = 400;
        }
        res.status(statusCode).json({ success: false, message: error.message || `Error actualizando empresa ${id}.` });
    }
});

// --- Rutas para Deals ---

// POST /api/hubspot/deals/search - Buscar deals
router.post('/deals/search', async (req: Request, res: Response) => {
    const { searchTerm } = req.body;
    const userAccessToken = req.hubspotAccessToken; // Obtener token usando la propiedad tipada
    console.log(`API Recibido: POST /deals/search '${searchTerm}' (User: ${req.user?.id})`);
    if (!userAccessToken) {
        return res.status(403).json({ success: false, message: "Token de HubSpot no disponible." });
    }
    if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim() === '') {
        return res.status(400).json({ success: false, message: "'searchTerm' requerido." });
    }
    try {
        const result = await hubspotService.findDeal(searchTerm, userAccessToken);
        res.status(200).json({ success: true, data: result });
    } catch (error: any) {
        console.error(`API Error en /deals/search (User: ${req.user?.id}):`, error.message);
        res.status(500).json({ success: false, message: error.message || "Error interno buscando deals." });
    }
});

// GET /api/hubspot/deals/:id - Obtener un deal por ID
router.get('/deals/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const userAccessToken = req.hubspotAccessToken; // Obtener token usando la propiedad tipada
    console.log(`API Recibido: GET /deals/${id} (User: ${req.user?.id})`);
    if (!userAccessToken) {
        return res.status(403).json({ success: false, message: "Token de HubSpot no disponible." });
    }
    if (!id) {
        return res.status(400).json({ success: false, message: "Falta ID de deal." });
    }
    try {
        const result = await hubspotService.getDeal(id, userAccessToken);
        res.status(200).json({ success: true, data: result });
    } catch (error: any) {
        console.error(`API Error en /deals/${id} (User: ${req.user?.id}):`, error.message);
        let statusCode = 500;
        if (error.message.includes("404")) {
            statusCode = 404;
        }
        res.status(statusCode).json({ success: false, message: error.message || `Error obteniendo deal ${id}.` });
    }
});

// POST /api/hubspot/deals - Crear un deal
router.post('/deals', async (req: Request, res: Response) => {
    const dealProperties = req.body;
    const userAccessToken = req.hubspotAccessToken; // Obtener token usando la propiedad tipada
    console.log(`API Recibido: POST /deals (User: ${req.user?.id}) props:`, dealProperties);
    if (!userAccessToken) {
        return res.status(403).json({ success: false, message: "Token de HubSpot no disponible." });
    }
    if (!dealProperties || typeof dealProperties !== 'object') {
        return res.status(400).json({ success: false, message: "Cuerpo inválido." })
    }
    if (!dealProperties.dealname || typeof dealProperties.dealname !== 'string') {
        return res.status(400).json({ success: false, message: "'dealname' requerido." });
    }
    if (!dealProperties.dealstage || typeof dealProperties.dealstage !== 'string') {
        return res.status(400).json({ success: false, message: "'dealstage' (nombre) requerido." });
    }

    try {
        const result = await hubspotService.createDeal(dealProperties, userAccessToken);
        console.log(`API Éxito: Deal creado ID: ${result.id} (User: ${req.user?.id})`);
        res.status(201).json({ success: true, data: result });
    } catch (error: any) {
        console.error(`API Error en POST /deals (User: ${req.user?.id}):`, error.message);
        let statusCode = 500;
        if (error.message.includes("Nombre de etapa de deal inválido")) {
            statusCode = 400;
        }
        if (error.message.includes("Error al obtener las etapas")) {
            statusCode = 503;
        }
        res.status(statusCode).json({ success: false, message: error.message || "Error interno creando deal." });
    }
});

// PATCH /api/hubspot/deals/:id - Actualizar un deal
router.patch('/deals/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const propertiesToUpdate = req.body;
    const userAccessToken = req.hubspotAccessToken; // Obtener token usando la propiedad tipada
    console.log(`API Recibido: PATCH /deals/${id} (User: ${req.user?.id}) props:`, propertiesToUpdate);
    if (!userAccessToken) {
        return res.status(403).json({ success: false, message: "Token de HubSpot no disponible." });
    }
    if (!id) {
        return res.status(400).json({ success: false, message: "Falta identificador (ID o nombre) del deal." });
    }
    if (!propertiesToUpdate || typeof propertiesToUpdate !== 'object' || Object.keys(propertiesToUpdate).length === 0) {
        return res.status(400).json({ success: false, message: "Cuerpo inválido o vacío." });
    }

    try {
        const result = await hubspotService.updateDeal(id, propertiesToUpdate, userAccessToken);
        console.log(`API Éxito: Deal ${id} (resolved ID: ${result.id}) actualizado (User: ${req.user?.id}).`);
        res.status(200).json({ success: true, data: result });
    } catch (error: any) {
        console.error(`API Error en PATCH /deals/${id} (User: ${req.user?.id}):`, error.message);
        let statusCode = 500;
        if (error.message.includes("404") || error.message.includes("No se encontró deal")) {
            statusCode = 404;
        }
        if (error.message.includes("Múltiples deals encontrados")) {
            statusCode = 409; // Conflict - ambiguous identifier
        }
        if (error.message.includes("Nombre de etapa de deal inválido")) {
            statusCode = 400;
        }
        if (error.message.includes("No se proporcionaron propiedades")) {
            statusCode = 400;
        }
        if (error.message.includes("Error al obtener las etapas")) {
            statusCode = 503;
        }
        res.status(statusCode).json({ success: false, message: error.message || `Error actualizando deal ${id}.` });
    }
});

// --- Rutas para Tickets ---

// POST /api/hubspot/tickets/search - Buscar tickets
router.post('/tickets/search', async (req: Request, res: Response) => {
    const { searchTerm } = req.body;
    const userAccessToken = req.hubspotAccessToken;
    console.log(`API Recibido: POST /tickets/search '${searchTerm}' (User: ${req.user?.id})`);
    if (!userAccessToken) {
        return res.status(403).json({ success: false, message: "Token de HubSpot no disponible." });
    }
    if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim() === '') {
        return res.status(400).json({ success: false, message: "'searchTerm' requerido." });
    }
    try {
        const result = await hubspotService.findTicket(searchTerm, userAccessToken);
        res.status(200).json({ success: true, data: result });
    } catch (error: any) {
        console.error(`API Error en /tickets/search (User: ${req.user?.id}):`, error.message);
        res.status(500).json({ success: false, message: error.message || "Error interno buscando tickets." });
    }
});

// GET /api/hubspot/tickets/:id - Obtener un ticket por ID
router.get('/tickets/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const userAccessToken = req.hubspotAccessToken;
    console.log(`API Recibido: GET /tickets/${id} (User: ${req.user?.id})`);
    if (!userAccessToken) {
        return res.status(403).json({ success: false, message: "Token de HubSpot no disponible." });
    }
    if (!id) {
        return res.status(400).json({ success: false, message: "Falta ID de ticket." });
    }
    try {
        const result = await hubspotService.getTicket(id, userAccessToken);
        res.status(200).json({ success: true, data: result });
    } catch (error: any) {
        console.error(`API Error en /tickets/${id} (User: ${req.user?.id}):`, error.message);
        let statusCode = 500;
        if (error.message.includes("404")) {
            statusCode = 404;
        }
        res.status(statusCode).json({ success: false, message: error.message || `Error obteniendo ticket ${id}.` });
    }
});

// POST /api/hubspot/tickets - Crear un ticket
router.post('/tickets', async (req: Request, res: Response) => {
    const ticketProperties = req.body;
    const userAccessToken = req.hubspotAccessToken;
    console.log(`API Recibido: POST /tickets (User: ${req.user?.id}) props:`, ticketProperties);
    if (!userAccessToken) {
        return res.status(403).json({ success: false, message: "Token de HubSpot no disponible." });
    }
    if (!ticketProperties || typeof ticketProperties !== 'object') {
        return res.status(400).json({ success: false, message: "Cuerpo inválido." })
    }
    if (!ticketProperties.subject || !ticketProperties.content) {
        return res.status(400).json({ success: false, message: "'subject' y 'content' requeridos." });
    }
    try {
        const result = await hubspotService.createTicket(ticketProperties, userAccessToken);
        console.log(`API Éxito: Ticket creado ID: ${result.id} (User: ${req.user?.id})`);
        res.status(201).json({ success: true, data: result });
    } catch (error: any) {
        console.error(`API Error en POST /tickets (User: ${req.user?.id}):`, error.message);
        res.status(500).json({ success: false, message: error.message || "Error interno creando ticket." });
    }
});

// PATCH /api/hubspot/tickets/:id - Actualizar un ticket
router.patch('/tickets/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const propertiesToUpdate = req.body;
    const userAccessToken = req.hubspotAccessToken;
    console.log(`API Recibido: PATCH /tickets/${id} (User: ${req.user?.id}) props:`, propertiesToUpdate);
    if (!userAccessToken) {
        return res.status(403).json({ success: false, message: "Token de HubSpot no disponible." });
    }
    if (!id) {
        return res.status(400).json({ success: false, message: "Falta ID de ticket." });
    }
    if (!propertiesToUpdate || typeof propertiesToUpdate !== 'object' || Object.keys(propertiesToUpdate).length === 0) {
        return res.status(400).json({ success: false, message: "Cuerpo inválido o vacío." });
    }

    try {
        const result = await hubspotService.updateTicket(id, propertiesToUpdate, userAccessToken);
        console.log(`API Éxito: Ticket ${id} actualizado (User: ${req.user?.id}).`);
        res.status(200).json({ success: true, data: result });
    } catch (error: any) {
        console.error(`API Error en PATCH /tickets/${id} (User: ${req.user?.id}):`, error.message);
        let statusCode = 500;
        if (error.message.includes("404")) {
            statusCode = 404;
        }
        if (error.message.includes("No se proporcionaron propiedades")) {
            statusCode = 400;
        }
        res.status(statusCode).json({ success: false, message: error.message || `Error actualizando ticket ${id}.` });
    }
});

// GET /api/hubspot/pipelines/:objectType - Obtener pipelines
router.get('/pipelines/:objectType', async (req: Request, res: Response) => {
    const { objectType } = req.params;
    const userAccessToken = req.hubspotAccessToken; // Obtener token usando la propiedad tipada
    console.log(`API Recibido: GET /pipelines/${objectType} (User: ${req.user?.id})`);
    if (!userAccessToken) {
        return res.status(403).json({ success: false, message: "Token de HubSpot no disponible." });
    }
    // ... (resto del handler sin cambios) ...
});

// GET /api/hubspot/pipelines/:objectType/:pipelineId/stages - Obtener etapas de pipeline
router.get('/pipelines/:objectType/:pipelineId/stages', async (req: Request, res: Response) => {
    const { objectType, pipelineId } = req.params;
    const userAccessToken = req.hubspotAccessToken; // Obtener token usando la propiedad tipada
    console.log(`API Recibido: GET /pipelines/${objectType}/${pipelineId}/stages (User: ${req.user?.id})`);
    if (!userAccessToken) {
        return res.status(403).json({ success: false, message: "Token de HubSpot no disponible." });
    }
    // ... (resto del handler sin cambios) ...
});

// GET /api/hubspot/owners - Obtener owners
router.get('/owners', async (req: Request, res: Response) => {
    const userAccessToken = req.hubspotAccessToken; // Obtener token usando la propiedad tipada
    console.log(`API Recibido: GET /owners (User: ${req.user?.id})`);
    if (!userAccessToken) {
        return res.status(403).json({ success: false, message: "Token de HubSpot no disponible." });
    }
    // ... (resto del handler sin cambios) ...
});

// --- Definir tipo para el cuerpo de la solicitud de sincronización de tareas ---
interface SyncTaskRequestBody {
    supabaseTaskId: string; // ID de la tarea en nuestra DB
    hubspotObjectId: string; // ID del Contacto/Deal/etc. en HubSpot
    hubspotObjectType: 'contact' | 'deal' | 'company' | 'ticket'; // Tipo del objeto HubSpot
    existingHubspotTaskId?: string | null; // ID de la tarea en HubSpot si ya existe
    taskData: { // Datos de la tarea a sincronizar
        title: string;
        status: 'pending' | 'completed' | 'overdue';
        priority: 'low' | 'medium' | 'high';
        time: string;
    };
}

// --- Rutas para Tareas --- (Nueva sección)

// POST /api/hubspot/tasks/sync - Sincronizar una tarea con HubSpot
router.post('/tasks/sync', async (req: Request<{}, {}, SyncTaskRequestBody>, res: Response) => {
    const {
        supabaseTaskId,
        hubspotObjectId,
        hubspotObjectType,
        existingHubspotTaskId,
        taskData
    } = req.body;
    const userAccessToken = req.hubspotAccessToken;
    const userId = req.user?.id;

    if (!supabase) {
        console.error('[HubspotRoutes:/tasks/sync] Cliente Supabase no inicializado.');
        return res.status(500).json({ success: false, message: 'Error de configuración del servidor (Supabase).' });
    }

    console.log(`API Recibido: POST /tasks/sync para Supabase Task ID: ${supabaseTaskId} (User: ${userId})`);

    if (!supabaseTaskId || !hubspotObjectId || !hubspotObjectType || !taskData || !taskData.title) {
        return res.status(400).json({ success: false, message: "Faltan datos requeridos para la sincronización de tareas." });
    }
    if (!userAccessToken) {
        return res.status(403).json({ success: false, message: "Token de HubSpot no disponible." });
    }

    try {
        // 1. Sincronizar con HubSpot (Crear/Actualizar)
        const resultingHubspotTaskId = await hubspotService.syncTask(
            taskData,
            hubspotObjectId,
            hubspotObjectType,
            userAccessToken!,
            existingHubspotTaskId
        );

        console.log(`[HubspotRoutes] Tarea sincronizada con HubSpot. HS Task ID: ${resultingHubspotTaskId}`);

        // <<< INICIO: Buscar Supabase Contact ID si aplica >>>
        let supabaseContactId: string | null = null;
        if (hubspotObjectType === 'contact') {
            try {
                console.log(`[HubspotRoutes:/tasks/sync] Buscando Supabase contact ID para HubSpot contact ${hubspotObjectId}`);
                const { data: contactData, error: contactError } = await supabase
                    .from('contacts')
                    .select('id')
                    .eq('hubspot_id', hubspotObjectId) // Buscar por el ID de HubSpot
                    // No filtramos por user_id aquí, asumiendo que hubspot_id es único globalmente o que la FK se encargará
                    .maybeSingle();

                if (contactError) {
                    console.error(`[HubspotRoutes:/tasks/sync] Error DB buscando Supabase contact ID:`, contactError.message);
                    // No fallar toda la operación, solo loguear
                } else if (contactData) {
                    supabaseContactId = contactData.id;
                    console.log(`[HubspotRoutes:/tasks/sync] Encontrado Supabase contact ID: ${supabaseContactId}`);
                } else {
                    console.log(`[HubspotRoutes:/tasks/sync] No se encontró Supabase contact para HubSpot ID ${hubspotObjectId}`);
                }
            } catch (dbError: any) {
                console.error(`[HubspotRoutes:/tasks/sync] Excepción buscando Supabase contact ID:`, dbError);
                // Continuar de todas formas
            }
        }
        // <<< FIN: Buscar Supabase Contact ID >>>

        // 2. Actualizar la tabla 'tasks' en Supabase con el ID de HubSpot y el contact_id
        const updatePayload: Partial<SupabaseTask> = {
            hubspot_task_id: resultingHubspotTaskId,
            hubspot_last_synced: new Date().toISOString(),
            sync_status: 'synced', // <-- CORREGIDO: Usar 'synced' en lugar de 'completed'
            contact_id: supabaseContactId
        };

        // Eliminar contact_id si es null para no intentar insertar NULL explícitamente si la columna no lo permite
        // (Aunque la FK debería permitir NULL si no es requerida)
        // Mejor práctica: solo incluirlo si se encontró un valor.
        if (supabaseContactId === null) {
            delete updatePayload.contact_id;
        }

        const { error: updateError } = await supabase
            .from('tasks')
            .update(updatePayload)
            .eq('id', supabaseTaskId);

        if (updateError) {
            console.error(`[HubspotRoutes] Error actualizando tarea ${supabaseTaskId} en Supabase después del sync:`, updateError);
            // Devolver éxito parcial, ya que la sincronización con HS funcionó
            return res.status(200).json({
                success: true, // Indicar éxito parcial
                message: `Tarea sincronizada con HubSpot (ID: ${resultingHubspotTaskId}), pero falló la actualización del contact_id en la base de datos local.`,
                hubspotTaskId: resultingHubspotTaskId,
                warning: `No se pudo actualizar contact_id: ${updateError.message}`
            });
        }

        console.log(`[HubspotRoutes] Tarea ${supabaseTaskId} actualizada en Supabase con HS Task ID ${resultingHubspotTaskId} y Contact ID ${supabaseContactId}.`);

        // 3. Devolver éxito total
        res.status(200).json({
            success: true,
            message: "Tarea sincronizada con HubSpot y actualizada localmente.",
            hubspotTaskId: resultingHubspotTaskId
        });

    } catch (error: any) {
        console.error(`[HubspotRoutes] Error en /tasks/sync para Supabase Task ID ${supabaseTaskId} (User: ${userId}):`, error.message);
        // Marcar sync_status como 'failed' podría ser útil aquí
        await supabase?.from('tasks').update({ sync_status: 'failed', hubspot_last_synced: new Date().toISOString() }).eq('id', supabaseTaskId);

        res.status(500).json({
            success: false,
            message: error.message || "Error interno sincronizando tarea con HubSpot."
        });
    }
});

// --- Ruta de Sincronización Completa de Contactos ---
router.post('/sync-all-contacts', async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const userAccessToken = req.hubspotAccessToken; // Provided by requireHubspotToken middleware

    console.log(`[HubspotRoutes] Iniciando /sync-all-contacts para User ID: ${userId}`);

    if (!userId || !userAccessToken) {
        // Double check, though middlewares should prevent this
        return res.status(401).json({ success: false, message: "Autenticación o token de HubSpot faltante." });
    }
    if (!supabase) {
        console.error('[HubspotRoutes:/sync-all-contacts] Cliente Supabase no inicializado.');
        return res.status(500).json({ success: false, message: 'Error de configuración del servidor (Supabase).' });
    }

    let linkedContacts = 0;
    let importedContacts = 0;
    const errors: string[] = [];
    const supabaseEmails = new Set<string>();

    try {
        // 1. Obtener contactos de Supabase
        console.log(`[Sync All Contacts] Obteniendo contactos de Supabase para ${userId}`);
        const { data: supabaseContacts, error: sbError } = await supabase
            .from('contacts')
            .select('id, email, hubspot_id')
            .eq('user_id', userId);

        if (sbError) {
            console.error(`[Sync All Contacts] Error obteniendo contactos de Supabase:`, sbError);
            throw new Error(`Error al obtener contactos locales: ${sbError.message}`);
        }

        if (supabaseContacts) {
            console.log(`[Sync All Contacts] ${supabaseContacts.length} contactos encontrados en Supabase.`);
            supabaseContacts.forEach(c => {
                if (c.email) {
                    supabaseEmails.add(c.email.toLowerCase());
                }
            });

            // 2. Vincular contactos existentes
            for (const contact of supabaseContacts) {
                if (!contact.email || contact.hubspot_id) {
                    continue; // Saltar si no hay email o ya está vinculado
                }

                try {
                    console.log(`[Sync All Contacts] Buscando contacto HubSpot para email: ${contact.email}`);
                    // Usar API de búsqueda de HubSpot
                    const searchPayload = {
                        filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: contact.email }] }],
                        properties: ["email"], // Solo necesitamos el ID
                        limit: 1
                    };
                    const hsResponse = await axios.post(
                        "https://api.hubapi.com/crm/v3/objects/contacts/search",
                        searchPayload,
                        { headers: { Authorization: `Bearer ${userAccessToken}`, "Content-Type": "application/json" } }
                    );

                    if (hsResponse.data.total > 0 && hsResponse.data.results[0]) {
                        const hubspotContactId = hsResponse.data.results[0].id;
                        console.log(`[Sync All Contacts] Contacto HubSpot encontrado: ${hubspotContactId}. Vinculando con Supabase ID: ${contact.id}`);
                        // Actualizar Supabase
                        const { error: updateError } = await supabase
                            .from('contacts')
                            .update({ hubspot_id: hubspotContactId, hubspot_type: 'contact' })
                            .eq('id', contact.id);

                        if (updateError) {
                            const errorMsg = `Error actualizando Supabase para contacto ${contact.email}: ${updateError.message}`;
                            console.error(errorMsg);
                            errors.push(errorMsg);
                        } else {
                            linkedContacts++;
                        }
                    } else {
                        console.log(`[Sync All Contacts] No se encontró contacto en HubSpot para ${contact.email}`);
                    }
                } catch (linkError: any) {
                    const errorMsg = `Error buscando/vinculando contacto ${contact.email}: ${linkError.response?.data?.message || linkError.message}`;
                    console.error(errorMsg);
                    errors.push(errorMsg);
                }
            } // Fin del bucle de vinculación
        } // Fin if (supabaseContacts)

        // 3. Importar contactos desde HubSpot
        console.log(`[Sync All Contacts] Iniciando importación desde HubSpot...`);
        let after: string | undefined = undefined;
        const hubspotProperties = ["email", "firstname", "lastname", "phone", "company", "jobtitle"];
        let fetchMore = true;

        while (fetchMore) {
            try {
                const params: { limit: number; properties: string, after?: string } = {
                    limit: 50,
                    properties: hubspotProperties.join(',')
                };
                if (after) {
                    params.after = after;
                }

                const hsListResponse = await axios.get("https://api.hubapi.com/crm/v3/objects/contacts", {
                    headers: { Authorization: `Bearer ${userAccessToken}`, "Content-Type": "application/json" },
                    params: params
                });

                const hsData = hsListResponse.data;

                if (hsData.results && hsData.results.length > 0) {
                    for (const hsContact of hsData.results) {
                        const hsProperties = hsContact.properties;
                        const hsEmail = hsProperties.email?.toLowerCase();

                        if (!hsEmail || supabaseEmails.has(hsEmail)) {
                            continue; // Saltar si no hay email o ya existe localmente
                        }

                        // Preparar datos para insertar en Supabase
                        const newContact = {
                            user_id: userId,
                            email: hsEmail,
                            name: `${hsProperties.firstname || ''} ${hsProperties.lastname || ''}`.trim() || "Sin nombre",
                            company: hsProperties.company || "Sin empresa", // Asegurar no null
                            position: hsProperties.jobtitle || "Sin cargo", // Asegurar no null
                            phone: hsProperties.phone || "", // Asegurar no null
                            status: "lead", // <-- Cambiado de 'prospect' a 'lead'
                            hubspot_id: hsContact.id,
                            hubspot_type: "contact"
                        };

                        // Insertar en Supabase
                        const { error: insertError } = await supabase.from('contacts').insert(newContact);

                        if (insertError) {
                            const errorMsg = `Error insertando contacto importado ${hsEmail}: ${insertError.message}`;
                            console.error(errorMsg);
                            errors.push(errorMsg);
                        } else {
                            console.log(`[Sync All Contacts] Importado nuevo contacto desde HubSpot: ${hsEmail}`);
                            importedContacts++;
                            supabaseEmails.add(hsEmail); // Añadir al set para evitar duplicados en la misma ejecución
                        }
                    }
                } else {
                    fetchMore = false; // No hay más resultados en esta página
                }

                // Verificar paginación
                after = hsData.paging?.next?.after;
                if (!after) {
                    fetchMore = false; // No hay más páginas
                }

            } catch (importPageError: any) {
                const errorMsg = `Error obteniendo página de contactos de HubSpot: ${importPageError.response?.data?.message || importPageError.message}`;
                console.error(errorMsg);
                errors.push(errorMsg);
                fetchMore = false; // Detener si hay un error en la paginación
            }
        } // Fin del while de importación

        console.log(`[Sync All Contacts] Sincronización completada para User ID: ${userId}. Vinculados: ${linkedContacts}, Importados: ${importedContacts}. Errores: ${errors.length}`);

        // Respuesta final
        res.status(200).json({
            success: true,
            message: `Sincronización de contactos completada.`,
            details: {
                linked_contacts: linkedContacts,
                imported_contacts: importedContacts,
                errors: errors
            }
        });

    } catch (error: any) {
        console.error(`[Sync All Contacts] Error general durante la sincronización para User ID ${userId}:`, error);
        res.status(500).json({
            success: false,
            message: "Error interno durante la sincronización completa de contactos.",
            error: error.message,
            details: { // Devolver estado parcial si es posible
                linked_contacts: linkedContacts,
                imported_contacts: importedContacts,
                errors: errors.length > 0 ? errors : [error.message]
            }
        });
    }
});

// --- Ruta de Sincronización Completa de Deals ---
router.post('/sync-all-deals', async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const userAccessToken = req.hubspotAccessToken;

    console.log(`[HubspotRoutes] Iniciando /sync-all-deals para User ID: ${userId}`);

    if (!userId || !userAccessToken) {
        return res.status(401).json({ success: false, message: "Autenticación o token de HubSpot faltante." });
    }
    if (!supabase) {
        console.error('[HubspotRoutes:/sync-all-deals] Cliente Supabase no inicializado.');
        return res.status(500).json({ success: false, message: 'Error de configuración del servidor (Supabase).' });
    }

    let linkedDeals = 0;
    let importedDeals = 0;
    const errors: string[] = [];
    const existingSupabaseDeals = new Map<string, string>(); // hubspot_id -> supabase_id

    try {
        // 1. Obtener deals de Supabase
        console.log(`[Sync All Deals] Obteniendo deals de Supabase para ${userId}`);
        const { data: supabaseDeals, error: sbError } = await supabase
            .from('deals')
            .select('id, title, hubspot_id, value, stage_id, contact_id')
            .eq('owner_id', userId);

        if (sbError) {
            console.error(`[Sync All Deals] Error obteniendo deals de Supabase:`, sbError);
            throw new Error(`Error al obtener deals locales: ${sbError.message}`);
        }

        if (supabaseDeals) {
            console.log(`[Sync All Deals] ${supabaseDeals.length} deals encontrados en Supabase.`);
            supabaseDeals.forEach(d => {
                if (d.hubspot_id) {
                    existingSupabaseDeals.set(d.hubspot_id, d.id);
                }
            });

            // 2. Vincular deals existentes (Supabase -> HubSpot)
            for (const deal of supabaseDeals) {
                // Saltar si ya está vinculado o no tiene título para buscar
                if (deal.hubspot_id || !deal.title) {
                    continue;
                }

                try {
                    console.log(`[Sync All Deals] Buscando deal HubSpot por nombre: "${deal.title}"`);
                    // Buscar en HubSpot por dealname
                    const searchPayload = {
                        filterGroups: [{
                            filters: [{
                                propertyName: "dealname",
                                operator: "EQ",
                                value: deal.title
                            }]
                        }],
                        properties: ["dealname"], // Solo necesitamos el ID
                        limit: 2 // Pedir 2 para detectar duplicados
                    };
                    const hsResponse = await axios.post(
                        "https://api.hubapi.com/crm/v3/objects/deals/search",
                        searchPayload,
                        { headers: { Authorization: `Bearer ${userAccessToken}`, "Content-Type": "application/json" } }
                    );

                    if (hsResponse.data.total === 1 && hsResponse.data.results[0]) {
                        const hubspotDealId = hsResponse.data.results[0].id;
                        // Verificar si este ID de HubSpot ya está asignado a otro deal de Supabase
                        if (existingSupabaseDeals.has(hubspotDealId)) {
                            const errorMsg = `[Sync All Deals] Conflicto: Deal de HubSpot ${hubspotDealId} ("${deal.title}") ya está vinculado al deal de Supabase ${existingSupabaseDeals.get(hubspotDealId)}. No se vincula automáticamente.`;
                            console.warn(errorMsg);
                            errors.push(errorMsg);
                        } else {
                            console.log(`[Sync All Deals] Deal HubSpot encontrado: ${hubspotDealId}. Vinculando con Supabase ID: ${deal.id}`);
                            // Actualizar Supabase
                            const { error: updateError } = await supabase
                                .from('deals')
                                .update({ hubspot_id: hubspotDealId, hubspot_type: 'deal' })
                                .eq('id', deal.id);

                            if (updateError) {
                                const errorMsg = `Error actualizando Supabase para deal ${deal.id} ("${deal.title}"): ${updateError.message}`;
                                console.error(errorMsg);
                                errors.push(errorMsg);
                            } else {
                                linkedDeals++;
                                existingSupabaseDeals.set(hubspotDealId, deal.id); // Actualizar nuestro mapa
                            }
                        }
                    } else if (hsResponse.data.total > 1) {
                        const errorMsg = `[Sync All Deals] Nombre de deal "${deal.title}" (Supabase ID ${deal.id}) es ambiguo en HubSpot (${hsResponse.data.total} encontrados). No se vincula automáticamente.`;
                        console.warn(errorMsg);
                        errors.push(errorMsg);
                    } else {
                        console.log(`[Sync All Deals] No se encontró deal en HubSpot para "${deal.title}" (Supabase ID ${deal.id})`);
                    }
                } catch (linkError: any) {
                    const errorMsg = `Error buscando/vinculando deal "${deal.title}" (ID ${deal.id}): ${linkError.response?.data?.message || linkError.message}`;
                    console.error(errorMsg);
                    errors.push(errorMsg);
                }
            } // Fin del bucle de vinculación de deals
        } // Fin if (supabaseDeals)

        // 3. Importar deals desde HubSpot
        console.log(`[Sync All Deals] Iniciando importación de deals desde HubSpot...`);
        let after: string | undefined = undefined;
        const hubspotProperties = ["dealname", "amount", "dealstage", "pipeline", "hs_lastmodifieddate", "closedate"];
        let fetchMore = true;
        const defaultStageId = "3a91ac49-c727-4196-9a66-a6984a38ccd2"; // ID de etapa "Visitante"

        while (fetchMore) {
            try {
                const params: { limit: number; properties: string, after?: string /*, associations?: string */ } = {
                    limit: 50,
                    properties: hubspotProperties.join(','),
                    // associations: hubspotAssociations.join(',') // Descomentar si se piden asociaciones
                };
                if (after) {
                    params.after = after;
                }

                const hsListResponse = await axios.get("https://api.hubapi.com/crm/v3/objects/deals", {
                    headers: { Authorization: `Bearer ${userAccessToken}`, "Content-Type": "application/json" },
                    params: params
                });

                const hsData = hsListResponse.data;

                if (hsData.results && hsData.results.length > 0) {
                    for (const hsDeal of hsData.results) {
                        const hsProperties = hsDeal.properties;
                        const hubspotDealId = hsDeal.id;
                        // const hubspotStageId = hsProperties.dealstage; // Ya no necesitamos mapear

                        // Saltar si ya existe localmente
                        if (existingSupabaseDeals.has(hubspotDealId)) {
                            continue;
                        }

                        // --- Mapeo de Etapa Eliminado ---
                        /*
                        let supabaseStageId: string | undefined | null = null;
                        if (hubspotStageId) {
                            // supabaseStageId = hubspotToSupabaseStageMap.get(hubspotStageId);
                        }
                        if (!supabaseStageId) {
                             const errorMsg = `[Sync All Deals] Imposible importar Deal ID ${hubspotDealId} ("${hsProperties.dealname}"): Etapa de HubSpot ID '${hubspotStageId}' no encontrada en la tabla de mapeo 'pipeline_stages'.`;
                             console.warn(errorMsg);
                             errors.push(errorMsg);
                             continue; // Omitir este deal
                        }
                        */

                        // Mapeo básico de propiedades
                        const newDealData: any = {
                            owner_id: userId,
                            title: hsProperties.dealname || "Deal sin título",
                            value: parseFloat(hsProperties.amount) || 0,
                            stage_id: defaultStageId, // <-- Usar el ID de etapa por defecto
                            company: "Empresa no especificada",
                            contact_id: null, // Dejar null por ahora
                            status: 'active',
                            currency: 'USD',
                            expected_close_date: hsProperties.closedate || null,
                            hubspot_id: hubspotDealId,
                            hubspot_type: "deal",
                        };

                        // Insertar en Supabase
                        const { error: insertError } = await supabase.from('deals').insert(newDealData);

                        if (insertError) {
                            const errorMsg = `Error insertando deal importado ${hubspotDealId} ("${newDealData.title}"): ${insertError.message}`;
                            console.error(errorMsg);
                            errors.push(errorMsg);
                        } else {
                            console.log(`[Sync All Deals] Importado nuevo deal desde HubSpot: "${newDealData.title}" (HS ID: ${hubspotDealId}) con stage_id por defecto.`);
                            importedDeals++;
                        }
                    }
                } else {
                    fetchMore = false;
                }

                // Verificar paginación
                after = hsData.paging?.next?.after;
                if (!after) {
                    fetchMore = false;
                }

            } catch (importPageError: any) {
                const errorMsg = `Error obteniendo página de deals de HubSpot: ${importPageError.response?.data?.message || importPageError.message}`;
                console.error(errorMsg);
                errors.push(errorMsg);
                fetchMore = false;
            }
        } // Fin del while de importación de deals

        console.log(`[Sync All Deals] Sincronización completada para User ID: ${userId}. Vinculados: ${linkedDeals}, Importados: ${importedDeals}. Errores: ${errors.length}`);

        // Respuesta final
        res.status(200).json({
            success: true,
            message: `Sincronización de deals completada.`,
            details: {
                linked_deals: linkedDeals,
                imported_deals: importedDeals,
                errors: errors
            }
        });

    } catch (error: any) {
        console.error(`[Sync All Deals] Error general durante la sincronización para User ID ${userId}:`, error);
        res.status(500).json({
            success: false,
            message: "Error interno durante la sincronización completa de deals.",
            error: error.message,
            details: {
                linked_deals: linkedDeals,
                imported_deals: importedDeals,
                errors: errors.length > 0 ? errors : [error.message]
            }
        });
    }
});

// Interfaz local para Supabase Task (Ajustar a tu estructura real)
interface LocalSupabaseTask extends SupabaseTask {
    user_id?: string;
    // Añadir otros campos necesarios para comparación
    hubspot_status: string | null; // Asegurar que coincida con SupabaseTask
}

// --- RUTA MODIFICADA: Sincronización Completa de Tareas (HubSpot -> Supabase) ---
router.post('/sync-all-tasks', async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const userAccessToken = req.hubspotAccessToken;

    console.log(`[HubspotRoutes] Iniciando /sync-all-tasks para User ID: ${userId}`);

    if (!userId || !userAccessToken) {
        return res.status(401).json({ success: false, message: "Autenticación o token de HubSpot faltante." });
    }
    if (!supabase) {
        console.error('[HubspotRoutes:/sync-all-tasks] Cliente Supabase no inicializado.');
        return res.status(500).json({ success: false, message: 'Error de configuración del servidor (Supabase).' });
    }

    let importedTasks = 0;
    let updatedTasks = 0;
    const errors: string[] = [];
    const supabaseTaskMap = new Map<string, LocalSupabaseTask>();

    // --- Funciones Auxiliares Internas ---
    const mapHubspotStatusToLocal = (hsStatus: string | null | undefined): 'pending' | 'completed' => {
        if (hsStatus === 'COMPLETED') return 'completed';
        return 'pending';
    };
    const mapHubspotPriorityToLocal = (hsPriority: string | null | undefined): 'low' | 'medium' | 'high' => {
        switch (hsPriority?.toUpperCase()) {
            case 'LOW': return 'low';
            case 'HIGH': return 'high';
            case 'MEDIUM': default: return 'medium';
        }
    };
    const formatHubspotTimestamp = (hsTimestamp: string | number | null | undefined): string | null => {
        if (!hsTimestamp) return null;
        try {
            // Si ya es un string, asumimos que es ISO y lo validamos/devolvemos.
            if (typeof hsTimestamp === 'string') {
                // Intenta crear una fecha para validar el formato ISO
                if (!isNaN(new Date(hsTimestamp).getTime())) {
                    return hsTimestamp; // Ya es un ISO válido, devolverlo directamente
                } else {
                    console.warn(`[formatHubspotTimestamp] Received invalid date string: ${hsTimestamp}`);
                    return null; // Formato de string inválido
                }
            }
            // Si es un número, asumimos que son milisegundos y lo convertimos a ISO.
            else if (typeof hsTimestamp === 'number') {
                if (isNaN(hsTimestamp)) return null;
                return new Date(hsTimestamp).toISOString();
            }
            return null; // Tipo no esperado
        } catch (e) {
            console.error(`[formatHubspotTimestamp] Error processing timestamp ${hsTimestamp}:`, e);
            return null;
        }
    };
    const extractPrimaryAssociation = (associations: any): { id: string | null; type: 'contact' | 'deal' | 'company' | 'ticket' | null } => {
        if (!associations) return { id: null, type: null };
        if (associations.contacts?.results?.length > 0) return { id: associations.contacts.results[0].id, type: 'contact' };
        if (associations.deals?.results?.length > 0) return { id: associations.deals.results[0].id, type: 'deal' };
        if (associations.companies?.results?.length > 0) return { id: associations.companies.results[0].id, type: 'company' };
        if (associations.tickets?.results?.length > 0) return { id: associations.tickets.results[0].id, type: 'ticket' };
        return { id: null, type: null };
    };
    // Nueva función para mapear tipo
    const mapHubspotTaskTypeToLocal = (hsType: string | null | undefined): 'call' | 'email' | 'meeting' | 'follow-up' | 'other' => {
        switch (hsType?.toUpperCase()) {
            case 'CALL': return 'call';
            case 'EMAIL': return 'email';
            case 'MEETING': return 'meeting';
            case 'TODO': return 'other'; // HubSpot usa 'TODO' para tareas generales
            default: return 'other';
        }
    };
    // --- Fin Funciones Auxiliares Internas ---

    try {
        // 1. Obtener datos COMPLETOS de tareas existentes de Supabase
        console.log(`[Sync All Tasks] Obteniendo datos completos de tareas Supabase...`); // No filtrar por UserID
        const { data: supabaseTasksData, error: sbError } = await supabase
            .from('tasks')
            .select('id, hubspot_task_id, title, status, priority, time, hubspot_owner, hubspot_id, hubspot_type, hubspot_status')
        // .eq('user_id', userId); // <-- Eliminado filtro user_id

        if (sbError) {
            console.error(`[Sync All Tasks] Error obteniendo tareas completas de Supabase:`, sbError);
            throw new Error(`Error al obtener tareas locales: ${sbError.message}`);
        }

        if (supabaseTasksData) {
            console.log(`[Sync All Tasks] ${supabaseTasksData.length} tareas completas encontradas en Supabase.`);
            supabaseTasksData.forEach((t: any) => {
                if (t.hubspot_task_id) {
                    supabaseTaskMap.set(t.hubspot_task_id, t as LocalSupabaseTask);
                }
            });
        }

        // 2. Obtener todas las tareas desde HubSpot
        console.log(`[Sync All Tasks] Obteniendo tareas desde HubSpot...`);
        const hubspotTasks = await hubspotService.getAllTasks(userAccessToken);
        console.log(`[Sync All Tasks] ${hubspotTasks.length} tareas obtenidas de HubSpot.`);

        // 3. Iterar, comparar e importar/actualizar
        for (const hsTask of hubspotTasks) {
            // <<< INICIO LOG ASOCIACIONES >>>
            console.log(`[Sync All Tasks] Procesando HS Task ID: ${hsTask.id}. Estructura recibida (incl. associations):`, JSON.stringify(hsTask, null, 2));
            // <<< FIN LOG ASOCIACIONES >>>

            const hubspotTaskId = hsTask.id;
            const hsProperties = hsTask.properties;
            const existingSupabaseTask = supabaseTaskMap.get(hubspotTaskId);

            const association = extractPrimaryAssociation(hsTask.associations);
            const mappedHsData = {
                title: hsProperties.hs_task_subject || 'Tarea sin título',
                status: mapHubspotStatusToLocal(hsProperties.hs_task_status),
                priority: mapHubspotPriorityToLocal(hsProperties.hs_task_priority),
                time: formatHubspotTimestamp(hsProperties.hs_timestamp),
                hubspot_owner: hsProperties.hubspot_owner_id || null,
                hubspot_id: association.id,
                hubspot_type: association.type,
                hubspot_status_raw: hsProperties.hs_task_status || null,
                type: mapHubspotTaskTypeToLocal(hsProperties.hs_task_type),
                hs_createdate: hsProperties.hs_createdate
            };

            // <<< INICIO BÚSQUEDA contact_id >>>
            let supabaseContactId: string | null = null;
            if (mappedHsData.hubspot_type === 'contact' && mappedHsData.hubspot_id) {
                try {
                    // Buscar el ID de Supabase del contacto usando solo el hubspot_id
                    console.log(`[Sync All Tasks] Buscando Supabase contact ID para HubSpot contact ${mappedHsData.hubspot_id}`);
                    const { data: contactData, error: contactError } = await supabase
                        .from('contacts')
                        .select('id')
                        .eq('hubspot_id', mappedHsData.hubspot_id)
                        // .eq('user_id', userId) // <-- REVERTIDO: Quitar filtro user_id
                        .maybeSingle();

                    if (contactError) {
                        console.error(`[Sync All Tasks] Error DB buscando Supabase contact ID:`, contactError.message);
                        // No fallar toda la operación, solo loguear
                    } else if (contactData) {
                        supabaseContactId = contactData.id;
                        console.log(`[Sync All Tasks] Mapeado HubSpot contact ${mappedHsData.hubspot_id} a Supabase contact_id ${supabaseContactId}`);
                    } else {
                        console.log(`[Sync All Tasks] No se encontró Supabase contact para HubSpot ID ${mappedHsData.hubspot_id}`);
                    }
                } catch (dbError: any) {
                    console.error(`[Sync All Tasks] Excepción buscando Supabase contact ID:`, dbError);
                    // Continuar de todas formas
                }
            }
            // <<< FIN BÚSQUEDA contact_id >>>

            if (existingSupabaseTask) {
                // --- Lógica de Actualización ---
                const updates: Partial<LocalSupabaseTask> = {};
                let changed = false;

                // Determinar el valor de 'time' para Supabase
                // Prioridad: hs_timestamp (vía mappedHsData.time), luego hs_createdate, luego epoch
                // Ahora mappedHsData.time debería ser el ISO correcto si hs_timestamp existe y es válido.
                const timeForSupabase = mappedHsData.time ?? mappedHsData.hs_createdate ?? new Date(0).toISOString();
                // Usamos '??' (nullish coalescing) para priorizar time incluso si es una string vacía (aunque no debería serlo)
                // y solo usar hs_createdate si time es null o undefined.

                // <<< INICIO: Comparación de Tiempo Robusta >>>
                const existingTime = existingSupabaseTask.time; // ISO string de Supabase
                let timeChanged = false;

                // <<< NUEVO LOG >>>
                console.log(`[Sync All Tasks] Valores ANTES de new Date() para Tarea ${existingSupabaseTask.id}: timeForSupabase='${timeForSupabase}', existingTime='${existingTime}'`);

                try {
                    // Convertir ambos a timestamps numéricos para comparar
                    const timeForSupabaseMs = new Date(timeForSupabase).getTime();
                    const existingTimeMs = new Date(existingTime).getTime();

                    // Log para depuración
                    console.log(`[Sync All Tasks] Comparando Tiempos para Tarea ${existingSupabaseTask.id}:
                       - HubSpot (convertido): ${timeForSupabase} (${timeForSupabaseMs}ms)
                       - Supabase (existente): ${existingTime} (${existingTimeMs}ms)`);

                    // Comparar solo si ambos son números válidos
                    if (!isNaN(timeForSupabaseMs) && !isNaN(existingTimeMs)) {
                        if (timeForSupabaseMs !== existingTimeMs) {
                            timeChanged = true;
                        }
                    } else if (timeForSupabase !== existingTime) {
                        // Fallback a comparación de string si uno o ambos no son fechas válidas
                        // (esto puede ocurrir si uno es epoch y el otro no, etc.)
                        console.log(`[Sync All Tasks] Comparando tiempos como strings (fallback)`);
                        timeChanged = true;
                    }
                } catch (e) {
                    console.error(`[Sync All Tasks] Error comparando fechas para tarea ${existingSupabaseTask.id}, asumiendo cambio.`, e);
                    // Si hay error al comparar, asumir que cambió para estar seguros
                    timeChanged = true;
                }

                if (timeChanged) {
                    updates.time = timeForSupabase;
                    changed = true;
                    console.log(`[Sync All Tasks] -> Detectado cambio en el tiempo.`);
                }
                // <<< FIN: Comparación de Tiempo Robusta >>>

                if (mappedHsData.title !== existingSupabaseTask.title) { updates.title = mappedHsData.title; changed = true; console.log(`[Sync All Tasks] -> Cambio en title`); }
                if (mappedHsData.status !== existingSupabaseTask.status) { updates.status = mappedHsData.status; changed = true; console.log(`[Sync All Tasks] -> Cambio en status`); }
                if (mappedHsData.priority !== existingSupabaseTask.priority) { updates.priority = mappedHsData.priority; changed = true; console.log(`[Sync All Tasks] -> Cambio en priority`); }
                if (mappedHsData.type !== existingSupabaseTask.type) { updates.type = mappedHsData.type; changed = true; console.log(`[Sync All Tasks] -> Cambio en type`); }
                if (mappedHsData.hubspot_owner !== existingSupabaseTask.hubspot_owner) { updates.hubspot_owner = mappedHsData.hubspot_owner; changed = true; console.log(`[Sync All Tasks] -> Cambio en hubspot_owner`); }
                if (mappedHsData.hubspot_id !== existingSupabaseTask.hubspot_id) { updates.hubspot_id = mappedHsData.hubspot_id; changed = true; console.log(`[Sync All Tasks] -> Cambio en hubspot_id`); }
                if (mappedHsData.hubspot_type !== existingSupabaseTask.hubspot_type) { updates.hubspot_type = mappedHsData.hubspot_type; changed = true; console.log(`[Sync All Tasks] -> Cambio en hubspot_type`); }
                if (mappedHsData.hubspot_status_raw !== existingSupabaseTask.hubspot_status) { updates.hubspot_status = mappedHsData.hubspot_status_raw; changed = true; console.log(`[Sync All Tasks] -> Cambio en hubspot_status`); }
                if (supabaseContactId !== existingSupabaseTask.contact_id) { updates.contact_id = supabaseContactId; changed = true; console.log(`[Sync All Tasks] -> Cambio en contact_id`); }

                if (changed) {
                    updates.hubspot_last_synced = new Date().toISOString();
                    updates.sync_status = 'synced';
                    console.log(`[Sync All Tasks] Actualizando tarea Supabase ID ${existingSupabaseTask.id} (HS Task ID: ${hubspotTaskId}) con:`, updates);
                    try {
                        const { error: updateError } = await supabase.from('tasks').update(updates).eq('id', existingSupabaseTask.id);
                        if (updateError) throw updateError;
                        updatedTasks++;
                    } catch (updateError: any) {
                        const errorMsg = `Error actualizando tarea Supabase ${existingSupabaseTask.id} desde HS ${hubspotTaskId}: ${updateError.message}`;
                        console.error(errorMsg);
                        errors.push(errorMsg);
                    }
                }
                // --- Fin Lógica de Actualización ---
            } else {
                // --- Lógica de Inserción (Tarea Nueva) ---
                // Determinar el valor de 'time' para Supabase
                const timeForSupabase = mappedHsData.time ||
                    mappedHsData.hs_createdate ||
                    new Date(0).toISOString();

                const newTaskData = {
                    title: mappedHsData.title,
                    type: mappedHsData.type,
                    time: timeForSupabase, // <-- Usar el valor calculado con fallback
                    contact_id: supabaseContactId,
                    status: mappedHsData.status,
                    priority: mappedHsData.priority,
                    hubspot_task_id: hubspotTaskId,
                    hubspot_id: mappedHsData.hubspot_id,
                    hubspot_type: mappedHsData.hubspot_type,
                    hubspot_owner: mappedHsData.hubspot_owner,
                    hubspot_status: mappedHsData.hubspot_status_raw,
                    hubspot_last_synced: new Date().toISOString(),
                    sync_status: 'synced'
                };
                try {
                    const { error: insertError } = await supabase.from('tasks').insert(newTaskData);
                    if (insertError) throw insertError;
                    console.log(`[Sync All Tasks] Importada nueva tarea desde HubSpot: "${newTaskData.title}" (HS Task ID: ${hubspotTaskId})`);
                    importedTasks++;
                } catch (insertError: any) {
                    const errorMsg = `Error insertando tarea importada ${hubspotTaskId} ("${newTaskData.title}"): ${insertError.message}`;
                    console.error(errorMsg);
                    if (insertError.code === '23505') {
                        console.warn(`[Sync All Tasks] La tarea ${hubspotTaskId} parece haber sido creada concurrentemente. Saltando.`);
                    } else {
                        errors.push(errorMsg);
                    }
                }
                // --- Fin Lógica de Inserción ---
            }
        } // Fin del bucle

        console.log(`[Sync All Tasks] Sincronización completada para User ID: ${userId}. Importadas: ${importedTasks}, Actualizadas: ${updatedTasks}. Errores: ${errors.length}`);

        res.status(200).json({
            success: true,
            message: `Sincronización de tareas completada.`,
            details: {
                imported_tasks: importedTasks,
                updated_tasks: updatedTasks,
                errors: errors
            }
        });

    } catch (error: any) {
        console.error(`[Sync All Tasks] Error general durante la sincronización para User ID ${userId}:`, error);
        res.status(500).json({
            success: false,
            message: "Error interno durante la sincronización completa de tareas.",
            error: error.message,
            details: {
                imported_tasks: importedTasks,
                updated_tasks: updatedTasks,
                errors: errors.length > 0 ? errors : [error.message]
            }
        });
    }
});
// --- Fin Ruta Modificada ---

// Exportar el router con tipo explícito
const hubspotRouter: Router = router;
export default hubspotRouter; 