import os
import logging
import json
from openai import AsyncOpenAI
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Configurar logging
logger = logging.getLogger(__name__)

# Inicializar cliente OpenAI
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    logger.error("OPENAI_API_KEY no encontrada en las variables de entorno.")
    client = None
else:
    client = AsyncOpenAI(api_key=api_key)

# Estructura de Acción Sugerida (referencia)
# {
#   "id": "string", // ID único (e.g., UUID generado aquí o por el LLM)
#   "description": "string", // Descripción para el usuario
#   "mcp_tool": "string", // Nombre de la herramienta MCP a llamar
#   "arguments": { "arg1": "valor1", ... }, // Argumentos para la herramienta
#   "confirmation_required": "boolean" // Si requiere confirmación UI
# }

async def generate_meeting_suggestions(
    transcription_text: str,
    summary: str | None = None,
    key_points: list | None = None
) -> list[dict]:
    """
    Analiza una transcripción de reunión para sugerir acciones ejecutables vía MCP.

    Args:
        transcription_text: El texto completo de la transcripción.
        summary: Resumen opcional de la reunión.
        key_points: Lista opcional de puntos clave/acciones ya identificados.

    Returns:
        Una lista de diccionarios, cada uno representando una acción sugerida,
        o una lista vacía si no se generan sugerencias o ocurre un error.
    """
    if not client:
        logger.error("Cliente OpenAI no inicializado.")
        return []
    if not transcription_text or transcription_text.strip() == "":
        logger.warning("Texto de transcripción vacío recibido para generar sugerencias.")
        return []

    logger.info(f"Iniciando generación de sugerencias para transcripción (longitud: {len(transcription_text)})...")

    # Contexto adicional (opcional)
    context = f"Transcripción:\n{transcription_text}\n\n"
    if summary:
        context += f"Resumen:\n{summary}\n\n"
    if key_points:
        context += f"Puntos Clave Identificados Previamente:\n{json.dumps(key_points)}\n\n"

    system_prompt = """
Eres un asistente inteligente que analiza transcripciones de reuniones de ventas o seguimiento para identificar acciones concretas que el usuario podría realizar a continuación. Tu objetivo es sugerir acciones que puedan ser ejecutadas a través de llamadas a herramientas específicas (MCP Tools).

Las herramientas disponibles y sus argumentos principales son:
- create_contact(firstname, email): Crea un nuevo contacto.
- find_contact(first_search_property_name): Busca un contacto existente por nombre, email, etc.
- create_company(name, description, industry, city): Crea una nueva empresa.
- find_company(first_search_property_name): Busca una empresa existente.
- update_company(id, ...): Actualiza datos de una empresa (necesitas el ID).
- create_deal(dealname, amount, closedate, ...): Crea un nuevo deal/oportunidad.
- find_deal(first_search_property_name): Busca un deal existente.
- update_deal(id, ...): Actualiza un deal (necesitas el ID).
- create_task(title, type, contact_id, due_date, ...): Crea una tarea de seguimiento (ej: llamada, email).

Basándote en el contexto proporcionado (transcripción, resumen, puntos clave):
1. Identifica acciones potenciales que se alineen con las herramientas MCP listadas.
2. Extrae los argumentos necesarios para cada herramienta directamente del texto. Si falta información crucial (ej: email para crear contacto), NO sugieras esa acción específica.
3. Para cada acción válida identificada, genera un objeto JSON con los siguientes campos:
    - "id": Un identificador único para esta sugerencia (puedes generar un UUID corto o usar parte del texto).
    - "description": Una descripción clara y concisa para el usuario final (ej: "Crear contacto 'Ana García'").
    - "mcp_tool": El nombre exacto de la herramienta MCP a ejecutar (ej: "create_contact").
    - "arguments": Un objeto JSON con los argumentos extraídos para la herramienta (ej: {"firstname": "Ana", "email": "ana.garcia@example.com"}).
    - "confirmation_required": Establece a `true` si la acción modifica datos existentes (update_*) o si la información extraída podría ser ambigua, de lo contrario `false`.
4. Devuelve SIEMPRE una lista (array JSON) de estos objetos de acción. Si no encuentras acciones válidas, devuelve una lista vacía `[]`.
5. Asegúrate de que la salida sea únicamente el array JSON, sin explicaciones adicionales.

Ejemplo de salida esperada (como string JSON):
[
  {
    "id": "sug-contact-ana",
    "description": "Crear contacto 'Ana García' (ana.garcia@example.com)",
    "mcp_tool": "create_contact",
    "arguments": { "firstname": "Ana García", "email": "ana.garcia@example.com" },
    "confirmation_required": false
  },
  {
    "id": "sug-task-followup",
    "description": "Agendar tarea de seguimiento con Pedro López para el próximo martes",
    "mcp_tool": "create_task",
    "arguments": { "title": "Seguimiento reunión con Pedro López", "type": "meeting", "due_date": "YYYY-MM-DD" }, // Extraer fecha si es posible
    "confirmation_required": false
  }
]
"""

    try:
        logger.info("Enviando solicitud a OpenAI para generar sugerencias...")
        response = await client.chat.completions.create(
            model="gpt-4o", # O gpt-3.5-turbo si prefieres rapidez/coste menor
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": context}
            ],
            response_format={"type": "json_object"}, # Esperamos un objeto JSON que contenga la lista
            temperature=0.3, # Baja temperatura para ser más determinista en la extracción
        )

        content = response.choices[0].message.content
        logger.info("Respuesta recibida de OpenAI para sugerencias.")
        # logger.debug(f"Contenido crudo sugerencias: {content}")

        if not content:
            logger.error("Respuesta de sugerencias de OpenAI vacía.")
            return []

        # Parsear el contenido JSON
        try:
            # El LLM podría devolver un objeto con una clave, o directamente la lista.
            # Intentamos parsear como objeto y buscar una clave común, o parsear directamente como lista.
            parsed_response = json.loads(content)

            suggestions = []
            if isinstance(parsed_response, list):
                suggestions = parsed_response
            elif isinstance(parsed_response, dict):
                # Buscar claves comunes donde podría estar la lista
                possible_keys = ["suggestions", "actions", "suggested_actions"]
                for key in possible_keys:
                    if key in parsed_response and isinstance(parsed_response[key], list):
                        suggestions = parsed_response[key]
                        break
                if not suggestions: # Si no se encontró en claves comunes, ¿es el dicc. la única sugerencia? (poco probable según prompt)
                     logger.warning(f"Respuesta JSON de sugerencias es un dict, no una lista como se esperaba: {content}")
                     # Podrías intentar convertir el dict en una lista de un elemento si tiene la estructura correcta
                     if all(k in parsed_response for k in ["id", "description", "mcp_tool", "arguments", "confirmation_required"]):
                          suggestions = [parsed_response]


            # Validación básica de la estructura de cada sugerencia
            validated_suggestions = []
            for sug in suggestions:
                if isinstance(sug, dict) and all(k in sug for k in ["id", "description", "mcp_tool", "arguments", "confirmation_required"]):
                     # Podría añadirse validación más estricta de tipos aquí si es necesario
                    validated_suggestions.append(sug)
                else:
                    logger.warning(f"Sugerencia descartada por formato inválido: {sug}")


            logger.info(f"Generadas {len(validated_suggestions)} sugerencias de acción válidas.")
            return validated_suggestions

        except json.JSONDecodeError as json_err:
            logger.error(f"Error al parsear JSON de sugerencias de OpenAI: {json_err}. Contenido: {content}")
            return []
        except Exception as parse_err:
            logger.error(f"Error inesperado al procesar respuesta JSON de sugerencias: {parse_err}. Contenido: {content}")
            return []

    except Exception as e:
        logger.error(f"Error durante la llamada a OpenAI para sugerencias: {e}", exc_info=True)
        return []

