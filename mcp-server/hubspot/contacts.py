import os
import httpx
from dotenv import load_dotenv

load_dotenv()

HUBSPOT_TOKEN = os.getenv("HUBSPOT_TOKEN")
HUBSPOT_URL = "https://api.hubapi.com/crm/v3/objects/contacts/search"

async def search_hubspot_contact(search_property: str) -> dict:
    """
    Realiza una búsqueda de contactos en HubSpot.
    
    Args:
        search_property: Propiedad por la cual buscar
    
    Returns:
        Dict con los resultados de la búsqueda
    """
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {HUBSPOT_TOKEN}",
    }
    
    payload = {
        "filterGroups": [{
            "filters": [{
                "propertyName": search_property,
                "operator": "HAS_PROPERTY"
            }]
        }],
        "properties": [search_property],
        "limit": 10
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(HUBSPOT_URL, headers=headers, json=payload)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            return {"error": f"Error HTTP al buscar el contacto: {str(e)}"}
        except Exception as e:
            return {"error": f"Error al buscar el contacto: {str(e)}"}

async def buscar_contacto_hubspot(first_search_property_name: str) -> dict:
    """
    Busca un contacto en HubSpot por una propiedad específica.
    
    Args:
        first_search_property_name: Nombre de la propiedad por la cual buscar
    
    Returns:
        Dict con los resultados de la búsqueda o mensaje de error
    """
    if not HUBSPOT_TOKEN:
        return {"error": "HUBSPOT_TOKEN no configurado"}
    
    # Realizar la búsqueda
    result = await search_hubspot_contact(first_search_property_name)
    
    # Procesar y formatear la respuesta
    if "error" in result:
        return result
    
    if result.get("total", 0) == 0:
        return {"error": "No se encontraron contactos con la propiedad especificada"}
    
    # Formatear los resultados
    contacts = []
    for contact in result.get("results", []):
        properties = contact.get("properties", {})
        contacts.append({
            "id": contact.get("id"),
            "properties": {
                first_search_property_name: properties.get(first_search_property_name, "")
            }
        })
    
    return {
        "total": result.get("total", 0),
        "results": contacts
    }

async def crear_contacto_hubspot(firstname: str, email: str) -> dict:
    """
    Crea un nuevo contacto en HubSpot.
    
    Args:
        firstname: Nombre del contacto.
        email: Email del contacto.
    
    Returns:
        Un diccionario con la respuesta de la API de HubSpot.
    """
    HUBSPOT_URL = "https://api.hubapi.com/crm/v3/objects/contacts"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {HUBSPOT_TOKEN}",
    }
    
    payload = {
        "properties": {
            "firstname": firstname,
            "email": email
        }
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(HUBSPOT_URL, headers=headers, json=payload)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                return {"error": "Error de autenticación. Por favor, verifica que el HUBSPOT_API_KEY sea válido."}
            return {"error": f"Error al crear el contacto: {str(e)}"}
        except Exception as e:
            return {"error": f"Error inesperado: {str(e)}"} 