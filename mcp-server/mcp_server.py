from mcp.server.fastmcp import FastMCP
from dotenv import load_dotenv
import sys
import json
import logging
import os
import asyncio
from datetime import datetime, timedelta
from collections import Counter

# Importar funciones de HubSpot
# Importación de módulos condicionada a su disponibilidad
try:
    from hubspot_tools.contacts import buscar_contacto_hubspot, crear_contacto_hubspot
    from hubspot_tools.companies import (
        buscar_empresa_hubspot, 
        obtener_empresa_hubspot,
        crear_empresa_hubspot,
        actualizar_empresa_hubspot
    )
    from hubspot_tools.deals import buscar_deal_hubspot, obtener_deal_hubspot
    from hubspot_tools.tickets import buscar_ticket_hubspot, obtener_ticket_hubspot
    
except ImportError as e:
    logging.warning(f"No se pudieron importar módulos de HubSpot: {e}. Algunas herramientas no estarán disponibles.")

# Importar funciones de Meetings Tools
from meetings_tools.analysis import analyze_transcription
from meetings_tools.suggestions import generate_meeting_suggestions

# Configurar logging
logging.basicConfig(level=getattr(logging, os.getenv("LOG_LEVEL", "INFO")))
logger = logging.getLogger(__name__)

# Cargar variables de entorno
load_dotenv()

logger.info("Iniciando servidor MCP...")

# Crear la instancia de FastMCP
mcp = FastMCP("funnl-tools", delimiter="\n")

# Herramientas MCP
# Registro de herramientas para contactos
@mcp.tool()
async def find_contact(first_search_property_name: str) -> dict:
    try:
        result = await buscar_contacto_hubspot(first_search_property_name)
        return result
    except Exception as e:
        return {"error": str(e)}

@mcp.tool()
async def create_contact(firstname: str, email: str) -> dict:
    try:
        return await crear_contacto_hubspot(firstname, email)
    except Exception as e:
        return {"error": str(e)}

# Registro de herramientas para empresas
@mcp.tool()
async def find_company(first_search_property_name: str) -> dict:
    try:
        return await buscar_empresa_hubspot(first_search_property_name)
    except Exception as e:
        return {"error": str(e)}

@mcp.tool()
async def get_company(id: str, properties_to_retrieve: str) -> dict:
    try:
        return await obtener_empresa_hubspot(id, properties_to_retrieve)
    except Exception as e:
        return {"error": str(e)}

@mcp.tool()
async def create_company(name: str, description: str = "", industry: str = "", city: str = "") -> dict:
    try:
        return await crear_empresa_hubspot(name=name, description=description, industry=industry, city=city)
    except Exception as e:
        return {"error": str(e)}

@mcp.tool()
async def update_company(**kwargs) -> dict:
    try:
        return await actualizar_empresa_hubspot(**kwargs)
    except Exception as e:
        return {"error": str(e)}

# Registro de herramientas para deals
@mcp.tool()
async def find_deal(first_search_property_name: str) -> dict:
    try:
        return await buscar_deal_hubspot(first_search_property_name)
    except Exception as e:
        return {"error": str(e)}

@mcp.tool()
async def get_deal(id: str, properties_to_retrieve: str) -> dict:
    try:
        return await obtener_deal_hubspot(id, properties_to_retrieve)
    except Exception as e:
        return {"error": str(e)}

# Registro de herramientas para tickets
@mcp.tool()
async def find_ticket(first_search_property_name: str) -> dict:
    try:
        return await buscar_ticket_hubspot(first_search_property_name)
    except Exception as e:
        return {"error": str(e)}

@mcp.tool()
async def get_ticket(id: str, properties_to_retrieve: str) -> dict:
    try:
        return await obtener_ticket_hubspot(id, properties_to_retrieve)
    except Exception as e:
        return {"error": str(e)}

# Registro de herramientas para Meetings
@mcp.tool()
async def analyze_meeting_transcription(transcription_text: str) -> dict:
    """Analiza una transcripción para obtener resumen y puntos clave."""
    try:
        result = await analyze_transcription(transcription_text)
        return result
    except Exception as e:
        logger.error(f"Error en wrapper de analyze_meeting_transcription: {str(e)}")
        return {"error": str(e)}

# Herramientas de análisis
def analyze_time_patterns(activities):
    """Analiza patrones temporales en actividades."""
    if not activities:
        return {"no_data": True}
    
    # Análisis simple para demostración
    activity_counts_by_day = Counter()
    activity_counts_by_hour = Counter()
    
    for activity in activities:
        if "time" in activity:
            try:
                time = datetime.fromisoformat(activity["time"])
                activity_counts_by_day[time.strftime("%A")] += 1
                activity_counts_by_hour[time.hour] += 1
            except (ValueError, TypeError):
                pass
    
    return {
        "by_day": dict(activity_counts_by_day),
        "by_hour": dict(activity_counts_by_hour),
        "peak_day": activity_counts_by_day.most_common(1)[0][0] if activity_counts_by_day else None,
        "peak_hour": activity_counts_by_hour.most_common(1)[0][0] if activity_counts_by_hour else None
    }

@mcp.tool()
async def analyze_activities(activities: list, user_id: str, time_range: dict = None) -> dict:
    """
    Analiza actividades para detectar patrones y generar insights.
    
    Args:
        activities: Lista de actividades a analizar
        user_id: ID del usuario
        time_range: Rango de tiempo opcional para el análisis
    
    Returns:
        dict: Insights y patrones detectados
    """
    try:
        logger.info(f"Analizando {len(activities)} actividades para usuario {user_id}")
        if time_range:
            logger.info(f"Rango de tiempo: {time_range['start']} - {time_range['end']}")

        # Análisis de tipos de actividades
        activity_types = Counter(act["type"] for act in activities)
        most_common_type = activity_types.most_common(1)[0] if activity_types else ("unknown", 0)
        
        # Análisis de patrones temporales
        time_patterns = analyze_time_patterns(activities)
        
        insights = [
            {
                "type": "pattern",
                "content": f"Tipo de actividad más común: {most_common_type[0]} ({most_common_type[1]} veces)",
                "priority": 3,
                "metadata": {
                    "activity_types": dict(activity_types)
                }
            },
            {
                "type": "insight",
                "content": "Patrones temporales detectados",
                "priority": 2,
                "metadata": time_patterns
            }
        ]

        logger.info(f"Generados {len(insights)} insights")
        return {
            "insights": insights,
            "metadata": {
                "analyzed_at": datetime.now().isoformat(),
                "total_activities": len(activities),
                "analysis_period": time_range
            }
        }
    except Exception as e:
        logger.error(f"Error analizando actividades: {str(e)}")
        return {"error": str(e)}

# --- NUEVO: Registrar herramienta de sugerencias ---
@mcp.tool()
async def generate_meeting_suggestions_tool(
    transcription_text: str,
    summary: str | None = None,
    key_points: list | None = None
) -> list[dict]:
    """Genera acciones sugeridas basadas en la transcripción de una reunión."""
    try:
        suggestions = await generate_meeting_suggestions(
            transcription_text=transcription_text,
            summary=summary,
            key_points=key_points
        )
        return suggestions
    except Exception as e:
        logger.error(f"Error en wrapper de generate_meeting_suggestions_tool: {str(e)}")
        return []
# --- FIN NUEVO ---

if __name__ == "__main__":
    logger.info("Iniciando servidor MCP...")
    # Ejecutar el servidor MCP (bloqueante)
    mcp.run(transport="stdio") 