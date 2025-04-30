from mcp.server.fastmcp import FastMCP
from dotenv import load_dotenv
import sys
import json
import logging
import os
import asyncio
from datetime import datetime, timedelta
from collections import Counter
from mcp import types
from typing import Optional

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
    from hubspot_tools.deals import (
        buscar_deal_hubspot, 
        obtener_deal_hubspot,
        crear_deal_hubspot,
        actualizar_deal_hubspot
    )
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
async def find_contact(first_search_property_name: str) -> list[types.TextContent]:
    try:
        result = await buscar_contacto_hubspot(first_search_property_name)
        return [types.TextContent(type="text", text=json.dumps(result))]
    except Exception as e:
        return [types.TextContent(type="text", text=json.dumps({"error": str(e)}))]

@mcp.tool()
async def create_contact(firstname: str, email: str, lastname: str = "", company: str = "", phone: str = "") -> list[types.TextContent]:
    try:
        result = await crear_contacto_hubspot(firstname=firstname, email=email, lastname=lastname, company=company, phone=phone)
        return [types.TextContent(type="text", text=json.dumps(result))]
    except Exception as e:
        return [types.TextContent(type="text", text=json.dumps({"error": str(e)}))]

# Registro de herramientas para empresas
@mcp.tool()
async def find_company(first_search_property_name: str) -> list[types.TextContent]:
    try:
        result = await buscar_empresa_hubspot(first_search_property_name)
        return [types.TextContent(type="text", text=json.dumps(result))]
    except Exception as e:
        return [types.TextContent(type="text", text=json.dumps({"error": str(e)}))]

@mcp.tool()
async def get_company(id: str) -> list[types.TextContent]:
    try:
        result = await obtener_empresa_hubspot(id)
        return [types.TextContent(type="text", text=json.dumps(result))]
    except Exception as e:
        return [types.TextContent(type="text", text=json.dumps({"error": str(e)}))]

@mcp.tool()
async def create_company(name: str, description: str = "", city: str = "") -> list[types.TextContent]:
    try:
        result = await crear_empresa_hubspot(name=name, description=description, city=city)
        return [types.TextContent(type="text", text=json.dumps(result))]
    except Exception as e:
        return [types.TextContent(type="text", text=json.dumps({"error": str(e)}))]

@mcp.tool()
async def update_company(**kwargs) -> list[types.TextContent]:
    try:
        company_id = kwargs.pop('id', None)
        if not company_id:
             return [types.TextContent(type="text", text=json.dumps({"error": "Se requiere 'id' para actualizar la empresa"}))]
        properties = kwargs
        result = await actualizar_empresa_hubspot(company_id=company_id, properties=properties)
        return [types.TextContent(type="text", text=json.dumps(result))]
    except Exception as e:
        return [types.TextContent(type="text", text=json.dumps({"error": str(e)}))]

# Registro de herramientas para deals
@mcp.tool()
async def find_deal(first_search_property_name: str) -> list[types.TextContent]:
    try:
        result = await buscar_deal_hubspot(first_search_property_name)
        return [types.TextContent(type="text", text=json.dumps(result))]
    except Exception as e:
        return [types.TextContent(type="text", text=json.dumps({"error": str(e)}))]

@mcp.tool()
async def get_deal(id: str) -> list[types.TextContent]:
    try:
        result = await obtener_deal_hubspot(id)
        return [types.TextContent(type="text", text=json.dumps(result))]
    except Exception as e:
        return [types.TextContent(type="text", text=json.dumps({"error": str(e)}))]

# --- Herramienta Crear Deal ---
@mcp.tool()
async def create_deal(
    dealname: str,
    dealstage: str,
    amount: Optional[str] = None,
    closedate: Optional[str] = None, # Espera formato YYYY-MM-DD
    dealtype: Optional[str] = None,
    description: Optional[str] = None,
    # user_id se obtendrá del contexto si es necesario
) -> list[types.TextContent]:
    """Crea un nuevo deal en HubSpot."""
    try:
        # Obtener user_id del contexto si está disponible (ejemplo)
        # user_id = context.get("user_id")
        user_id = None # Por ahora, usa el token global/de env
        
        result = await crear_deal_hubspot(
            dealname=dealname, 
            dealstage=dealstage, 
            amount=amount, 
            closedate=closedate, 
            dealtype=dealtype, 
            description=description,
            user_id=user_id
        )
        return [types.TextContent(type="text", text=json.dumps(result))]
    except Exception as e:
        logger.error(f"Error en herramienta create_deal: {e}", exc_info=True)
        return [types.TextContent(type="text", text=json.dumps({"error": str(e)}))]

