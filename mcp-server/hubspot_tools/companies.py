"""
Módulo para gestionar empresas en HubSpot.
"""
import logging
import os
import httpx
from typing import Dict, Any, Optional, List
from dotenv import load_dotenv
from hubspot import HubSpot
from hubspot.crm.objects.exceptions import ApiException
from hubspot.crm.objects.models import SimplePublicObjectInput
from hubspot.crm.objects.models import PublicObjectSearchRequest
from hubspot.crm.objects.models import SimplePublicObjectBatchInput
from hubspot.crm.objects.models import BatchInputSimplePublicObjectBatchInput

# Configurar logging
logger = logging.getLogger(__name__)

# Cargar variables de entorno
load_dotenv()

HUBSPOT_TOKEN = os.getenv("HUBSPOT_TOKEN")
BASE_URL = "https://api.hubapi.com/crm/v3/objects/companies"

class HubspotError(Exception):
    """Excepción personalizada para errores de HubSpot"""
    pass

async def make_request(
    method: str,
    endpoint: str,
    data: Optional[Dict] = None,
    params: Optional[Dict] = None,
    timeout: float = 30.0
) -> Dict:
    """
    Realiza una petición a la API de HubSpot.
    
    Args:
        method: Método HTTP (GET, POST, PATCH)
        endpoint: Endpoint de la API
        data: Datos para enviar en el cuerpo de la petición
        params: Parámetros de query string
        timeout: Tiempo máximo de espera para la respuesta
    
    Returns:
        Dict con la respuesta de la API
    
    Raises:
        HubspotError: Si hay un error en la petición
    """
    if not HUBSPOT_TOKEN:
        raise HubspotError("HUBSPOT_TOKEN no configurado")

    headers = {
        "Authorization": f"Bearer {HUBSPOT_TOKEN}",
        "Content-Type": "application/json"
    }

    url = f"{BASE_URL}/{endpoint}" if endpoint else BASE_URL

    try:
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                json=data,
                params=params,
                timeout=timeout
            )
            response.raise_for_status()
            return response.json()
    except httpx.TimeoutException:
        raise HubspotError("Timeout en la petición")
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise HubspotError("Error de autenticación. Verifica el HUBSPOT_TOKEN")
        error_detail = e.response.json() if e.response.text else str(e)
        raise HubspotError(f"Error HTTP: {error_detail}")
    except Exception as e:
        raise HubspotError(f"Error inesperado: {str(e)}")

def create_search_filter(search_term: str, search_type: Optional[str] = None) -> Dict:
    """
    Crea un filtro de búsqueda para la API de HubSpot.
    """
    properties = ["name", "industry", "city", "country", "domain", "createdate"]
    
    # Si se especifica el tipo de búsqueda
    if search_type:
        return {
            "filterGroups": [{
                "filters": [{
                    "propertyName": search_type,
                    "operator": "CONTAINS_TOKEN" if search_type == "name" else "EQ",
                    "value": search_term
                }]
            }],
            "properties": properties,
            "limit": 10
        }
    
    # Si es una búsqueda por dominio
    if "." in search_term:
        return {
            "filterGroups": [{
                "filters": [{
                    "propertyName": "domain",
                    "operator": "EQ",
                    "value": search_term
                }]
            }],
            "properties": properties,
            "limit": 10
        }
    
    # Búsqueda por nombre por defecto
    return {
        "filterGroups": [{
            "filters": [{
                "propertyName": "name",
                "operator": "CONTAINS_TOKEN",
                "value": search_term
            }]
        }],
        "properties": properties,
        "limit": 10
    }

async def get_hubspot_token(user_id: str = None):
    """
    Obtiene el token de acceso de HubSpot.
    Si se proporciona user_id, lo busca en la BD.
    En otro caso, usa un token fijo para pruebas.
    """
    # Usar la misma función del módulo contacts
    from .contacts import get_hubspot_token
    return await get_hubspot_token(user_id)

async def buscar_empresa_hubspot(search_query: str, user_id: str = None):
    """
    Busca una empresa en HubSpot por nombre u otra propiedad.
    
    Args:
        search_query: Término de búsqueda (nombre, dominio, etc.)
        user_id: ID del usuario para obtener su token específico
        
    Returns:
        dict: Datos de la empresa encontrada o información sobre el error
    """
    try:
        # Obtener token
        access_token = await get_hubspot_token(user_id)
        if not access_token:
            return {"error": "No se pudo obtener token de acceso a HubSpot"}
        
        # Inicializar cliente
        hubspot_client = HubSpot(access_token=access_token)
        
        # Configurar búsqueda
        search_request = PublicObjectSearchRequest(
            query=search_query,
            limit=10
        )
        
        # Ejecutar búsqueda
        api_response = hubspot_client.crm.companies.search_api.do_search(
            public_object_search_request=search_request
        )
        
        if api_response.results and len(api_response.results) > 0:
            # Formatear resultados
            results = []
            for company in api_response.results:
                company_data = {
                    "id": company.id,
                    "properties": company.properties
                }
                
                # Añadir datos útiles comunes al nivel principal para facilitar acceso
                for key in ["name", "domain", "city", "industry", "description"]:
                    if key in company.properties:
                        company_data[key] = company.properties[key]
                
                results.append(company_data)
                
            return {
                "success": True,
                "total": len(results),
                "results": results
            }
        else:
            return {
                "success": True,
                "total": 0,
                "results": [],
                "message": "No se encontraron empresas"
            }
        
    except ApiException as e:
        logger.error(f"Error de API HubSpot buscando empresa: {e}")
        return {"error": f"Error de API HubSpot: {str(e)}"}
    
    except Exception as e:
        logger.error(f"Error buscando empresa en HubSpot: {e}")
        return {"error": f"Error: {str(e)}"}

