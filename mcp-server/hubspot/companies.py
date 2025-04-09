import os
import httpx
from typing import Dict, Any, Optional, List
from dotenv import load_dotenv

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

async def buscar_empresa_hubspot(first_search_property_name: str) -> Dict:
    """
    Busca empresas en HubSpot.
    
    Args:
        first_search_property_name: Término de búsqueda (nombre, dominio o industria)
        
    Returns:
        Dict con los resultados o error
    """
    if not HUBSPOT_TOKEN:
        return {"error": "HUBSPOT_TOKEN no configurado"}

    try:
        search_filter = {
            "filterGroups": [{
                "filters": [{
                    "propertyName": "name",
                    "operator": "CONTAINS_TOKEN",
                    "value": first_search_property_name
                }]
            }],
            "properties": ["name", "industry", "city", "country", "domain", "createdate"],
            "limit": 10
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{BASE_URL}/search",
                headers={
                    "Authorization": f"Bearer {HUBSPOT_TOKEN}",
                    "Content-Type": "application/json"
                },
                json=search_filter,
                timeout=30.0
            )
            response.raise_for_status()
            result = response.json()

            if not result.get("results"):
                return {"error": f"No se encontraron empresas que coincidan con '{first_search_property_name}'"}

            companies = []
            for company in result.get("results", []):
                properties = company.get("properties", {})
                company_data = {
                    "id": company.get("id"),
                    "name": properties.get("name", "Sin nombre")
                }
                
                for prop in properties:
                    if properties[prop] and prop != "name":
                        company_data[prop] = properties[prop]

                companies.append(company_data)

            return {
                "total": result.get("total", 0),
                "results": companies
            }

    except httpx.TimeoutException:
        return {"error": "Timeout en la petición"}
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            return {"error": "Error de autenticación. Verifica el HUBSPOT_TOKEN"}
        error_detail = e.response.json() if e.response.text else str(e)
        return {"error": f"Error HTTP: {error_detail}"}
    except Exception as e:
        return {"error": f"Error inesperado: {str(e)}"}

async def obtener_empresa_hubspot(id: str, properties_to_retrieve: str) -> Dict:
    """
    Obtiene una empresa específica de HubSpot.
    
    Args:
        id: ID de la empresa
        properties_to_retrieve: Propiedades a recuperar (separadas por coma)
    """
    try:
        return await make_request(
            "GET",
            id,
            params={"properties": properties_to_retrieve.split(",")}
        )
    except HubspotError as e:
        return {"error": str(e)}

async def crear_empresa_hubspot(
    name: str,
    description: str = "",
    industry: str = "",
    city: str = ""
) -> Dict:
    """
    Crea una nueva empresa en HubSpot.

    Args:
        name: Nombre de la empresa (requerido)
        description: Descripción de la empresa (about_us)
        industry: Industria de la empresa
        city: Ciudad donde se encuentra la empresa

    Returns:
        Dict con la respuesta de la creación
    """
    try:
        # Crear propiedades con valores no vacíos
        properties = {
            "name": name,
            "about_us": description
        }

        # Añadir propiedades opcionales si tienen valor
        if industry:
            properties["industry"] = industry
        if city:
            properties["city"] = city

        result = await make_request("POST", "", data={"properties": properties})
        
        if result.get("id"):
            response = {
                "message": f"Empresa '{name}' creada exitosamente",
                "id": result.get("id"),
                "properties": result.get("properties", {})
            }
        else:
            response = {"error": "No se pudo crear la empresa"}

        return response

    except HubspotError as e:
        return {"error": str(e)}

async def actualizar_empresa_hubspot(
    instructions: str,
    id: str,
    **properties: str
) -> Dict:
    """
    Actualiza una empresa en HubSpot.
    
    Args:
        instructions: Instrucciones adicionales para manejar campos personalizados
        id: ID de la empresa
        **properties: Propiedades a actualizar como argumentos nombrados
    
    Returns:
        Dict con el resultado de la actualización
    """
    try:
        # Filtrar propiedades no vacías y excluir instructions
        filtered_properties = {
            k: v for k, v in properties.items()
            if v and k != "instructions"
        }

        return await make_request(
            "PATCH",
            id,
            data={"properties": filtered_properties}
        )

    except HubspotError as e:
        return {"error": str(e)} 