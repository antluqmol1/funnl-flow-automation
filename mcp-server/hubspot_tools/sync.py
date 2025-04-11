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

# Instancia global del sincronizador
hubspot_sync = HubspotSync() 