# --- Herramienta Actualizar Deal ---
@mcp.tool()
async def update_deal(
    deal_identifier: str, # Acepta ID o nombre
    amount: Optional[str] = None,
    closedate: Optional[str] = None, 
    deal_currency_code: Optional[str] = None,
    dealname: Optional[str] = None,
    dealstage: Optional[str] = None,
    dealtype: Optional[str] = None,
    description: Optional[str] = None,
    # user_id se obtendrá del contexto si es necesario
) -> list[types.TextContent]:
    """
    Actualiza un deal existente en HubSpot. 
    IMPORTANTE: 
    - Puedes proporcionar el ID del deal o su NOMBRE EXACTO como 'deal_identifier'. La herramienta buscará el ID si proporcionas el nombre.
    - Para 'dealstage', DEBES usar el nombre de la etapa en ESPAÑOL (visitante, captado, cultivado, demo, negociación, negociacion, ganado, perdido).
    - La herramienta usa el pipeline de ventas por defecto ('default').
    - Proporciona solo los campos que deseas actualizar.
    """
    try:
        # Obtener user_id del contexto si está disponible (ejemplo)
        user_id = None # Por ahora, usa el token global/de env

        # --- Inicio: Resolver ID del Deal si se dio un nombre ---
        deal_id_to_update = None
        if deal_identifier.isdigit():
            deal_id_to_update = deal_identifier
            logger.info(f"Se proporcionó ID numérico para update_deal: {deal_id_to_update}")
        else:
            logger.info(f"Se proporcionó nombre para update_deal: '{deal_identifier}'. Buscando ID...")
            try:
                # Usar la función de búsqueda subyacente, no la herramienta completa
                search_result = await buscar_deal_hubspot(search_query=deal_identifier, user_id=user_id)
                
                if search_result.get("success") and search_result.get("total") == 1:
                    deal_id_to_update = search_result["results"][0]["id"]
                    logger.info(f"ID encontrado para '{deal_identifier}': {deal_id_to_update}")
                elif search_result.get("success") and search_result.get("total", 0) > 1:
                    error_msg = f"Se encontraron múltiples deals con nombre similar a '{deal_identifier}'. Proporciona el ID exacto."
                    logger.warning(error_msg)
                    # Devolver JSON de error
                    return [types.TextContent(type="text", text=json.dumps({"error": error_msg, "search_term": deal_identifier, "results": search_result["results"]}))]
                else:
                    error_msg = f"No se encontró ningún deal con nombre '{deal_identifier}'. Verifica el nombre o proporciona el ID."
                    logger.warning(error_msg)
                    # Devolver JSON de error
                    return [types.TextContent(type="text", text=json.dumps({"error": error_msg, "search_term": deal_identifier}))]

            except Exception as search_e:
                logger.error(f"Error buscando deal por nombre '{deal_identifier}': {search_e}", exc_info=True)
                return [types.TextContent(type="text", text=json.dumps({"error": f"Error buscando deal: {str(search_e)}"}))]
        # --- Fin: Resolver ID del Deal ---
        
        # Si no se pudo resolver el ID, salir
        if not deal_id_to_update:
             return [types.TextContent(type="text", text=json.dumps({"error": "No se pudo determinar el ID del deal para actualizar."}))]

        # Llamar a la función subyacente con el ID resuelto
        result = await actualizar_deal_hubspot(
            deal_id=deal_id_to_update, # Usar el ID resuelto
            amount=amount,
            closedate=closedate,
            deal_currency_code=deal_currency_code,
            dealname=dealname,
            dealstage=dealstage,
            dealtype=dealtype,
            description=description,
            user_id=user_id
        )
        return [types.TextContent(type="text", text=json.dumps(result))]
    except Exception as e:
        logger.error(f"Error en herramienta update_deal: {e}", exc_info=True)
        return [types.TextContent(type="text", text=json.dumps({"error": str(e)}))]
# --- Fin Herramientas Deal ---

# Registro de herramientas para tickets
@mcp.tool()
async def find_ticket(first_search_property_name: str) -> list[types.TextContent]:
    try:
        result = await buscar_ticket_hubspot(first_search_property_name)
        return [types.TextContent(type="text", text=json.dumps(result))]
    except Exception as e:
        return [types.TextContent(type="text", text=json.dumps({"error": str(e)}))]

@mcp.tool()
async def get_ticket(id: str) -> list[types.TextContent]:
    try:
        result = await obtener_ticket_hubspot(id)
        return [types.TextContent(type="text", text=json.dumps(result))]
    except Exception as e:
        return [types.TextContent(type="text", text=json.dumps({"error": str(e)}))]

# Registro de herramientas para Meetings
@mcp.tool()
async def analyze_meeting_transcription(transcription_text: str) -> list[types.TextContent]:
    """Analiza una transcripción para obtener resumen y puntos clave."""
    try:
        result = await analyze_transcription(transcription_text)
        return [types.TextContent(type="text", text=json.dumps(result))]
    except Exception as e:
        logger.error(f"Error en wrapper de analyze_meeting_transcription: {str(e)}")
        return [types.TextContent(type="text", text=json.dumps({"error": str(e)}))]

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
) -> list[types.TextContent]:
    """Genera acciones sugeridas basadas en la transcripción de una reunión."""
    try:
        suggestions = await generate_meeting_suggestions(
            transcription_text=transcription_text,
            summary=summary,
            key_points=key_points
        )
        return [types.TextContent(type="text", text=json.dumps(suggestions))]
    except Exception as e:
        logger.error(f"Error en wrapper de generate_meeting_suggestions_tool: {str(e)}")
        return [types.TextContent(type="text", text=json.dumps({"error": str(e)}))]
# --- FIN NUEVO ---

if __name__ == "__main__":
    logger.info("Iniciando servidor MCP...")
    # Ejecutar el servidor MCP (bloqueante)
    mcp.run(transport="stdio") 