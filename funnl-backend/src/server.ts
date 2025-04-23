import express from 'express';
import cors from 'cors';
import assistantRoutes from './routes/assistant';
import transcriptionRoutes from './routes/transcriptions';
import path from 'path';
import fs from 'fs';

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
    origin: ['http://localhost:8080', 'http://localhost:3001', 'http://localhost:8000'],
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
});

export default app; 