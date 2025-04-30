import express from 'express';
import cors from 'cors';
import assistantRoutes from './routes/assistant';
import transcriptionRoutes from './routes/transcriptions';
import actionRoutes from './routes/actions';
import hubspotRoutes from './routes/hubspotRoutes';
import meetingsRoutes from './routes/meetingsRoutes';
import analysisRoutes from './routes/analysisRoutes';
import authRoutes from './routes/authRoutes';
import path from 'path';
import fs from 'fs';
import taskRoutes from './routes/taskRoutes';

const app = express();
const PORT = process.env.PORT || 3001;

// Crear directorio de uploads si no existe
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`Directorio de uploads creado: ${uploadsDir}`);
}

// Middlewares
app.use(cors({
    origin: ['http://localhost:8080', 'http://localhost:3001'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Permitir archivos hasta 10MB para audio
app.use(express.json({ limit: '10mb' }));
app.use(express.raw({ limit: '10mb' }));

// Registro de solicitudes para depuración
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    next();
});

// Rutas
app.use('/api/assistant', assistantRoutes);

// Ruta específica para transcripciones
app.use('/api/transcriptions', transcriptionRoutes);

// Ruta para acciones
app.use('/api/actions', actionRoutes);

// Rutas para HubSpot
app.use('/api/hubspot', hubspotRoutes);

// Rutas para Meetings
app.use('/api/meetings', meetingsRoutes);

// Rutas para Analysis
app.use('/api/analysis', analysisRoutes);

// Rutas para Autenticación (OAuth)
app.use('/api/auth', authRoutes);

// Ruta para tareas
app.use('/api/tasks', taskRoutes);

// Ruta de prueba para verificar que el servidor está funcionando
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Manejador de errores global
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error no manejado:', err);
    res.status(500).json({
        error: 'Error interno del servidor',
        message: err.message
    });
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
    console.log(`Endpoints disponibles:`);
    console.log(`- GET /api/health - Verificar estado del servidor`);
    console.log(`- POST /api/assistant/query - Consultar al asistente con texto`);
    console.log(`- POST /api/assistant/audio - Enviar audio para transcripción`);
    console.log(`- POST /api/transcriptions/:recordingId - Procesar grabación existente`);
    console.log(`- POST /api/actions/execute - Ejecutar acción sugerida`);
    console.log("--- HubSpot API ---");
    console.log(`- POST /api/hubspot/contacts/search - Buscar Contactos`);
    console.log(`- POST /api/hubspot/contacts - Crear Contacto`);
    console.log(`- POST /api/hubspot/companies/search - Buscar Empresas`);
    console.log(`- GET /api/hubspot/companies/:id - Obtener Empresa por ID`);
    console.log(`- POST /api/hubspot/companies - Crear Empresa`);
    console.log(`- PATCH /api/hubspot/companies/:id - Actualizar Empresa`);
    console.log(`- POST /api/hubspot/deals/search - Buscar Deals`);
    console.log(`- GET /api/hubspot/deals/:id - Obtener Deal por ID`);
    console.log(`- POST /api/hubspot/deals - Crear Deal (OAuth Token Req)`);
    console.log(`- PATCH /api/hubspot/deals/:identifier - Actualizar Deal (OAuth Token Req)`);
    console.log(`- POST /api/hubspot/tickets/search - Buscar Tickets`);
    console.log(`- GET /api/hubspot/tickets/:id - Obtener Ticket por ID`);
    console.log(`- POST /api/hubspot/tickets - Crear Ticket`);
    console.log(`- PATCH /api/hubspot/tickets/:id - Actualizar Ticket`);
    console.log(`- POST /api/hubspot/tasks/sync - Sincronizar Tarea`);
    console.log(`- POST /api/hubspot/sync-all-contacts - Sincronización Completa de Contactos`);
    console.log(`- POST /api/hubspot/sync-all-deals - Sincronización Completa de Deals`);
    console.log(`- GET /api/hubspot/status - Verificar conexión HubSpot`);
    console.log("--- Meetings API ---");
    console.log(`- POST /api/meetings/analyze - Analizar Transcripción`);
    console.log(`- POST /api/meetings/suggestions - Generar Sugerencias`);
    console.log("--- Analysis API ---");
    console.log(`- POST /api/analysis/activities - Analizar Actividades`);
    console.log("--- Auth API ---");
    console.log(`- GET /api/auth/hubspot/connect - Iniciar conexión HubSpot`);
    console.log(`- GET /api/auth/hubspot/callback - Callback OAuth HubSpot`);
    console.log(`- POST /api/tasks - Crear Tarea`);
});

export default app; 