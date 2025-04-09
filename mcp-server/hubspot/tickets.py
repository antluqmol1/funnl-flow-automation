import os
import httpx
from dotenv import load_dotenv

load_dotenv()

HUBSPOT_TOKEN = os.getenv("HUBSPOT_TOKEN")

async def buscar_ticket_hubspot(first_search_property_name: str) -> dict:
    """
    Busca un ticket en HubSpot.
    
    Args:
        first_search_property_name: Propiedad por la cual buscar
    """
    HUBSPOT_URL = "https://api.hubapi.com/crm/v3/objects/tickets/search"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {HUBSPOT_TOKEN}",
    }
    
    payload = {
        "filterGroups": [{
            "filters": [{
                "propertyName": first_search_property_name,
                "operator": "EQ",
                "value": first_search_property_name
            }]
        }]
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(HUBSPOT_URL, headers=headers, json=payload)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {"error": f"Error al buscar el ticket: {str(e)}"}

async def obtener_ticket_hubspot(id: str, properties_to_retrieve: str) -> dict:
    """
    Obtiene un ticket específico de HubSpot.
    
    Args:
        id: ID del ticket
        properties_to_retrieve: Propiedades a recuperar
    """
    HUBSPOT_URL = f"https://api.hubapi.com/crm/v3/objects/tickets/{id}"
    
    headers = {
        "Authorization": f"Bearer {HUBSPOT_TOKEN}",
    }
    
    params = {
        "properties": properties_to_retrieve.split(",")
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(HUBSPOT_URL, headers=headers, params=params)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {"error": f"Error al obtener el ticket: {str(e)}"} 