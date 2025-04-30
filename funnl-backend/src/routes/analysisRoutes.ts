import express, { Request, Response, Router } from 'express';
import { AnalysisService } from '../services/analysisService'; // Ajusta la ruta si es necesario

const router: Router = express.Router();
const analysisService = new AnalysisService();

console.log("Router Analysis: Cargado y servicio instanciado.");

// POST /api/analysis/activities - Analizar lista de actividades
router.post('/activities', async (req: Request, res: Response) => {
    // Esperamos un cuerpo como: { activities: Activity[], userId: string, timeRange?: { start: string, end: string } }
    const { activities, userId, timeRange } = req.body;
    console.log(`API Recibido: POST /analysis/activities para usuario ${userId}`);

    // Validaciones de entrada
    if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ success: false, message: "La propiedad 'userId' es requerida." });
    }
    if (!Array.isArray(activities)) {
        return res.status(400).json({ success: false, message: "La propiedad 'activities' es requerida y debe ser un array." });
    }
    // Podrías añadir validación más profunda de la estructura de cada actividad si es necesario
    if (timeRange && (typeof timeRange !== 'object' || !timeRange.start || !timeRange.end)) {
        return res.status(400).json({ success: false, message: "La propiedad 'timeRange' debe ser un objeto con 'start' y 'end' si se proporciona." });
    }

    try {
        const result = await analysisService.analyzeActivities(activities, userId, timeRange);
        // Comprobar si el servicio devolvió un error interno
        if (result.error) {
            console.warn("API Info: analysisService.analyzeActivities devolvió un error:", result.error);
            return res.status(500).json({ success: false, message: result.error });
        }
        console.log("API Éxito: Análisis de actividades completado.");
        res.status(200).json({ success: true, data: result }); // result contiene { insights, metadata }
    } catch (error: any) {
        console.error("API Error en /analysis/activities:", error.message);
        res.status(500).json({ success: false, message: error.message || "Error interno del servidor analizando actividades." });
    }
});

export default router; 