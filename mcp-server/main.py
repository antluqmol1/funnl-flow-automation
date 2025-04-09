from mcp.server.fastmcp import FastMCP
from dotenv import load_dotenv
import sys
import json
import asyncio
from hubspot.contacts import buscar_contacto_hubspot, crear_contacto_hubspot
from hubspot.companies import (
    buscar_empresa_hubspot, 
    obtener_empresa_hubspot,
    crear_empresa_hubspot,
    actualizar_empresa_hubspot
)
from hubspot.deals import buscar_deal_hubspot, obtener_deal_hubspot
from hubspot.tickets import buscar_ticket_hubspot, obtener_ticket_hubspot
from datetime import datetime, timedelta
from collections import Counter
import logging

load_dotenv()

mcp = FastMCP("funnl-tools", delimiter="\n")

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

# Funciones específicas para el módulo Daily
@mcp.tool()
async def process_query(query: str, context: dict) -> dict:
    """
    Procesa una consulta y genera sugerencias inteligentes basadas en el contexto.
    
    Args:
        query: La consulta o descripción de la actividad
        context: Contexto adicional incluyendo userId y activityId
    
    Returns:
        dict: Sugerencias generadas con tipo, contenido y prioridad
    """
    try:
        logging.info(f"Procesando consulta para usuario {context['userId']}")
        logging.info(f"Actividad ID: {context['activityId']}")
        logging.info(f"Query: {query}")

        # Analizar la consulta para determinar el tipo de actividad
        activity_type = "meeting" if "reunión" in query.lower() else "task"
        
        # Generar sugerencias estructuradas
        suggestions = []
        
        # Sugerencia principal (siempre presente)
        main_suggestion = {
            "type": "task",
            "content": f"Tarea principal: {query}",
            "priority": "high",
            "metadata": {
                "activity_type": activity_type,
                "created_at": datetime.now().isoformat()
            }
        }
        suggestions.append(main_suggestion)

        # Sugerencia de seguimiento (si es una tarea)
        if activity_type == "task":
            followup = {
                "type": "followup",
                "content": f"Programar seguimiento para: {query}",
                "priority": "medium",
                "metadata": {
                    "suggested_date": (datetime.now() + timedelta(days=1)).isoformat()
                }
            }
            suggestions.append(followup)

        # Sugerencia de recordatorio
        reminder = {
            "type": "reminder",
            "content": f"Recordatorio: Revisar resultados de {query}",
            "priority": "medium",
            "metadata": {
                "due_date": (datetime.now() + timedelta(days=1)).isoformat()
            }
        }
        suggestions.append(reminder)

        logging.info(f"Generadas {len(suggestions)} sugerencias")
        return {
            "suggestions": suggestions,
            "metadata": {
                "processed_at": datetime.now().isoformat(),
                "activity_type": activity_type,
                "total_suggestions": len(suggestions)
            }
        }
    except Exception as e:
        logging.error(f"Error procesando query: {str(e)}")
        return {"error": str(e)}

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
        logging.info(f"Analizando {len(activities)} actividades para usuario {user_id}")
        if time_range:
            logging.info(f"Rango de tiempo: {time_range['start']} - {time_range['end']}")

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

        logging.info(f"Generados {len(insights)} insights")
        return {
            "insights": insights,
            "metadata": {
                "analyzed_at": datetime.now().isoformat(),
                "total_activities": len(activities),
                "analysis_period": time_range
            }
        }
    except Exception as e:
        logging.error(f"Error analizando actividades: {str(e)}")
        return {"error": str(e)}

def analyze_time_patterns(activities: list) -> dict:
    """Analiza patrones temporales en las actividades."""
    try:
        timestamps = [datetime.fromisoformat(act["timestamp"]) for act in activities]
        if not timestamps:
            return {}
            
        return {
            "most_active_hour": max(t.hour for t in timestamps),
            "most_active_day": max(t.strftime("%A") for t in timestamps),
            "activity_span_days": (max(timestamps) - min(timestamps)).days
        }
    except Exception as e:
        logging.error(f"Error en análisis temporal: {str(e)}")
        return {}

if __name__ == "__main__":
    mcp.run(transport="stdio")