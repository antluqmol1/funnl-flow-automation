"""
Módulo para la sincronización y caché de datos de HubSpot.
"""
import logging
import os
import json
import httpx
import asyncio
import time
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from dotenv import load_dotenv
from .utils import log_sync_operation
from hubspot import HubSpot
from hubspot.crm.objects.models import SimplePublicObjectInput

# Configurar logging
logger = logging.getLogger(__name__)

# Cargar variables de entorno
load_dotenv()

class HubspotCache:
    """Clase para manejar el caché de datos de HubSpot"""
    
    def __init__(self, ttl: int = 3600):
        """
        Inicializa el caché.
        
        Args:
            ttl: Tiempo de vida de los datos en segundos (por defecto: 1 hora)
        """
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.ttl = ttl
    
    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        """
        Obtiene un valor del caché.
        
        Args:
            key: Clave para buscar en el caché
            
        Returns:
            Dict o None si no existe o expiró
        """
        if key in self.cache:
            entry = self.cache[key]
            # Verificar si el valor ha expirado
            if entry["expires"] > time.time():
                return entry["data"]
            # Si expiró, eliminarlo
            del self.cache[key]
        return None
    
    async def set(self, key: str, value: Dict[str, Any], ttl: Optional[int] = None) -> None:
        """
        Almacena un valor en el caché.
        
        Args:
            key: Clave para guardar el valor
            value: Valor a guardar
            ttl: Tiempo de vida opcional (sobreescribe el valor por defecto)
        """
        expires = time.time() + (ttl if ttl is not None else self.ttl)
        self.cache[key] = {
            "data": value,
            "expires": expires
        }
    
    async def delete(self, key: str) -> bool:
        """
        Elimina un valor del caché.
        
        Args:
            key: Clave a eliminar
            
        Returns:
            bool: True si se eliminó, False si no existía
        """
        if key in self.cache:
            del self.cache[key]
            return True
        return False
    
    async def clear(self) -> None:
        """Limpia todo el caché."""
        self.cache.clear()
    
    async def cleanup(self) -> int:
        """
        Elimina entradas expiradas del caché.
        
        Returns:
            int: Número de entradas eliminadas
        """
        now = time.time()
        expired_keys = [k for k, v in self.cache.items() if v["expires"] <= now]
        for key in expired_keys:
            del self.cache[key]
        return len(expired_keys)

# Instancia global del caché
hubspot_cache = HubspotCache()

