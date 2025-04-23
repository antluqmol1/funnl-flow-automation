import { supabase } from '@/lib/supabase';

/**
 * Identifica y extrae entidades relevantes del texto
 */
export interface Entity {
    text: string;
    type: 'person' | 'organization' | 'location' | 'date' | 'task' | 'other';
    start: number;
    end: number;
    score?: number;
}

/**
 * Analiza el sentimiento del texto
 */
export interface SentimentResult {
    score: number; // -1 (muy negativo) a 1 (muy positivo)
    label: 'positive' | 'neutral' | 'negative';
    confidence: number;
    segments?: Array<{
        text: string;
        score: number;
        start: number;
        end: number;
    }>;
}

/**
 * Análisis de temas en la transcripción
 */
export interface TopicResult {
    topic: string;
    relevance: number; // 0-1
    keywords: string[];
    segments: Array<{
        text: string;
        start: number;
        end: number;
    }>;
}

/**
 * Elemento de acción extraído
 */
export interface ActionItem {
    text: string;
    assignee?: string;
    dueDate?: string;
    priority?: 'high' | 'medium' | 'low';
    start: number;
    end: number;
}

/**
 * Solicita análisis de entidades para una transcripción
 */
export async function analyzeEntities(
    recordingId: string,
    transcription: string
): Promise<{ entities: Entity[]; error?: string }> {
    try {
        // En una implementación real, esto haría una llamada a la API
        // Por ahora, simularemos algunas entidades básicas
        const entities: Entity[] = [];

        // Detectar nombres (simplificado)
        const namePattern = /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g;
        let match;
        while ((match = namePattern.exec(transcription)) !== null) {
            entities.push({
                text: match[0],
                type: 'person',
                start: match.index,
                end: match.index + match[0].length,
                score: 0.8
            });
        }

        // Detectar organizaciones (simplificado)
        const orgPattern = /\b([A-Z][a-z]* (Inc|LLC|Ltd|SA|SL))\b/g;
        while ((match = orgPattern.exec(transcription)) !== null) {
            entities.push({
                text: match[0],
                type: 'organization',
                start: match.index,
                end: match.index + match[0].length,
                score: 0.75
            });
        }

        // Detectar fechas (simplificado)
        const datePattern = /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g;
        while ((match = datePattern.exec(transcription)) !== null) {
            entities.push({
                text: match[0],
                type: 'date',
                start: match.index,
                end: match.index + match[0].length,
                score: 0.9
            });
        }

        // Guardar resultados en Supabase para uso futuro
        await supabase
            .from('meeting_analytics')
            .upsert({
                recording_id: recordingId,
                entities: entities,
                analyzed_at: new Date().toISOString(),
                type: 'entity_recognition'
            });

        return { entities };
    } catch (error) {
        console.error('Error al analizar entidades:', error);
        return {
            entities: [],
            error: 'No se pudieron analizar las entidades del texto'
        };
    }
}

/**
 * Analiza el sentimiento de la transcripción
 */
export async function analyzeSentiment(
    recordingId: string,
    transcription: string
): Promise<{ sentiment: SentimentResult; error?: string }> {
    try {
        // Simulamos análisis de sentimiento
        // Determinar puntuación basada en palabras positivas/negativas
        const positiveWords = ['bueno', 'excelente', 'genial', 'increíble', 'éxito'];
        const negativeWords = ['malo', 'terrible', 'problema', 'error', 'fallo'];

        let score = 0;
        const segments: SentimentResult['segments'] = [];
        const transcriptionLower = transcription.toLowerCase();

        // Contar palabras positivas
        positiveWords.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            let match;
            while ((match = regex.exec(transcriptionLower)) !== null) {
                score += 0.1;
                segments.push({
                    text: match[0],
                    score: 0.8,
                    start: match.index,
                    end: match.index + match[0].length
                });
            }
        });

        // Contar palabras negativas
        negativeWords.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            let match;
            while ((match = regex.exec(transcriptionLower)) !== null) {
                score -= 0.1;
                segments.push({
                    text: match[0],
                    score: -0.8,
                    start: match.index,
                    end: match.index + match[0].length
                });
            }
        });

        // Normalizar score entre -1 y 1
        score = Math.max(-1, Math.min(1, score));

        const result: SentimentResult = {
            score,
            label: score > 0.2 ? 'positive' : score < -0.2 ? 'negative' : 'neutral',
            confidence: 0.7,
            segments
        };

        // Guardar resultados
        await supabase
            .from('meeting_analytics')
            .upsert({
                recording_id: recordingId,
                sentiment: result,
                analyzed_at: new Date().toISOString(),
                type: 'sentiment_analysis'
            });

        return { sentiment: result };
    } catch (error) {
        console.error('Error al analizar sentimiento:', error);
        return {
            sentiment: {
                score: 0,
                label: 'neutral',
                confidence: 0
            },
            error: 'No se pudo analizar el sentimiento del texto'
        };
    }
}

