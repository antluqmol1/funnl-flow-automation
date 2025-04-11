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
from fastapi import FastAPI, Depends, HTTPException, Request, status
from routers import hubspot
from fastapi.middleware.cors import CORSMiddleware
import os
from supabase import create_client, Client
import httpx
import secrets
import uvicorn

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# Crear la aplicación FastAPI
app = FastAPI(
    title="MCP SaaS Backend",
    description="API Backend para MCP SaaS",
    version="0.1.0"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, limitar a orígenes específicos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuración de Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Incluir los routers
app.include_router(hubspot.router)

# Crear la instancia de FastMCP
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

@app.get("/")
def read_root():
    """
    Endpoint raíz para verificar que la API está funcionando.
    """
    return {"status": "ok", "message": "MCP SaaS Backend API is running"}

@app.post("/migrations/add-hubspot-fields")
async def add_hubspot_fields():
    """
    Migración para añadir campos relacionados con HubSpot a la tabla de tareas.
    """
    table_name = "tasks"
    # Nombres correctos para las columnas de HubSpot
    hubspot_id_col = "hubspot_id"
    hubspot_type_col = "hubspot_type"
    
    try:
        # Verificar si las columnas existen
        try:
            supabase.table(table_name).select(hubspot_id_col).limit(1).execute()
            logger.info(f"La columna {hubspot_id_col} ya existe en {table_name}")
            return {"status": "info", "message": f"Los campos de HubSpot ya existen en la tabla {table_name}"}
        except Exception as e:
            # Si la columna no existe, el error debería contener 'column does not exist'
            if "column" in str(e) and "does not exist" in str(e):
                # Usar SQL directamente para añadir las columnas
                query = f"""
                ALTER TABLE {table_name} 
                ADD COLUMN IF NOT EXISTS {hubspot_id_col} TEXT,
                ADD COLUMN IF NOT EXISTS {hubspot_type_col} TEXT,
                ADD COLUMN IF NOT EXISTS hubspot_owner TEXT,
                ADD COLUMN IF NOT EXISTS hubspot_status TEXT,
                ADD COLUMN IF NOT EXISTS hubspot_last_synced TIMESTAMP WITH TIME ZONE,
                ADD COLUMN IF NOT EXISTS sync_status TEXT
                """
                
                # Ejecutar SQL directo a través de Supabase
                try:
                    supabase.query(query).execute()
                    logger.info(f"Columnas de HubSpot añadidas a {table_name}")
                    return {"status": "success", "message": f"Campos de HubSpot añadidos a {table_name}"}
                except Exception as sql_error:
                    logger.error(f"Error ejecutando SQL para añadir columnas: {sql_error}")
                    return {"status": "error", "message": f"Error añadiendo columnas: {str(sql_error)}"}
            else:
                # Otro error inesperado
                logger.error(f"Error verificando columna {hubspot_id_col} en {table_name}: {e}")
                return {"status": "error", "message": f"Error verificando tabla: {str(e)}"}
    
    except Exception as e:
        logger.error(f"Error general en migración: {str(e)}")
        return {"status": "error", "message": f"Error al ejecutar la migración: {str(e)}"}

@app.post("/migrations/add-hubspot-fields-contacts")
async def add_hubspot_fields_contacts():
    """
    Migración para añadir campos relacionados con HubSpot a la tabla de contactos.
    """
    table_name = "contacts"
    # Nombres correctos para las columnas de HubSpot
    hubspot_id_col = "hubspot_id"
    hubspot_type_col = "hubspot_type"
    
    try:
        # Verificar si las columnas existen
        try:
            supabase.table(table_name).select(hubspot_id_col).limit(1).execute()
            logger.info(f"La columna {hubspot_id_col} ya existe en {table_name}")
            return {"status": "info", "message": f"Los campos de HubSpot ya existen en la tabla {table_name}"}
        except Exception as e:
            # Si la columna no existe, el error debería contener 'column does not exist'
            if "column" in str(e) and "does not exist" in str(e):
                # Usar SQL directamente para añadir las columnas
                query = f"""
                ALTER TABLE {table_name} 
                ADD COLUMN IF NOT EXISTS {hubspot_id_col} TEXT,
                ADD COLUMN IF NOT EXISTS {hubspot_type_col} TEXT
                """
                
                # Ejecutar SQL directo a través de Supabase
                try:
                    supabase.query(query).execute()
                    logger.info(f"Columnas de HubSpot añadidas a {table_name}")
                    return {"status": "success", "message": f"Campos de HubSpot añadidos a {table_name}"}
                except Exception as sql_error:
                    logger.error(f"Error ejecutando SQL para añadir columnas: {sql_error}")
                    return {"status": "error", "message": f"Error añadiendo columnas: {str(sql_error)}"}
            else:
                # Otro error inesperado
                logger.error(f"Error verificando columna {hubspot_id_col} en {table_name}: {e}")
                return {"status": "error", "message": f"Error verificando tabla: {str(e)}"}
    
    except Exception as e:
        logger.error(f"Error general en migración: {str(e)}")
        return {"status": "error", "message": f"Error al ejecutar la migración: {str(e)}"}

# Punto de entrada para ejecutar el servidor
if __name__ == "__main__":
    # Obtener el puerto desde variable de entorno o usar 8000 por defecto
    port = int(os.getenv("PORT", 8000))
    
    # Ejecutar ambos servidores
    print(f"Iniciando servidor MCP en puerto estándar y FastAPI en puerto {port}...")
    
    # Iniciar FastAPI con uvicorn
    # Esto se ejecutará en un hilo separado
    uvicorn_config = uvicorn.Config(app=app, host="0.0.0.0", port=port)
    uvicorn_server = uvicorn.Server(config=uvicorn_config)
    
    # Crear una tarea para ejecutar uvicorn
    asyncio.create_task(uvicorn_server.serve())
    
    # Ejecutar el servidor MCP (bloqueante, debe ser lo último)
    mcp.run()