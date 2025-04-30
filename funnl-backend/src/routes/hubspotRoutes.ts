import express, { Request, Response, Router } from 'express';
import axios from 'axios'; // <-- Importar axios
import { HubSpotService } from '../services/hubspotService'; // Ajusta la ruta si es necesario
// Importar middleware y gestor de tokens
import { verifySupabaseToken } from '../middleware/authMiddleware';
import { getHubspotAccessTokenForUser } from '../services/hubspotTokenManager';
import { createClient, SupabaseClient } from '@supabase/supabase-js'; // <-- Importar createClient
import dotenv from 'dotenv'; // <-- Importar dotenv

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

    // Verificar si el cliente supabase se inicializó correctamente
    if (!supabase) {
        console.error('[HubspotRoutes:/tasks/sync] Cliente Supabase no inicializado.');
        return res.status(500).json({ success: false, message: 'Error de configuración del servidor (Supabase).' });
    }

    console.log(`API Recibido: POST /tasks/sync para Supabase Task ID: ${supabaseTaskId} (User: ${userId})`);

    // Validación básica de entrada
    if (!supabaseTaskId || !hubspotObjectId || !hubspotObjectType || !taskData || !taskData.title) {
        return res.status(400).json({ success: false, message: "Faltan datos requeridos para la sincronización de tareas." });
    }
    if (!userAccessToken) {
        // Aunque el middleware requireHubspotToken ya lo verifica, doble chequeo
        return res.status(403).json({ success: false, message: "Token de HubSpot no disponible." });
    }

    try {
        // 1. Llamar al servicio para sincronizar con HubSpot
        const resultingHubspotTaskId = await hubspotService.syncTask(
            taskData,
            hubspotObjectId,
            hubspotObjectType,
            userAccessToken!,
            existingHubspotTaskId
        );

        console.log(`[HubspotRoutes] Tarea sincronizada con HubSpot. HS Task ID: ${resultingHubspotTaskId}`);

        // 2. Actualizar la tabla 'tasks' en Supabase con el ID de HubSpot y la fecha
        const { error: updateError } = await supabase
            .from('tasks')
            .update({
                hubspot_task_id: resultingHubspotTaskId, // Guardar el ID devuelto por HubSpot
                hubspot_last_synced: new Date().toISOString(), // Marcar hora de sincronización
                sync_status: 'completed' // Marcar como completada
            })
            .eq('id', supabaseTaskId); // Asegurarse de actualizar la tarea correcta

        if (updateError) {
            console.error(`[HubspotRoutes] Error actualizando tarea ${supabaseTaskId} en Supabase después del sync:`, updateError);
            return res.status(500).json({
                success: false,
                message: `Tarea sincronizada con HubSpot (ID: ${resultingHubspotTaskId}), pero falló la actualización en la base de datos local.`,
                hubspotTaskId: resultingHubspotTaskId,
                dbError: updateError.message
            });
        }

        console.log(`[HubspotRoutes] Tarea ${supabaseTaskId} actualizada en Supabase con HS Task ID ${resultingHubspotTaskId}.`);

        // 3. Devolver éxito
        res.status(200).json({
            success: true,
            message: "Tarea sincronizada con HubSpot correctamente.",
            hubspotTaskId: resultingHubspotTaskId
        });

    } catch (error: any) {
        console.error(`[HubspotRoutes] Error en /tasks/sync para Supabase Task ID ${supabaseTaskId} (User: ${userId}):`, error.message);
        // Marcar sync_status como 'failed' en Supabase podría ser útil aquí
        await supabase
            .from('tasks')
            .update({ sync_status: 'failed', hubspot_last_synced: new Date().toISOString() })
            .eq('id', supabaseTaskId);

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
                            const errorMsg = `[Sync All Deals] Conflicto: Deal de HubSpot ${hubspotDealId} ("${deal.title}") ya está vinculado al deal de Supabase ${existingSupabaseDeals.get(hubspotDealId)}. No se vinculará a ${deal.id}.`;
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

// Exportar el router para que pueda ser usado en server.ts
export default router; 