/**
 * Extrae temas principales de la transcripción
 */
export async function analyzeTopics(
    recordingId: string,
    transcription: string
): Promise<{ topics: TopicResult[]; error?: string }> {
    try {
        // Simulamos análisis de temas
        // En una implementación real, esto usaría un modelo de ML para clustering y LDA
        const topics: TopicResult[] = [
            {
                topic: 'Ventas',
                relevance: 0.85,
                keywords: ['cliente', 'venta', 'producto', 'precio'],
                segments: []
            },
            {
                topic: 'Marketing',
                relevance: 0.7,
                keywords: ['campaña', 'publicidad', 'redes', 'impacto'],
                segments: []
            },
            {
                topic: 'Desarrollo',
                relevance: 0.6,
                keywords: ['código', 'feature', 'versión', 'desarrollo'],
                segments: []
            }
        ];

        // Buscar segmentos para cada tema
        topics.forEach(topic => {
            topic.keywords.forEach(keyword => {
                const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                let match;
                while ((match = regex.exec(transcription)) !== null) {
                    // Extraer un segmento de 50 caracteres alrededor de la palabra clave
                    const start = Math.max(0, match.index - 25);
                    const end = Math.min(transcription.length, match.index + keyword.length + 25);

                    topic.segments.push({
                        text: transcription.substring(start, end),
                        start,
                        end
                    });
                }
            });
        });

        // Guardar resultados
        await supabase
            .from('meeting_analytics')
            .upsert({
                recording_id: recordingId,
                topics,
                analyzed_at: new Date().toISOString(),
                type: 'topic_analysis'
            });

        return { topics };
    } catch (error) {
        console.error('Error al analizar temas:', error);
        return {
            topics: [],
            error: 'No se pudieron extraer los temas principales'
        };
    }
}

/**
 * Extrae elementos de acción (tareas) de la transcripción
 */
export async function extractActionItems(
    recordingId: string,
    transcription: string
): Promise<{ actions: ActionItem[]; error?: string }> {
    try {
        // Simulamos extracción de acciones
        // En una implementación real, esto usaría NLP para identificar frases de acción
        const actionPhrases = [
            'necesitamos',
            'hay que',
            'debemos',
            'tenemos que',
            'pendiente',
            'para mañana',
            'asignar',
            'implementar'
        ];

        const actions: ActionItem[] = [];

        // Buscar frases de acción
        actionPhrases.forEach(phrase => {
            const regex = new RegExp(`\\b${phrase}\\b(.{5,50})`, 'gi');
            let match;
            while ((match = regex.exec(transcription)) !== null) {
                // Extraer la frase completa
                const actionText = (match[0] + match[1]).trim();

                // Intentar detectar asignado (nombre después de "asignar a" o similar)
                let assignee = undefined;
                const assigneeMatch = actionText.match(/(?:asignar|asignado|para) (?:a |para )?([A-Z][a-z]+ [A-Z][a-z]+)/);
                if (assigneeMatch) {
                    assignee = assigneeMatch[1];
                }

                // Intentar detectar fecha límite
                let dueDate = undefined;
                const dateMatch = actionText.match(/(para|el|antes del) (\d{1,2}\/\d{1,2}|\d{1,2} de [a-z]+)/i);
                if (dateMatch) {
                    dueDate = dateMatch[2];
                }

                // Detectar prioridad
                let priority: ActionItem['priority'] = undefined;
                if (actionText.match(/urgent|inmediato|crítico|alta prioridad/i)) {
                    priority = 'high';
                } else if (actionText.match(/cuando puedas|baja prioridad|si hay tiempo/i)) {
                    priority = 'low';
                } else {
                    priority = 'medium';
                }

                actions.push({
                    text: actionText,
                    assignee,
                    dueDate,
                    priority,
                    start: match.index,
                    end: match.index + actionText.length
                });
            }
        });

        // Guardar resultados
        await supabase
            .from('meeting_analytics')
            .upsert({
                recording_id: recordingId,
                actions,
                analyzed_at: new Date().toISOString(),
                type: 'action_items'
            });

        return { actions };
    } catch (error) {
        console.error('Error al extraer elementos de acción:', error);
        return {
            actions: [],
            error: 'No se pudieron extraer los elementos de acción'
        };
    }
} 