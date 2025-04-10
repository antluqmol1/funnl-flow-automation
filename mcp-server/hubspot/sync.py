"""
Módulo para manejar la sincronización y el caché de datos de HubSpot.
"""
import os
import json
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv
import httpx
from .contacts import buscar_contacto_hubspot
from .companies import buscar_empresa_hubspot, obtener_empresa_hubspot
from .deals import buscar_deal_hubspot, obtener_deal_hubspot
from .tickets import buscar_ticket_hubspot, obtener_ticket_hubspot
from .utils import log_sync_operation

load_dotenv()

CACHE_DURATION = int(os.getenv("HUBSPOT_CACHE_DURATION", "300"))  # 5 minutos por defecto

class HubspotCache:
    """Clase para manejar el caché de datos de HubSpot"""
    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._last_sync: Dict[str, datetime] = {}

    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        """Obtiene un valor del caché si es válido"""
        if key not in self._cache or key not in self._last_sync:
            return None
        
        if datetime.now() - self._last_sync[key] > timedelta(seconds=CACHE_DURATION):
            return None
            
        return self._cache[key]

    async def set(self, key: str, value: Dict[str, Any]) -> None:
        """Almacena un valor en el caché"""
        self._cache[key] = value
        self._last_sync[key] = datetime.now()

    async def invalidate(self, key: str) -> None:
        """Invalida una entrada específica del caché"""
        if key in self._cache:
            del self._cache[key]
            del self._last_sync[key]

    async def clear(self) -> None:
        """Limpia todo el caché"""
        self._cache.clear()
        self._last_sync.clear()

# Instancia global del caché
hubspot_cache = HubspotCache()

class HubspotSync:
    """Clase para manejar la sincronización con HubSpot"""
    def __init__(self):
        self._webhook_handlers: List[callable] = []
        self._conflict_handlers: List[callable] = []
        self._api_keys: Dict[str, str] = {}  # user_id -> api_key

    async def set_api_key(self, user_id: str, api_key: str) -> None:
        """
        Establece la API key para un usuario específico.
        
        Args:
            user_id: ID del usuario
            api_key: API key de HubSpot
        """
        self._api_keys[user_id] = api_key

    async def get_api_key(self, user_id: str) -> Optional[str]:
        """
        Obtiene la API key de un usuario específico.
        
        Args:
            user_id: ID del usuario
        
        Returns:
            str | None: API key del usuario o None si no existe
        """
        return self._api_keys.get(user_id)

    async def register_webhook_handler(self, handler: callable) -> None:
        """Registra un manejador de webhooks"""
        self._webhook_handlers.append(handler)

    async def register_conflict_handler(self, handler: callable) -> None:
        """Registra un manejador de conflictos"""
        self._conflict_handlers.append(handler)

    async def handle_webhook(self, event_type: str, data: Dict[str, Any]) -> None:
        """Maneja los eventos de webhook de HubSpot"""
        for handler in self._webhook_handlers:
            try:
                await handler(event_type, data)
            except Exception as e:
                log_sync_operation(
                    "webhook_handler",
                    event_type,
                    str(data.get("objectId", "unknown")),
                    success=False,
                    error=str(e)
                )

    async def handle_conflict(self, local_data: Dict[str, Any], hubspot_data: Dict[str, Any]) -> Dict[str, Any]:
        """Maneja conflictos entre datos locales y de HubSpot"""
        for handler in self._conflict_handlers:
            try:
                resolution = await handler(local_data, hubspot_data)
                if resolution:
                    return resolution
            except Exception as e:
                log_sync_operation(
                    "conflict_handler",
                    "conflict",
                    str(local_data.get("id", "unknown")),
                    success=False,
                    error=str(e)
                )
        
        # Por defecto, los datos más recientes ganan
        local_updated = local_data.get("updated_at")
        hubspot_updated = hubspot_data.get("updated_at")
        
        if not local_updated or (hubspot_updated and hubspot_updated > local_updated):
            return hubspot_data
        return local_data

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

    async def sync_deal(self, user_id: str, deal_id: str, force: bool = False) -> Dict[str, Any]:
        """
        Sincroniza un deal específico con HubSpot.
        
        Args:
            user_id: ID del usuario
            deal_id: ID del deal
            force: Si se debe forzar la sincronización ignorando el caché
        """
        api_key = await self.get_api_key(user_id)
        if not api_key:
            return {"error": "API Key no configurada"}

        cache_key = f"deal_{user_id}_{deal_id}"
        
        if not force:
            cached = await hubspot_cache.get(cache_key)
            if cached:
                return cached

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://api.hubapi.com/crm/v3/objects/deals/{deal_id}",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    }
                )
                response.raise_for_status()
                deal = response.json()
                
                await hubspot_cache.set(cache_key, deal)
                log_sync_operation("sync_deal", "deal", deal_id, success=True)
                
                return deal
        except Exception as e:
            log_sync_operation("sync_deal", "deal", deal_id, success=False, error=str(e))
            return {"error": str(e)}

    async def sync_ticket(self, user_id: str, ticket_id: str, force: bool = False) -> Dict[str, Any]:
        """
        Sincroniza un ticket específico con HubSpot.
        
        Args:
            user_id: ID del usuario
            ticket_id: ID del ticket
            force: Si se debe forzar la sincronización ignorando el caché
        """
        api_key = await self.get_api_key(user_id)
        if not api_key:
            return {"error": "API Key no configurada"}

        cache_key = f"ticket_{user_id}_{ticket_id}"
        
        if not force:
            cached = await hubspot_cache.get(cache_key)
            if cached:
                return cached

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://api.hubapi.com/crm/v3/objects/tickets/{ticket_id}",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    }
                )
                response.raise_for_status()
                ticket = response.json()
                
                await hubspot_cache.set(cache_key, ticket)
                log_sync_operation("sync_ticket", "ticket", ticket_id, success=True)
                
                return ticket
        except Exception as e:
            log_sync_operation("sync_ticket", "ticket", ticket_id, success=False, error=str(e))
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

# Instancia global del sincronizador
hubspot_sync = HubspotSync() 