# Ejemplo de uso (opcional, para pruebas locales)
async def main():
    sample_transcription = """
    Juan: Hola equipo, empecemos la reunión. El primer punto es revisar el estado del proyecto Alpha. ¿Cómo vamos? Hablé con Ana García de Acme Corp hoy, su email es ana.garcia@acme.com. Parecen interesados.
    Maria: Hola Juan. Hemos avanzado bien, la fase de diseño está completa al 90%. Encontramos un problema con la integración de la API externa, necesitamos contactar a su soporte. Propongo hacerlo mañana.
    Pedro: De acuerdo con Maria. También creo que deberíamos actualizar la documentación interna para reflejar los últimos cambios antes de fin de semana. Me encargo yo. ¿Deberíamos agendar una llamada de seguimiento para el próximo martes?
    Juan: Perfecto. Gracias Pedro. Maria, por favor, encárgate de contactar al soporte de la API. Sí, Pedro, agenda esa llamada. El siguiente punto es el presupuesto. ¿Alguna novedad?
    Maria: Aún no he recibido la aprobación final del departamento financiero. Esperaba tenerla hoy. Les enviaré un recordatorio.
    Juan: Ok, mantenme informado. Eso es todo por hoy.
    """
    result = await generate_meeting_suggestions(sample_transcription)
    print("--- Sugerencias Generadas ---")
    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == '__main__':
    import asyncio
    logging.basicConfig(level=logging.INFO)
    # Para ejecutar la prueba: python -m meetings_tools.suggestions
    asyncio.run(main()) 