async def obtener_empresa_hubspot(company_id: str, user_id: str = None):
    """
    Obtiene información detallada de una empresa en HubSpot por su ID.
    
    Args:
        company_id: ID de la empresa en HubSpot
        user_id: ID del usuario para obtener su token específico
        
    Returns:
        dict: Información detallada de la empresa o error
    """
    try:
        # Obtener token
        access_token = await get_hubspot_token(user_id)
        if not access_token:
            return {"error": "No se pudo obtener token de acceso a HubSpot"}
        
        # Inicializar cliente
        hubspot_client = HubSpot(access_token=access_token)
        
        # Propiedades a recuperar
        properties = ["name", "domain", "industry", "city", "country", 
                     "description", "website", "phone", "numberofemployees", 
                     "annualrevenue", "type", "lifecyclestage"]
        
        # Obtener empresa
        api_response = hubspot_client.crm.companies.basic_api.get_by_id(
            company_id=company_id,
            properties=properties
        )
        
        return {
            "success": True,
            "id": api_response.id,
            "properties": api_response.properties
        }
    
    except ApiException as e:
        logger.error(f"Error de API HubSpot obteniendo empresa: {e}")
        return {"error": f"Error de API HubSpot: {str(e)}"}
    
    except Exception as e:
        logger.error(f"Error obteniendo empresa de HubSpot: {e}")
        return {"error": f"Error: {str(e)}"}

async def crear_empresa_hubspot(name: str, description: str = "", industry: str = "", city: str = "", user_id: str = None):
    """
    Crea una nueva empresa en HubSpot.
    
    Args:
        name: Nombre de la empresa
        description: Descripción de la empresa
        industry: Industria de la empresa
        city: Ciudad de la empresa
        user_id: ID del usuario para obtener su token específico
        
    Returns:
        dict: Información de la empresa creada o error
    """
    try:
        # Obtener token
        access_token = await get_hubspot_token(user_id)
        if not access_token:
            return {"error": "No se pudo obtener token de acceso a HubSpot"}
        
        # Inicializar cliente
        hubspot_client = HubSpot(access_token=access_token)
        
        # Preparar propiedades
        properties = {
            "name": name
        }
        
        # Añadir propiedades adicionales si están disponibles
        if description:
            properties["description"] = description
        if industry:
            properties["industry"] = industry
        if city:
            properties["city"] = city
        
        # Verificar si la empresa ya existe
        # Buscar por nombre para evitar duplicados
        search_request = PublicObjectSearchRequest(
            filter_groups=[
                {
                    "filters": [
                        {
                            "property_name": "name",
                            "operator": "EQ",
                            "value": name
                        }
                    ]
                }
            ],
            limit=1
        )
        
        search_response = hubspot_client.crm.companies.search_api.do_search(
            public_object_search_request=search_request
        )
        
        if search_response.total > 0:
            return {
                "success": False,
                "error": "La empresa ya existe",
                "company": {
                    "id": search_response.results[0].id,
                    "properties": search_response.results[0].properties
                }
            }
        
        # Crear la empresa
        simple_public_object_input = SimplePublicObjectInput(properties=properties)
        api_response = hubspot_client.crm.companies.basic_api.create(
            simple_public_object_input=simple_public_object_input
        )
        
        return {
            "success": True,
            "id": api_response.id,
            "properties": api_response.properties
        }
    
    except ApiException as e:
        logger.error(f"Error de API HubSpot creando empresa: {e}")
        return {"error": f"Error de API HubSpot: {str(e)}"}
    
    except Exception as e:
        logger.error(f"Error creando empresa en HubSpot: {e}")
        return {"error": f"Error: {str(e)}"}

async def actualizar_empresa_hubspot(company_id: str, properties: dict, user_id: str = None):
    """
    Actualiza una empresa existente en HubSpot.
    
    Args:
        company_id: ID de la empresa en HubSpot
        properties: Diccionario con propiedades a actualizar
        user_id: ID del usuario para obtener su token específico
        
    Returns:
        dict: Información de la empresa actualizada o error
    """
    try:
        # Obtener token
        access_token = await get_hubspot_token(user_id)
        if not access_token:
            return {"error": "No se pudo obtener token de acceso a HubSpot"}
        
        # Inicializar cliente
        hubspot_client = HubSpot(access_token=access_token)
        
        # Actualizar la empresa
        simple_public_object_input = SimplePublicObjectInput(properties=properties)
        api_response = hubspot_client.crm.companies.basic_api.update(
            company_id=company_id,
            simple_public_object_input=simple_public_object_input
        )
        
        return {
            "success": True,
            "id": company_id,
            "properties": properties
        }
    
    except ApiException as e:
        logger.error(f"Error de API HubSpot actualizando empresa: {e}")
        return {"error": f"Error de API HubSpot: {str(e)}"}
    
    except Exception as e:
        logger.error(f"Error actualizando empresa en HubSpot: {e}")
        return {"error": f"Error: {str(e)}"} 