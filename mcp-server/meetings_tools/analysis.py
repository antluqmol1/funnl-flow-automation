import os
import logging
import json
from openai import AsyncOpenAI
from dotenv import load_dotenv

# Cargar variables de entorno (si no se cargan globalmente)
load_dotenv()

# Configurar logging
logger = logging.getLogger(__name__)

# Inicializar cliente OpenAI
# Asegúrate de tener OPENAI_API_KEY en tu .env o variables de entorno
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    logger.error("OPENAI_API_KEY no encontrada en las variables de entorno.")
    # Podrías lanzar un error aquí o manejarlo de otra forma
    # raise ValueError("OPENAI_API_KEY is not set")
    client = None
else:
    client = AsyncOpenAI(api_key=api_key)

async def analyze_transcription(transcription_text: str) -> dict:
    """
    Analiza el texto de una transcripción usando un LLM para generar
    un resumen y extraer puntos clave.

    Args:
        transcription_text: El texto completo de la transcripción.

    Returns:
        Un diccionario con las claves 'summary' y 'key_points',
        o un diccionario con 'error' si algo falla.
    """
    logger.info(f"Iniciando análisis de transcripción (longitud: {len(transcription_text)})...")

    if not client:
        logger.error("Cliente OpenAI no inicializado debido a falta de API key.")
        return {"error": "OpenAI client not initialized. Check API key."}
        
    if not transcription_text or transcription_text.strip() == "":
        logger.warning("Texto de transcripción vacío o inválido recibido.")
        return {"summary": None, "key_points": []} # Devolver valores vacíos si no hay texto

    # Definir el prompt para el LLM
    system_prompt = """Eres un asistente experto en analizar transcripciones de reuniones. Tu tarea es leer la siguiente transcripción y realizar dos cosas:
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
}
"""

    user_message = f"Transcripción a analizar:\n\n{transcription_text}"

    try:
        logger.info("Enviando solicitud a la API de OpenAI...")
        response = await client.chat.completions.create(
            model="gpt-4o", # O el modelo que prefieras/tengas acceso
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            response_format={"type": "json_object"}, # Forzar salida JSON
            temperature=0.5, # Moderar la creatividad para tareas extractivas
        )

        content = response.choices[0].message.content
        logger.info("Respuesta recibida de OpenAI.")
        # logger.debug(f"Contenido crudo: {content}") # Descomentar para depuración detallada

        if not content:
            logger.error("Respuesta de OpenAI vacía.")
            return {"error": "Empty response from AI analysis."}

        # Parsear el contenido JSON
        try:
            analysis_result = json.loads(content)
            # Validar estructura básica
            if "summary" not in analysis_result or "key_points" not in analysis_result:
                 logger.error(f"Respuesta JSON de OpenAI no tiene la estructura esperada: {content}")
                 return {"error": "Invalid JSON structure in AI response."}
                 
            # Asegurarse que key_points sea una lista
            if not isinstance(analysis_result.get("key_points"), list):
                 analysis_result["key_points"] = [] # O manejar como error

            logger.info("Análisis completado exitosamente.")
            return analysis_result

        except json.JSONDecodeError as json_err:
            logger.error(f"Error al parsear JSON de OpenAI: {json_err}. Contenido: {content}")
            # Intentar devolver al menos el texto crudo si el JSON falla
            return {"error": f"Failed to parse AI response JSON. Raw content: {content}"}


    except Exception as e:
        logger.error(f"Error durante la llamada a la API de OpenAI: {e}", exc_info=True)
        return {"error": f"An error occurred during AI analysis: {str(e)}"}

# Ejemplo de uso (opcional, para pruebas locales)
async def main():
    sample_transcription = """
    Juan: Hola equipo, empecemos la reunión. El primer punto es revisar el estado del proyecto Alpha. ¿Cómo vamos?
    Maria: Hola Juan. Hemos avanzado bien, la fase de diseño está completa al 90%. Encontramos un problema con la integración de la API externa, necesitamos contactar a su soporte. Propongo hacerlo mañana.
    Pedro: De acuerdo con Maria. También creo que deberíamos actualizar la documentación interna para reflejar los últimos cambios antes de fin de semana. Me encargo yo.
    Juan: Perfecto. Gracias Pedro. Maria, por favor, encárgate de contactar al soporte de la API. El siguiente punto es el presupuesto. ¿Alguna novedad?
    Maria: Aún no he recibido la aprobación final del departamento financiero. Esperaba tenerla hoy. Les enviaré un recordatorio.
    Juan: Ok, mantenme informado. Eso es todo por hoy. Reunión de seguimiento el próximo martes.
    """
    result = await analyze_transcription(sample_transcription)
    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == '__main__':
    import asyncio
    logging.basicConfig(level=logging.INFO)
    # Para ejecutar la prueba: python -m meetings_tools.analysis
    asyncio.run(main()) 