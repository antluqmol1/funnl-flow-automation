import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import dotenv from 'dotenv';

// Cargar variables de entorno si aún no se han cargado globalmente
dotenv.config();

// Interfaces para los resultados esperados de OpenAI
interface AnalysisResult {
    summary: string | null;
    key_points: string[];
    error?: string;
}

interface SuggestedAction {
    id: string;
    description: string;
    // IMPORTANT: Este debe ser el nombre de un método PÚBLICO en nuestros servicios
    // (ej: 'createContact' en HubSpotService, o tal vez 'scheduleMeeting' en otro servicio)
    mcp_tool: string;
    arguments: Record<string, any>; // Argumentos para llamar al método
    confirmation_required: boolean;
}

interface SuggestionResult {
    suggestions: SuggestedAction[];
    error?: string;
}

export class MeetingsService {
    private openaiClient: OpenAI;

    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.error("OPENAI_API_KEY no encontrada en las variables de entorno.");
            throw new Error("Configuración incompleta: Falta la API Key de OpenAI.");
        }
        this.openaiClient = new OpenAI({ apiKey });
        console.log("Servicio Meetings: Cliente OpenAI inicializado correctamente.");
    }

    // --- Método para Analizar Transcripción ---

    /**
     * Analiza una transcripción usando OpenAI para generar resumen y puntos clave.
     * @param transcriptionText El texto completo de la transcripción.
     * @returns Un Promise que resuelve a un objeto AnalysisResult.
     */
    async analyzeTranscription(transcriptionText: string): Promise<AnalysisResult> {
        console.log(`Servicio Meetings: Analizando transcripción (longitud: ${transcriptionText?.length || 0})`);
        if (!this.openaiClient) {
            console.error("Error: Cliente OpenAI no inicializado en MeetingsService.");
            return { error: "OpenAI client not initialized.", summary: null, key_points: [] };
        }
        if (!transcriptionText || transcriptionText.trim() === "") {
            console.warn("Servicio Meetings: Texto de transcripción vacío recibido para análisis.");
            return { summary: "", key_points: [] }; // Devuelve vacío en lugar de error
        }

        // COPIAR Y ADAPTAR EL SYSTEM PROMPT DE meetings_tools/analysis.py
        const system_prompt = `Eres un asistente experto en analizar transcripciones de reuniones. Tu tarea es leer la siguiente transcripción y realizar dos cosas:
1.  Generar un resumen conciso (máximo 3-4 frases) de los temas principales discutidos.
2.  Extraer una lista de los puntos clave o elementos de acción más importantes mencionados (máximo 5-7 puntos).

Devuelve el resultado únicamente en formato JSON con las claves "summary" (string) y "key_points" (array de strings). No incluyas ninguna otra explicación o texto introductorio. Asegúrate de que el JSON sea válido.
Ejemplo de formato de salida:
{
  "summary": "Se discutió el progreso del proyecto X, se identificaron bloqueadores en la tarea Y y se acordaron los próximos pasos para la siguiente semana.",
  "key_points": [
    "Actualizar el documento de diseño antes del viernes.",
    "Contactar al equipo de soporte sobre el problema Z.",
    "Agendar reunión de seguimiento para el próximo martes.",
    "Revisar presupuesto asignado a la campaña de marketing."
  ]
}`; // FIN DEL SYSTEM PROMPT

        const messages: ChatCompletionMessageParam[] = [
            { role: "system", content: system_prompt },
            { role: "user", content: `Transcripción a analizar:\n\n${transcriptionText}` }
        ];

        try {
            console.log("Servicio Meetings: Enviando solicitud a OpenAI para análisis...");
            const response = await this.openaiClient.chat.completions.create({
                model: "gpt-4o", // O el modelo configurado/preferido
                messages: messages,
                response_format: { type: "json_object" },
                temperature: 0.5, // Moderar creatividad para extracción
            });

            const content = response.choices[0].message?.content;
            if (!content) {
                console.error("Servicio Meetings: Respuesta de análisis de OpenAI vacía.");
                return { error: "Respuesta de análisis de IA vacía.", summary: null, key_points: [] };
            }
            console.log("Servicio Meetings: Respuesta de análisis recibida.");
            // console.debug("Raw analysis content:", content); // Para depurar

            try {
                // Parsear y validar la estructura
                const analysisResult = JSON.parse(content);
                if (analysisResult && typeof analysisResult.summary === 'string' && Array.isArray(analysisResult.key_points)) {
                    // Validar que los key_points sean strings (opcional pero bueno)
                    const validKeyPoints = analysisResult.key_points.filter((kp: any) => typeof kp === 'string');
                    console.log("Servicio Meetings: Análisis completado y validado.");
                    return { summary: analysisResult.summary, key_points: validKeyPoints };
                } else {
                    console.error("Servicio Meetings: Formato JSON de análisis inválido recibido:", content);
                    return { error: "Formato de respuesta de IA inválido.", summary: null, key_points: [] };
                }
            } catch (jsonError: any) {
                console.error("Servicio Meetings: Error parseando JSON de análisis:", jsonError, "Contenido:", content);
                return { error: `Error procesando respuesta de IA: ${jsonError.message}`, summary: null, key_points: [] };
            }

        } catch (error: any) {
            console.error("Servicio Meetings: Error llamando a OpenAI para análisis:", error);
            const errorMessage = error.response?.data?.error?.message || error.message || "Error desconocido";
            return { error: `Error en análisis IA: ${errorMessage}`, summary: null, key_points: [] };
        }
    }

    // --- Método para Generar Sugerencias ---

    /**
     * Analiza una transcripción para sugerir acciones ejecutables (métodos de servicio).
     * @param transcriptionText El texto completo de la transcripción.
     * @param summary Resumen opcional de la reunión.
     * @param keyPoints Lista opcional de puntos clave ya identificados.
     * @returns Un Promise que resuelve a un objeto SuggestionResult.
     */
    async generateMeetingSuggestions(
        transcriptionText: string,
        summary?: string | null,
        keyPoints?: string[] | null
    ): Promise<SuggestionResult> {
        console.log(`Servicio Meetings: Generando sugerencias para transcripción (longitud: ${transcriptionText?.length || 0})`);
        if (!this.openaiClient) {
            console.error("Error: Cliente OpenAI no inicializado en MeetingsService.");
            return { error: "OpenAI client not initialized.", suggestions: [] };
        }
        if (!transcriptionText || transcriptionText.trim() === "") {
            console.warn("Servicio Meetings: Texto de transcripción vacío recibido para generar sugerencias.");
            return { suggestions: [] };
        }

        // COPIAR Y **ADAPTAR CUIDADOSAMENTE** EL SYSTEM PROMPT DE suggestions.py
        const system_prompt = `Eres un asistente inteligente que analiza transcripciones de reuniones de ventas o seguimiento para identificar acciones concretas que el usuario podría realizar a continuación. Tu objetivo es sugerir acciones que puedan ser ejecutadas a través de llamadas a funciones específicas del backend (identificadas por 'mcp_tool').\n\nLas FUNCIONES DISPONIBLES y sus ARGUMENTOS PRINCIPALES son:\n\n*   **Contactos (HubSpotService):**\n    *   \`findContact(searchTerm)\`: Busca un contacto existente por nombre, email, etc. Necesita el \`searchTerm\`.\n    *   \`createContact(properties)\`: Crea un nuevo contacto. Necesita \`properties\` (un objeto con \`firstname\`, \`email\` y opcionalmente \`lastname\`, \`company\`, \`phone\`).\n*   **Empresas (HubSpotService):**\n    *   \`findCompany(searchTerm)\`: Busca una empresa existente. Necesita el \`searchTerm\`.\n    *   \`createCompany(properties)\`: Crea una nueva empresa. Necesita \`properties\` (objeto con \`name\` y opcionalmente \`domain\`, \`description\`, \`city\`, \`industry\`).\n    *   \`updateCompany(id, properties)\`: Actualiza datos de una empresa. Necesita el \`id\` de la empresa y un objeto \`properties\` con los campos a cambiar.\n    *   \`getCompany(id)\`: Obtiene detalles de una empresa. Necesita el \`id\`.\n*   **Deals (HubSpotService):**\n    *   \`findDeal(searchTerm)\`: Busca un deal existente. Necesita el \`searchTerm\`.\n    *   \`createDeal(properties, userAccessToken)\`: Crea un nuevo deal. Necesita \`properties\` (objeto con \`dealname\`, \`dealstage\` [nombre en español/inglés], opcionalmente \`amount\`, \`closedate\`, etc.) y el \`userAccessToken\` (NO PUEDES EXTRAER ESTE TOKEN, solo indica que la función lo necesita).\n    *   \`updateDeal(identifier, properties, userAccessToken)\`: Actualiza un deal. Necesita el \`identifier\` (ID o nombre exacto del deal), un objeto \`properties\` con los cambios (incluyendo \`dealstage\` si aplica), y el \`userAccessToken\` (NO PUEDES EXTRAER ESTE TOKEN).\n    *   \`getDeal(id)\`: Obtiene detalles de un deal. Necesita el \`id\`.\n*   **Tickets (HubSpotService):**\n    *   \`findTicket(searchTerm)\`: Busca un ticket. Necesita el \`searchTerm\`.\n    *   \`createTicket(properties)\`: Crea un ticket. Necesita \`properties\` (objeto con \`subject\`, \`content\`, etc.).\n    *   \`updateTicket(id, properties)\`: Actualiza un ticket. Necesita el \`id\` y las \`properties\` a cambiar.\n    *   \`getTicket(id)\`: Obtiene detalles de un ticket. Necesita el \`id\`.\n\nBasándote en el contexto proporcionado (transcripción, resumen, puntos clave):\n1.  Identifica acciones potenciales que se alineen con las FUNCIONES listadas.\n2.  Extrae los argumentos necesarios para cada función directamente del texto. Si falta información crucial (ej: email para \`createContact\`, nombre para \`createCompany\`, ID para \`update*\`), NO sugieras esa acción específica. **NUNCA inventes argumentos.** Para funciones que necesitan \`userAccessToken\`, NO intentes extraerlo, solo usa los otros argumentos.\n3.  Para cada acción válida identificada, genera un objeto JSON con los siguientes campos:\n    *   \`id\`: Un identificador único para esta sugerencia (puedes generar un UUID corto o usar parte del texto).\n    *   \`description\`: Una descripción clara y concisa para el usuario final (ej: \"Crear contacto 'Ana García'\").\n    *   \`mcp_tool\`: El nombre exacto de la FUNCIÓN a ejecutar (ej: \"createContact\").\n    *   \`arguments\`: Un objeto JSON con los argumentos extraídos para la función (ej: {\"properties\": {\"firstname\": \"Ana García\", \"email\": \"ana.garcia@example.com\"}} o {\"searchTerm\": \"Acme Corp\"} o {\"id\": \"12345\", \"properties\": {\"city\": \"Madrid\"}}). La ESTRUCTURA de los argumentos debe coincidir con lo que espera la función (ej., \`properties\` debe ser un objeto anidado para crear/actualizar).\n    *   \`confirmation_required\`: Establece a \`true\` si la acción modifica datos existentes (update*, create*) o si la información extraída podría ser ambigua, de lo contrario \`false\` (para find*, get*).\n4.  Devuelve SIEMPRE una lista (array JSON) de estos objetos de acción. Si no encuentras acciones válidas, devuelve una lista vacía \`[]\`.\n5.  Asegúrate de que la salida sea únicamente el array JSON, sin explicaciones adicionales.\n\nEjemplo de salida esperada (como string JSON):\n[\n  {\n    \"id\": \"sug-contact-ana-g\",\n    \"description\": \"Crear contacto 'Ana García' con email ana.garcia@example.com\",\n    \"mcp_tool\": \"createContact\",\n    \"arguments\": { \"properties\": { \"firstname\": \"Ana García\", \"email\": \"ana.garcia@example.com\" } },\n    \"confirmation_required\": true\n  },\n  {\n    \"id\": \"sug-find-deal-alpha\",\n    \"description\": \"Buscar deal 'Proyecto Alpha'\",\n    \"mcp_tool\": \"findDeal\",\n    \"arguments\": { \"searchTerm\": \"Proyecto Alpha\" },\n    \"confirmation_required\": false\n  },\n   {\n     \"id\": \"sug-update-comp-123\",\n     \"description\": \"Actualizar empresa ID 123: establecer ciudad a Madrid\",\n     \"mcp_tool\": \"updateCompany\",\n     \"arguments\": { \"id\": \"123\", \"properties\": { \"city\": \"Madrid\" } },\n     \"confirmation_required\": true\n   }\n]\n`; // FIN DEL SYSTEM PROMPT

        let context = `Transcripción:\\n${transcriptionText}\\n\\n`;
        if (summary) context += `Resumen:\\n${summary}\\n\\n`;
        if (keyPoints && keyPoints.length > 0) context += `Puntos Clave Identificados Previamente:\\n${JSON.stringify(keyPoints)}\\n\\n`;

        const messages: ChatCompletionMessageParam[] = [
            { role: "system", content: system_prompt },
            { role: "user", content: context }
        ];

        try {
            console.log("Servicio Meetings: Enviando solicitud a OpenAI para sugerencias...");
            const response = await this.openaiClient.chat.completions.create({
                model: "gpt-4o", // O el modelo configurado/preferido
                messages: messages,
                response_format: { type: "json_object" }, // Esperamos un objeto JSON
                temperature: 0.3,
            });

            const content = response.choices[0].message?.content;
            if (!content) {
                console.error("Servicio Meetings: Respuesta de sugerencias de OpenAI vacía.");
                return { error: "Respuesta de sugerencias de IA vacía.", suggestions: [] };
            }
            console.log("Servicio Meetings: Respuesta de sugerencias recibida.");
            // console.debug("Raw suggestions content:", content); // Para depurar

            try {
                // Parsear JSON. El LLM podría devolver { "suggestions": [...] } o directamente [...]
                let parsedResponse = JSON.parse(content);
                let suggestionsRaw: any[] = [];

                if (Array.isArray(parsedResponse)) {
                    suggestionsRaw = parsedResponse;
                } else if (typeof parsedResponse === 'object' && parsedResponse !== null) {
                    // Buscar clave común (ej: 'suggestions', 'actions', 'suggested_actions')
                    const key = Object.keys(parsedResponse).find(k => Array.isArray(parsedResponse[k]));
                    if (key) {
                        suggestionsRaw = parsedResponse[key];
                    } else {
                        console.warn("Respuesta de sugerencias JSON no es una lista ni contiene una clave con lista:", content);
                    }
                }

                // Validación básica de la estructura de cada sugerencia
                const validatedSuggestions: SuggestedAction[] = [];
                for (const sug of suggestionsRaw) {
                    if (sug && typeof sug === 'object' &&
                        typeof sug.id === 'string' &&
                        typeof sug.description === 'string' &&
                        typeof sug.mcp_tool === 'string' && // TODO: Validar si el nombre existe en nuestros servicios?
                        typeof sug.arguments === 'object' && sug.arguments !== null &&
                        typeof sug.confirmation_required === 'boolean') {
                        validatedSuggestions.push(sug as SuggestedAction);
                    } else {
                        console.warn("Servicio Meetings: Sugerencia descartada por formato inválido:", sug);
                    }
                }

                console.log(`Servicio Meetings: Generadas ${validatedSuggestions.length} sugerencias de acción válidas.`);
                return { suggestions: validatedSuggestions };

            } catch (jsonError: any) {
                console.error("Servicio Meetings: Error parseando JSON de sugerencias:", jsonError, "Contenido:", content);
                return { error: `Error procesando respuesta de sugerencias IA: ${jsonError.message}`, suggestions: [] };
            }

        } catch (error: any) {
            console.error("Servicio Meetings: Error llamando a OpenAI para sugerencias:", error);
            const errorMessage = error.response?.data?.error?.message || error.message || "Error desconocido";
            return { error: `Error en sugerencias IA: ${errorMessage}`, suggestions: [] };
        }
    }
} 