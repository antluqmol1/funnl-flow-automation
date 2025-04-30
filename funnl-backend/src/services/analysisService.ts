import { format, getDay, getHours, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale'; // Importar locale español para nombres de días

// Interfaces para la estructura de datos
interface Activity {
    type: string; // Tipo de actividad (ej: 'call', 'email', 'meeting')
    time?: string; // Fecha/hora en formato ISO 8601 (ej: '2023-10-27T10:30:00Z')
    // ... otras propiedades que puedan tener tus actividades
}

interface TimePatterns {
    by_day: Record<string, number>; // Día de la semana -> contador
    by_hour: Record<string, number>; // Hora (0-23) -> contador
    peak_day: string | null; // Nombre del día con más actividad
    peak_hour: number | null; // Hora del día con más actividad
}

interface Insight {
    type: 'pattern' | 'insight' | string; // Tipo de insight generado
    content: string; // Descripción del insight
    priority: number; // Nivel de prioridad/importancia
    metadata?: any; // Datos adicionales asociados al insight
}

interface AnalysisResult {
    insights: Insight[];
    metadata: {
        analyzed_at: string; // ISO timestamp del análisis
        total_activities: number;
        analysis_period?: { start: string, end: string }; // Rango de tiempo analizado (opcional)
    };
    error?: string; // Campo de error opcional
}

export class AnalysisService {

    constructor() {
        console.log("Servicio Analysis: Inicializado.");
    }

    // --- Método Helper para Análisis Temporal ---

    /**
     * Analiza los patrones temporales (día de la semana, hora) de una lista de actividades.
     * @param activities Lista de objetos Activity.
     * @returns Objeto TimePatterns con los contadores y picos, o { no_data: true }.
     * @private
     */
    private _analyzeTimePatterns(activities: Activity[]): TimePatterns | { no_data: true } {
        if (!activities || activities.length === 0) {
            return { no_data: true };
        }

        // Usaremos Record<string, number> para simular los Counters de Python
        const activityCountsByDay: Record<string, number> = {}; // Nombre del día -> count
        const activityCountsByHour: Record<string, number> = {}; // Hora (0-23) -> count

        for (const activity of activities) {
            if (activity.time) {
                try {
                    const time = parseISO(activity.time);
                    // Validar que la fecha sea válida después de parsear
                    if (!isValid(time)) {
                        console.warn(`Servicio Analysis: Fecha inválida encontrada en actividad: ${activity.time}`);
                        continue; // Saltar esta actividad si la fecha no es válida
                    }

                    // Obtener día de la semana en español (ej: 'lunes', 'martes')
                    // 'EEEE' da el nombre completo. Usamos el locale 'es'.
                    const dayOfWeek = format(time, 'EEEE', { locale: es });
                    // Obtener la hora (0-23)
                    const hour = getHours(time);

                    // Incrementar contadores
                    activityCountsByDay[dayOfWeek] = (activityCountsByDay[dayOfWeek] || 0) + 1;
                    // Guardamos la hora como string para consistencia con by_day
                    activityCountsByHour[hour.toString()] = (activityCountsByHour[hour.toString()] || 0) + 1;

                } catch (e) {
                    // Captura errores de parseISO si el formato no es ISO 8601
                    console.warn(`Servicio Analysis: Error parseando fecha de actividad: ${activity.time}`, e);
                    // Continuar con la siguiente actividad
                }
            }
        }

        // Función helper para encontrar la clave con el valor máximo en un Record
        const findPeakKey = (counts: Record<string, number>): string | number | null => {
            let peakKey: string | null = null;
            let maxCount = -1;
            for (const key in counts) {
                if (Object.prototype.hasOwnProperty.call(counts, key) && counts[key] > maxCount) {
                    maxCount = counts[key];
                    peakKey = key;
                }
            }
            // Si la clave es un número (para las horas), devolverlo como número
            if (peakKey !== null && !isNaN(Number(peakKey))) {
                return Number(peakKey);
            }
            return peakKey;
        };

        const peakDay = findPeakKey(activityCountsByDay) as string | null;
        const peakHour = findPeakKey(activityCountsByHour) as number | null;

        // Devolver el resultado
        return {
            by_day: activityCountsByDay,
            by_hour: activityCountsByHour,
            peak_day: peakDay,
            peak_hour: peakHour,
        };
    }

    // --- Método Principal para Analizar Actividades ---

    /**
     * Analiza una lista de actividades para detectar patrones y generar insights.
     * Equivalente a la función analyze_activities del script Python.
     * @param activities Lista de objetos Activity a analizar.
     * @param userId ID del usuario (para logging o contexto futuro, no usado en cálculos ahora).
     * @param timeRange Rango de tiempo opcional para metadatos.
     * @returns Objeto AnalysisResult con insights y metadatos.
     */
    async analyzeActivities(
        activities: Activity[],
        userId: string, // Aunque no lo usemos directamente en los cálculos ahora, es bueno tenerlo
        timeRange?: { start: string, end: string }
    ): Promise<AnalysisResult> {
        console.log(`Servicio Analysis: Analizando ${activities?.length || 0} actividades para usuario ${userId}`);
        if (timeRange) {
            console.log(`Servicio Analysis: Rango de tiempo especificado: ${timeRange.start} - ${timeRange.end}`);
        }

        try {
            // 1. Análisis de Tipos de Actividad
            const activityTypesCount: Record<string, number> = {};
            activities.forEach(act => {
                if (act && act.type) { // Verificar que la actividad y su tipo existan
                    activityTypesCount[act.type] = (activityTypesCount[act.type] || 0) + 1;
                }
            });

            // Encontrar el tipo más común (similar a Counter.most_common(1))
            let mostCommonType: [string, number] = ["unknown", 0];
            let maxCount = 0;
            for (const type in activityTypesCount) {
                if (Object.prototype.hasOwnProperty.call(activityTypesCount, type) && activityTypesCount[type] > maxCount) {
                    maxCount = activityTypesCount[type];
                    mostCommonType = [type, maxCount];
                }
            }
            console.log("Servicio Analysis: Conteo de tipos de actividad:", activityTypesCount);

            // 2. Análisis de Patrones Temporales
            const timePatterns = this._analyzeTimePatterns(activities);
            console.log("Servicio Analysis: Análisis temporal completado.");

            // 3. Construir Insights
            const insights: Insight[] = [];

            // Insight sobre el tipo más común
            if (mostCommonType[0] !== "unknown") {
                insights.push({
                    type: "pattern",
                    content: `Tipo de actividad más común: ${mostCommonType[0]} (${mostCommonType[1]} veces)`,
                    priority: 3,
                    metadata: {
                        activity_types: activityTypesCount
                    }
                });
            }

            // Insight sobre patrones temporales (si hay datos)
            if (!('no_data' in timePatterns)) {
                // Añadir detalles sobre días/horas pico si existen
                let timeContent = "Patrones temporales detectados.";
                if (timePatterns.peak_day) {
                    timeContent += ` Día pico: ${timePatterns.peak_day}.`;
                }
                if (timePatterns.peak_hour !== null) { // peak_hour puede ser 0
                    timeContent += ` Hora pico: ${timePatterns.peak_hour}:00-${timePatterns.peak_hour}:59.`;
                }

                insights.push({
                    type: "insight",
                    content: timeContent,
                    priority: 2,
                    metadata: timePatterns // Incluye by_day, by_hour, peak_day, peak_hour
                });
            }

            // Podrías añadir más lógica de insights aquí si es necesario

            console.log(`Servicio Analysis: Generados ${insights.length} insights.`);

            // 4. Construir Resultado Final
            return {
                insights: insights,
                metadata: {
                    analyzed_at: new Date().toISOString(),
                    total_activities: activities?.length || 0,
                    analysis_period: timeRange // Incluir el rango si se proporcionó
                }
            };

        } catch (error: any) {
            console.error("Servicio Analysis: Error analizando actividades:", error);
            // Devolver un error estructurado
            return {
                insights: [],
                metadata: {
                    analyzed_at: new Date().toISOString(),
                    total_activities: activities?.length || 0,
                    analysis_period: timeRange
                },
                error: `Error analizando actividades: ${error.message}`
            };
        }
    }
} 