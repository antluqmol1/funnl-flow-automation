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
from hubspot.crm.objects.models import Filter, FilterGroup

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

async def crear_empresa_hubspot(name: str, description: str = "", city: str = "", user_id: str = None):
    """
    Crea una nueva empresa en HubSpot.
    
    Args:
        name: Nombre de la empresa
        description: Descripción de la empresa
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
            "name": name,
            "city": city
        }
        
        # --- Inicio: Inferir Industria ---
        inferred_industry = None
        # Mapeo (simplificado - añadir más según sea necesario)
        # Claves: palabras clave (minúsculas) | Valores: Valores válidos de HubSpot Industry
        industry_mapping = {
            "account": "ACCOUNTING",
            "airline": "AIRLINES_AVIATION",
            "aviation": "AIRLINES_AVIATION",
            "fashion": "APPAREL_FASHION",
            "apparel": "APPAREL_FASHION",
            "architect": "ARCHITECTURE_PLANNING",
            "planning": "ARCHITECTURE_PLANNING",
            "auto": "AUTOMOTIVE",
            "car": "AUTOMOTIVE",
            "bank": "BANKING",
            "biotech": "BIOTECHNOLOGY",
            "software": "COMPUTER_SOFTWARE",
            "hardware": "COMPUTER_HARDWARE",
            "network": "COMPUTER_NETWORKING", # O COMPUTER_NETWORK_SECURITY
            "security": "COMPUTER_NETWORK_SECURITY",
            "it": "INFORMATION_TECHNOLOGY_AND_SERVICES",
            "tech": "INFORMATION_TECHNOLOGY_AND_SERVICES", # O TECHNOLOGY
            "internet": "INTERNET",
            "construct": "CONSTRUCTION",
            "build": "CONSTRUCTION",
            "electronic": "CONSUMER_ELECTRONICS", # O ELECTRICAL_ELECTRONIC_MANUFACTURING
            "consumer": "CONSUMER_GOODS", # O CONSUMER_SERVICES
            "service": "CONSUMER_SERVICES", # O INFORMATION_SERVICES, etc.
            "cosmetic": "COSMETICS",
            "education": "EDUCATION_MANAGEMENT", # O HIGHER_EDUCATION, PRIMARY_SECONDARY_EDUCATION
            "learn": "E_LEARNING",
            "entertain": "ENTERTAINMENT",
            "environ": "ENVIRONMENTAL_SERVICES", # O RENEWABLES_ENVIRONMENT
            "event": "EVENTS_SERVICES",
            "financ": "FINANCIAL_SERVICES",
            "food": "FOOD_BEVERAGES", # O FOOD_PRODUCTION
            "beverage": "FOOD_BEVERAGES",
            "furniture": "FURNITURE",
            "health": "HEALTH_WELLNESS_AND_FITNESS", # O HOSPITAL_HEALTH_CARE, MENTAL_HEALTH_CARE
            "hospital": "HOSPITAL_HEALTH_CARE", # O HOSPITALITY
            "hr": "HUMAN_RESOURCES",
            "insurance": "INSURANCE",
            "legal": "LEGAL_SERVICES",
            "law": "LAW_PRACTICE",
            "logistic": "LOGISTICS_AND_SUPPLY_CHAIN",
            "supply": "LOGISTICS_AND_SUPPLY_CHAIN",
            "consult": "MANAGEMENT_CONSULTING",
            "market": "MARKETING_AND_ADVERTISING", # O MARKET_RESEARCH
            "advertis": "MARKETING_AND_ADVERTISING",
            "media": "MEDIA_PRODUCTION", # O BROADCAST_MEDIA, ONLINE_MEDIA
            "medical": "MEDICAL_DEVICES", # O MEDICAL_PRACTICE
            "nonprofit": "NON_PROFIT_ORGANIZATION_MANAGEMENT",
            "non-profit": "NON_PROFIT_ORGANIZATION_MANAGEMENT",
            "oil": "OIL_ENERGY",
            "energy": "OIL_ENERGY",
            "pharma": "PHARMACEUTICALS",
            "estate": "REAL_ESTATE",
            "restaurant": "RESTAURANTS",
            "retail": "RETAIL",
            "telecom": "TELECOMMUNICATIONS",
            "transport": "TRANSPORTATION_TRUCKING_RAILROAD",
            "truck": "TRANSPORTATION_TRUCKING_RAILROAD",
            "utilit": "UTILITIES",
            "wholesal": "WHOLESALE",
            # Para "MovilesLuque":
            "mobile": "TELECOMMUNICATIONS", # O WIRELESS, CONSUMER_ELECTRONICS
            "phone": "TELECOMMUNICATIONS"
        }
        
        # Combinar texto de nombre y descripción para análisis
        text_to_analyze = f"{name.lower()} {description.lower()}"
        words = text_to_analyze.split()
        
        # Buscar coincidencias (se puede mejorar la lógica)
        found_industries = []
        for word in words:
             # Simplificar palabra (quitar puntuación, etc. - se puede mejorar)
            clean_word = ''.join(filter(str.isalnum, word))
            for keyword, industry_value in industry_mapping.items():
                if keyword in clean_word:
                    found_industries.append(industry_value)
        
        # Decidir la industria (ej: la más frecuente si hay varias)
        if found_industries:
            from collections import Counter
            most_common_industry = Counter(found_industries).most_common(1)[0][0]
            inferred_industry = most_common_industry
            logger.info(f"Industria inferida para '{name}': {inferred_industry}")
        else:
            logger.info(f"No se pudo inferir industria para '{name}'")
            
        # Añadir al diccionario de propiedades si se infirió una
        if inferred_industry:
            properties["industry"] = inferred_industry
        # --- Fin: Inferir Industria ---
        
        # Verificar si la empresa ya existe
        # Buscar por nombre para evitar duplicados
        # Usar los modelos del SDK para la búsqueda
        name_filter = Filter(property_name="name", operator="EQ", value=name)
        filter_group = FilterGroup(filters=[name_filter])
        search_request = PublicObjectSearchRequest(
            filter_groups=[filter_group],
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
            simple_public_object_input_for_create=simple_public_object_input
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