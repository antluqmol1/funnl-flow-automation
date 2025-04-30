import express, { Request, Response, Router } from 'express';
import { MeetingsService } from '../services/meetingsService'; // Ajusta la ruta si es necesario

const router: Router = express.Router();
const meetingsService = new MeetingsService();

console.log("Router Meetings: Cargado y servicio instanciado.");

// POST /api/meetings/analyze - Analizar transcripción
router.post('/analyze', async (req: Request, res: Response) => {
    const { transcriptionText } = req.body;
    console.log(`API Recibido: POST /meetings/analyze`);

    if (!transcriptionText || typeof transcriptionText !== 'string' || transcriptionText.trim() === '') {
        return res.status(400).json({ success: false, message: "La propiedad 'transcriptionText' es requerida y debe ser un string no vacío." });
    }

    try {
        const result = await meetingsService.analyzeTranscription(transcriptionText);
        // Comprobar si el servicio devolvió un error interno
        if (result.error) {
            console.warn("API Info: meetingsService.analyzeTranscription devolvió un error:", result.error);
            // Devolver 500 o un código más específico si es posible
            return res.status(500).json({ success: false, message: result.error });
        }
        console.log("API Éxito: Análisis de transcripción completado.");
        res.status(200).json({ success: true, data: result });
    } catch (error: any) {
        console.error("API Error en /meetings/analyze:", error.message);
        res.status(500).json({ success: false, message: error.message || "Error interno del servidor analizando transcripción." });
    }
});

// POST /api/meetings/suggestions - Generar sugerencias de reunión
router.post('/suggestions', async (req: Request, res: Response) => {
    const { transcriptionText, summary, keyPoints } = req.body;
    console.log(`API Recibido: POST /meetings/suggestions`);

    if (!transcriptionText || typeof transcriptionText !== 'string' || transcriptionText.trim() === '') {
        return res.status(400).json({ success: false, message: "La propiedad 'transcriptionText' es requerida." });
    }
    // Validaciones opcionales para summary y keyPoints
    if (summary !== undefined && typeof summary !== 'string') {
        return res.status(400).json({ success: false, message: "La propiedad 'summary' debe ser un string si se proporciona." });
    }
    if (keyPoints !== undefined && !Array.isArray(keyPoints)) {
        return res.status(400).json({ success: false, message: "La propiedad 'keyPoints' debe ser un array si se proporciona." });
    }
    // Podrías añadir validación de que los elementos de keyPoints sean strings

    try {
        const result = await meetingsService.generateMeetingSuggestions(transcriptionText, summary, keyPoints);
        if (result.error) {
            console.warn("API Info: meetingsService.generateMeetingSuggestions devolvió un error:", result.error);
            return res.status(500).json({ success: false, message: result.error });
        }
        console.log("API Éxito: Generación de sugerencias completada.");
        res.status(200).json({ success: true, data: result }); // result ya contiene { suggestions: [...] }
    } catch (error: any) {
        console.error("API Error en /meetings/suggestions:", error.message);
        res.status(500).json({ success: false, message: error.message || "Error interno del servidor generando sugerencias." });
    }
});

export default router; 