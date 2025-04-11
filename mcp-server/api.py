from fastapi import FastAPI, Depends, HTTPException, Request, status
from dotenv import load_dotenv
from routers import hubspot
from fastapi.middleware.cors import CORSMiddleware
import os
import logging
import uvicorn
from datetime import datetime
import secrets
import asyncio

# Importar Supabase directamente desde el módulo db
from db import supabase

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# Crear la aplicación FastAPI
app = FastAPI(
    title="Funnl API Backend",
    description="API Backend para Funnl",
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

# Incluir los routers
app.include_router(hubspot.router)

@app.get("/")
def read_root():
    """
    Endpoint raíz para verificar que la API está funcionando.
    """
    return {"status": "ok", "message": "Funnl API Backend is running"}

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

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    logger.info(f"Iniciando API en puerto {port}...")
    uvicorn.run("api:app", host="0.0.0.0", port=port, reload=True) 