class HubspotSync:
    """Clase para manejar la sincronización con HubSpot"""
    
    def __init__(self):
        """Inicializa el sincronizador."""
        pass
    
    async def get_api_key(self, user_id: str) -> Optional[str]:
        """
        Obtiene la API key de HubSpot para un usuario.
        
        Args:
            user_id: ID del usuario
            
        Returns:
            str: API key o None si no hay
        """
        # Usar la función del módulo contacts
        from .contacts import get_hubspot_token
        return await get_hubspot_token(user_id)
    
    async def set_api_key(self, user_id: str, api_key: str) -> bool:
        """
        Guarda o actualiza la API key de HubSpot para un usuario.
        Este método es utilizado durante el proceso de OAuth.
        
        Args:
            user_id: ID del usuario
            api_key: Token de acceso a HubSpot
            
        Returns:
            bool: True si se guardó correctamente
        """
        # Este método simplemente retorna True ya que la actualización real 
        # del token se hace en routers/hubspot.py directamente en la base de datos
        logger.info(f"API key actualizada para usuario {user_id}")
        return True
    
    async def sync_contacts(self, user_id: str, force: bool = False, limit: int = 100) -> Dict[str, Any]:
        """
        Sincroniza contactos con HubSpot.
        
        Args:
            user_id: ID del usuario
            force: Si se debe forzar la sincronización ignorando el caché
            limit: Límite de contactos a sincronizar
        """
        api_key = await self.get_api_key(user_id)
        if not api_key:
            return {"error": "API Key no configurada"}
        
        cache_key = f"contacts_{user_id}"
        
        if not force:
            cached = await hubspot_cache.get(cache_key)
            if cached:
                return cached
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.hubapi.com/crm/v3/objects/contacts",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    params={
                        "limit": limit,
                        "properties": "email,firstname,lastname,phone,company,createdate"
                    }
                )
                response.raise_for_status()
                contacts = response.json()
                
                await hubspot_cache.set(cache_key, contacts)
                log_sync_operation("sync_contacts", "contacts", user_id, success=True)
                
                return contacts
        except Exception as e:
            log_sync_operation("sync_contacts", "contacts", user_id, success=False, error=str(e))
            return {"error": str(e)}
    
    async def sync_contact(self, user_id: str, contact_id: str, force: bool = False) -> Dict[str, Any]:
        """
        Sincroniza un contacto específico con HubSpot.
        
        Args:
            user_id: ID del usuario
            contact_id: ID del contacto
            force: Si se debe forzar la sincronización ignorando el caché
        """
        api_key = await self.get_api_key(user_id)
        if not api_key:
            return {"error": "API Key no configurada"}
        
        cache_key = f"contact_{user_id}_{contact_id}"
        
        if not force:
            cached = await hubspot_cache.get(cache_key)
            if cached:
                return cached
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://api.hubapi.com/crm/v3/objects/contacts/{contact_id}",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    params={
                        "properties": "email,firstname,lastname,phone,company,createdate,hs_lead_status"
                    }
                )
                response.raise_for_status()
                contact = response.json()
                
                await hubspot_cache.set(cache_key, contact)
                log_sync_operation("sync_contact", "contact", contact_id, success=True)
                
                return contact
        except Exception as e:
            log_sync_operation("sync_contact", "contact", contact_id, success=False, error=str(e))
            return {"error": str(e)}
    
    async def sync_company(self, user_id: str, company_id: str, force: bool = False) -> Dict[str, Any]:
        """
        Sincroniza una empresa específica con HubSpot.
        
        Args:
            user_id: ID del usuario
            company_id: ID de la empresa
            force: Si se debe forzar la sincronización ignorando el caché
        """
        api_key = await self.get_api_key(user_id)
        if not api_key:
            return {"error": "API Key no configurada"}

        cache_key = f"company_{user_id}_{company_id}"
        
        if not force:
            cached = await hubspot_cache.get(cache_key)
            if cached:
                return cached

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://api.hubapi.com/crm/v3/objects/companies/{company_id}",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    params={
                        "properties": "name,domain,industry,city,country,description,website,phone"
                    }
                )
                response.raise_for_status()
                company = response.json()
                
                await hubspot_cache.set(cache_key, company)
                log_sync_operation("sync_company", "company", company_id, success=True)
                
                return company
        except Exception as e:
            log_sync_operation("sync_company", "company", company_id, success=False, error=str(e))
            return {"error": str(e)}
    
    async def sync_companies(self, user_id: str, force: bool = False, limit: int = 100) -> Dict[str, Any]:
        """
        Sincroniza empresas con HubSpot.
        
        Args:
            user_id: ID del usuario
            force: Si se debe forzar la sincronización ignorando el caché
            limit: Límite de empresas a sincronizar
        """
        api_key = await self.get_api_key(user_id)
        if not api_key:
            return {"error": "API Key no configurada"}
        
        cache_key = f"companies_{user_id}"
        
        if not force:
            cached = await hubspot_cache.get(cache_key)
            if cached:
                return cached
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.hubapi.com/crm/v3/objects/companies",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    params={
                        "limit": limit,
                        "properties": "name,domain,industry,city,country,createdate"
                    }
                )
                response.raise_for_status()
                companies = response.json()
                
                await hubspot_cache.set(cache_key, companies)
                log_sync_operation("sync_companies", "companies", user_id, success=True)
                
                return companies
        except Exception as e:
            log_sync_operation("sync_companies", "companies", user_id, success=False, error=str(e))
            return {"error": str(e)}
    
    async def sync_deal(self, user_id: str, deal_id: str, force: bool = False) -> Dict[str, Any]:
        """
        Sincroniza un deal específico con HubSpot.
        
        Args:
            user_id: ID del usuario
            deal_id: ID del deal (puede ser ID local o de HubSpot)
            force: Si se debe forzar la sincronización ignorando el caché
        """
        api_key = await self.get_api_key(user_id)
        if not api_key:
            return {"error": "API Key no configurada"}
        
        # Verificar si deal_id es un ID local (UUID) o un ID de HubSpot
        is_local_id = len(deal_id) > 10 and "-" in deal_id  # UUID típicamente tiene guiones y es largo
        
        hubspot_deal_id = None
        if is_local_id:
            # Intentar obtener el ID de HubSpot desde la base de datos
            hubspot_deal_id = await self.get_hubspot_id_for_deal(deal_id)
            
            # Obtener datos del deal local
            from db import supabase
            deal_response = supabase.table("deals").select("*").eq("id", deal_id).maybe_single().execute()
            local_deal_data = deal_response.data if deal_response.data else None
            
            # Si no tiene hubspot_id, es un deal nuevo que debemos crear en HubSpot
            if not hubspot_deal_id:
                # Si no encontramos el deal local, error
                if not local_deal_data:
                    return {
                        "error": "No se encontró el deal en la base de datos local",
                        "details": f"No existe un deal con ID {deal_id} en Supabase."
                    }
                
                # Importar la función para crear deal en HubSpot
                from .deals import crear_deal_hubspot
                
                # Llamar a la función para crear el deal en HubSpot
                create_result = await crear_deal_hubspot(local_deal_data, user_id)
                
                # Si hay error, devolverlo
                if create_result.get("error"):
                    log_sync_operation("sync_deal", "deal", deal_id, success=False, error=create_result["error"])
                    return create_result
                
                # Si se creó correctamente, obtenemos el hubspot_id y continuamos con la sincronización
                hubspot_deal_id = create_result.get("id")
                
                # Registrar operación exitosa
                log_sync_operation("sync_deal", "deal", deal_id, success=True, error=f"Deal creado en HubSpot con ID {hubspot_deal_id}")
                
                # Si solo queríamos crear el deal, podemos devolver el resultado directamente
                if not force:
                    return create_result
            else:
                # Si ya existe en HubSpot, verificar si necesitamos actualizar la etapa o otros campos
                if local_deal_data:
                    # Verificar si el trato ya tiene una etapa específica
                    if local_deal_data.get("stage_id"):
                        try:
                            # Obtener la etapa local
                            stage_response = supabase.table("pipeline_stages").select("name, position").eq("id", local_deal_data["stage_id"]).maybe_single().execute()
                            
                            if stage_response.data:
                                stage_name = stage_response.data.get("name")
                                
                                # Importar función necesaria para mapear etapas
                                from hubspot import HubSpot
                                
                                hubspot_client = HubSpot(access_token=api_key)
                                
                                # Mapeo de etapas locales a HubSpot
                                stage_mapping = {
                                    "visitante": "Visitor Engaged",
                                    "captado": "Lead Captured", 
                                    "cultivado": "Lead Nurtured",
                                    "demo": "Demo Delivered",
                                    "negociación": "In Negotiation",
                                    "ganado": "Deal Won",
                                    "perdido": "Deal Lost"
                                }
                                
                                # Normalizar nombre de etapa para el mapeo
                                normalized_stage_name = stage_name.lower().replace(" ", "")
                                hubspot_stage_key = None
                                
                                if normalized_stage_name in stage_mapping:
                                    hubspot_stage_key = stage_mapping[normalized_stage_name]
                                
                                # Si tenemos una etapa correspondiente, actualizamos el deal en HubSpot
                                if hubspot_stage_key:
                                    # Obtener las etapas de HubSpot
                                    stages_response = hubspot_client.crm.pipelines.pipeline_stages_api.get_all(
                                        pipeline_id="default",
                                        object_type="deals"
                                    )
                                    
                                    hubspot_stage_id = None
                                    
                                    # Buscar la etapa correspondiente
                                    if stages_response.results:
                                        for stage in stages_response.results:
                                            if stage.label == hubspot_stage_key:
                                                hubspot_stage_id = stage.id
                                                break
                                    
                                    # Si encontramos la etapa, actualizar el deal
                                    if hubspot_stage_id:
                                        properties = {"dealstage": hubspot_stage_id}
                                        
                                        # Si hay otros campos relevantes, actualizarlos también
                                        if local_deal_data.get("value") is not None:
                                            properties["amount"] = str(local_deal_data["value"])
                                        
                                        if local_deal_data.get("title"):
                                            properties["dealname"] = local_deal_data["title"]
                                        
                                        if local_deal_data.get("description"):
                                            properties["description"] = local_deal_data["description"]
                                        
                                        # Actualizar el deal en HubSpot
                                        hubspot_client.crm.deals.basic_api.update(
                                            deal_id=hubspot_deal_id,
                                            simple_public_object_input=SimplePublicObjectInput(properties=properties)
                                        )
                                        
                                        logger.info(f"Deal {hubspot_deal_id} actualizado en HubSpot con la etapa: {hubspot_stage_key}")
                        except Exception as e:
                            logger.warning(f"Error actualizando etapa del deal en HubSpot: {e}")
        else:
            hubspot_deal_id = deal_id
        
        cache_key = f"deal_{user_id}_{hubspot_deal_id}"
        
        if not force:
            cached = await hubspot_cache.get(cache_key)
            if cached:
                return cached
        
        try:
            async with httpx.AsyncClient() as client:
                # Intentar obtener el deal de HubSpot
                response = await client.get(
                    f"https://api.hubapi.com/crm/v3/objects/deals/{hubspot_deal_id}",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    params={
                        "properties": "dealname,amount,dealstage,closedate,pipeline,description,hubspot_owner_id,createdate,dealtype"
                    }
                )
                
                # Manejar específicamente el error 401 (Unauthorized)
                if response.status_code == 401:
                    log_sync_operation("sync_deal", "deal", deal_id, success=False, error="Token de autenticación inválido o expirado")
                    return {
                        "error": "Error de autenticación con HubSpot",
                        "details": "El token de acceso ha expirado o no es válido. Por favor, reconecta tu cuenta de HubSpot."
                    }
                
                # Manejar el error 404 (Not Found)
                if response.status_code == 404:
                    log_sync_operation("sync_deal", "deal", deal_id, success=False, error=f"Deal {hubspot_deal_id} no encontrado en HubSpot")
                    return {
                        "error": f"Deal no encontrado en HubSpot",
                        "details": f"No se encontró un deal con ID {hubspot_deal_id} en HubSpot."
                    }
                
                # Para otros errores de API
                response.raise_for_status()
                deal = response.json()
                
                # Obtenemos también las asociaciones con contactos y empresas
                try:
                    associations_response = await client.get(
                        f"https://api.hubapi.com/crm/v3/objects/deals/{hubspot_deal_id}/associations/contacts",
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json",
                        }
                    )
                    if associations_response.status_code == 200:
                        contacts = associations_response.json()
                        deal["contacts"] = contacts.get("results", [])
                except Exception as assoc_error:
                    logger.warning(f"Error obteniendo contactos asociados al deal: {assoc_error}")
                    deal["contacts"] = []
                
                try:
                    companies_response = await client.get(
                        f"https://api.hubapi.com/crm/v3/objects/deals/{hubspot_deal_id}/associations/companies",
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json",
                        }
                    )
                    if companies_response.status_code == 200:
                        companies = companies_response.json()
                        deal["companies"] = companies.get("results", [])
                except Exception as assoc_error:
                    logger.warning(f"Error obteniendo empresas asociadas al deal: {assoc_error}")
                    deal["companies"] = []
                
                await hubspot_cache.set(cache_key, deal)
                log_sync_operation("sync_deal", "deal", deal_id, success=True)
                
                return deal
        except httpx.HTTPStatusError as e:
            error_message = str(e)
            if e.response.status_code == 401:
                error_message = "Token de autenticación inválido o expirado"
            elif e.response.status_code == 404:
                error_message = f"Deal {hubspot_deal_id} no encontrado en HubSpot"
            
            log_sync_operation("sync_deal", "deal", deal_id, success=False, error=error_message)
            return {"error": error_message}
        except Exception as e:
            log_sync_operation("sync_deal", "deal", deal_id, success=False, error=str(e))
            return {"error": str(e)}
    
    async def get_hubspot_id_for_deal(self, deal_id: str) -> Optional[str]:
        """
        Obtiene el ID de HubSpot para un deal local desde la base de datos.
        
        Args:
            deal_id: ID local del deal
            
        Returns:
            str: ID de HubSpot o None si no se encuentra
        """
        try:
            # Importamos aquí para evitar dependencias circulares
            from db import supabase
            
            # Consultar la tabla deals para obtener el hubspot_id
            response = supabase.table("deals").select("hubspot_id").eq("id", deal_id).maybe_single().execute()
            
            if response.data and response.data.get("hubspot_id"):
                return response.data["hubspot_id"]
            
            return None
        except Exception as e:
            logger.error(f"Error obteniendo hubspot_id para el deal {deal_id}: {e}")
            return None

# Instancia global del sincronizador
hubspot_sync = HubspotSync() 