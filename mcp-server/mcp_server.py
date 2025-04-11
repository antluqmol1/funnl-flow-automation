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

# Configurar logging
logging.basicConfig(level=getattr(logging, os.getenv("LOG_LEVEL", "INFO")))
logger = logging.getLogger(__name__)

# Cargar variables de entorno
load_dotenv()

logger.info("Iniciando servidor MCP...")

# Crear la instancia de FastMCP
mcp = FastMCP("funnl-tools", delimiter="\n")

# Definir las herramientas MCP
# Herramientas para contactos
@mcp.tool()
async def find_contact(first_search_property_name: str) -> dict:
    """
    Busca un contacto en HubSpot por email, nombre o cualquier otra propiedad.
    
    Args:
        first_search_property_name: Valor a buscar (email, nombre, etc.)
        
    Returns:
        dict: Información del contacto encontrado o error
    """
    try:
        result = await buscar_contacto_hubspot(first_search_property_name)
        return result
    except Exception as e:
        logger.error(f"Error en find_contact: {str(e)}")
        return {"error": str(e)}

@mcp.tool()
async def create_contact(firstname: str, email: str) -> dict:
    """
    Crea un nuevo contacto en HubSpot.
    
    Args:
        firstname: Nombre del contacto
        email: Email del contacto
        
    Returns:
        dict: Información del contacto creado o error
    """
    try:
        return await crear_contacto_hubspot(firstname, email)
    except Exception as e:
        logger.error(f"Error en create_contact: {str(e)}")
        return {"error": str(e)}

# Herramientas para empresas
@mcp.tool()
async def find_company(search_term: str) -> dict:
    """
    Busca una empresa en HubSpot por nombre u otra propiedad.
    
    Args:
        search_term: Término de búsqueda
        
    Returns:
        dict: Información de la empresa encontrada o error
    """
    try:
        return await buscar_empresa_hubspot(search_term)
    except Exception as e:
        logger.error(f"Error en find_company: {str(e)}")
        return {"error": str(e)}

@mcp.tool()
async def get_company(company_id: str) -> dict:
    """
    Obtiene información detallada de una empresa en HubSpot por su ID.
    
    Args:
        company_id: ID de la empresa en HubSpot
        
    Returns:
        dict: Información detallada de la empresa o error
    """
    try:
        return await obtener_empresa_hubspot(company_id)
    except Exception as e:
        logger.error(f"Error en get_company: {str(e)}")
        return {"error": str(e)}

@mcp.tool()
async def create_company(name: str, description: str = "", industry: str = "", city: str = "") -> dict:
    """
    Crea una nueva empresa en HubSpot.
    
    Args:
        name: Nombre de la empresa
        description: Descripción de la empresa
        industry: Industria de la empresa
        city: Ciudad de la empresa
        
    Returns:
        dict: Información de la empresa creada o error
    """
    try:
        return await crear_empresa_hubspot(name=name, description=description, industry=industry, city=city)
    except Exception as e:
        logger.error(f"Error en create_company: {str(e)}")
        return {"error": str(e)}

@mcp.tool()
async def update_company(company_id: str, properties: dict) -> dict:
    """
    Actualiza una empresa existente en HubSpot.
    
    Args:
        company_id: ID de la empresa en HubSpot
        properties: Diccionario con propiedades a actualizar
        
    Returns:
        dict: Información de la empresa actualizada o error
    """
    try:
        return await actualizar_empresa_hubspot(company_id, properties)
    except Exception as e:
        logger.error(f"Error en update_company: {str(e)}")
        return {"error": str(e)}

# Herramientas para deals
@mcp.tool()
async def find_deal(search_term: str) -> dict:
    """
    Busca un deal en HubSpot por nombre u otra propiedad.
    
    Args:
        search_term: Término de búsqueda
        
    Returns:
        dict: Información del deal encontrado o error
    """
    try:
        return await buscar_deal_hubspot(search_term)
    except Exception as e:
        logger.error(f"Error en find_deal: {str(e)}")
        return {"error": str(e)}

@mcp.tool()
async def get_deal(deal_id: str) -> dict:
    """
    Obtiene información detallada de un deal en HubSpot por su ID.
    
    Args:
        deal_id: ID del deal en HubSpot
        
    Returns:
        dict: Información detallada del deal o error
    """
    try:
        return await obtener_deal_hubspot(deal_id)
    except Exception as e:
        logger.error(f"Error en get_deal: {str(e)}")
        return {"error": str(e)}

# Herramientas para tickets
@mcp.tool()
async def find_ticket(search_term: str) -> dict:
    """
    Busca un ticket en HubSpot por nombre, ID u otra propiedad.
    
    Args:
        search_term: Término de búsqueda
        
    Returns:
        dict: Información del ticket encontrado o error
    """
    try:
        return await buscar_ticket_hubspot(search_term)
    except Exception as e:
        logger.error(f"Error en find_ticket: {str(e)}")
        return {"error": str(e)}

@mcp.tool()
async def get_ticket(ticket_id: str) -> dict:
    """
    Obtiene información detallada de un ticket en HubSpot por su ID.
    
    Args:
        ticket_id: ID del ticket en HubSpot
        
    Returns:
        dict: Información detallada del ticket o error
    """
    try:
        return await obtener_ticket_hubspot(ticket_id)
    except Exception as e:
        logger.error(f"Error en get_ticket: {str(e)}")
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

if __name__ == "__main__":
    logger.info("Iniciando servidor MCP...")
    # Ejecutar el servidor MCP (bloqueante)
    mcp.run() 