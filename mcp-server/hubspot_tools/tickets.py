"""
Módulo para gestionar tickets en HubSpot.
"""
import logging
import os
from dotenv import load_dotenv
from hubspot import HubSpot
from hubspot.crm.objects.exceptions import ApiException
from hubspot.crm.objects.models import PublicObjectSearchRequest

# Configurar logging
logger = logging.getLogger(__name__)

# Cargar variables de entorno
load_dotenv()

async def get_hubspot_token(user_id: str = None):
    """
    Obtiene el token de acceso de HubSpot.
    Si se proporciona user_id, lo busca en la BD.
    En otro caso, usa un token fijo para pruebas.
    """
    # Usar la misma función del módulo contacts
    from .contacts import get_hubspot_token
    return await get_hubspot_token(user_id)

async def buscar_ticket_hubspot(search_query: str, user_id: str = None):
    """
    Busca un ticket en HubSpot por asunto u otra propiedad.
    
    Args:
        search_query: Término de búsqueda (asunto, id, etc.)
        user_id: ID del usuario para obtener su token específico
        
    Returns:
        dict: Datos del ticket encontrado o información sobre el error
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
        api_response = hubspot_client.crm.tickets.search_api.do_search(
            public_object_search_request=search_request
        )
        
        if api_response.results and len(api_response.results) > 0:
            # Formatear resultados
            results = []
            for ticket in api_response.results:
                ticket_data = {
                    "id": ticket.id,
                    "properties": ticket.properties
                }
                
                # Añadir datos útiles comunes al nivel principal para facilitar acceso
                for key in ["subject", "content", "hs_pipeline_stage", "hs_ticket_priority", "createdate"]:
                    if key in ticket.properties:
                        ticket_data[key] = ticket.properties[key]
                
                results.append(ticket_data)
                
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
                "message": "No se encontraron tickets"
            }
        
    except ApiException as e:
        logger.error(f"Error de API HubSpot buscando ticket: {e}")
        return {"error": f"Error de API HubSpot: {str(e)}"}
    
    except Exception as e:
        logger.error(f"Error buscando ticket en HubSpot: {e}")
        return {"error": f"Error: {str(e)}"}

async def obtener_ticket_hubspot(ticket_id: str, user_id: str = None):
    """
    Obtiene información detallada de un ticket en HubSpot por su ID.
    
    Args:
        ticket_id: ID del ticket en HubSpot
        user_id: ID del usuario para obtener su token específico
        
    Returns:
        dict: Información detallada del ticket o error
    """
    try:
        # Obtener token
        access_token = await get_hubspot_token(user_id)
        if not access_token:
            return {"error": "No se pudo obtener token de acceso a HubSpot"}
        
        # Inicializar cliente
        hubspot_client = HubSpot(access_token=access_token)
        
        # Propiedades a recuperar
        properties = ["subject", "content", "hs_pipeline_stage", "hs_ticket_priority", 
                     "createdate", "hs_lastmodifieddate", "hs_pipeline",
                     "hs_resolution", "source_type"]
        
        # Obtener ticket
        api_response = hubspot_client.crm.tickets.basic_api.get_by_id(
            ticket_id=ticket_id,
            properties=properties
        )
        
        # Obtener asociaciones con empresas y contactos
        associated_companies = []
        associated_contacts = []
        
        try:
            company_associations = hubspot_client.crm.tickets.associations_api.get_all(
                ticket_id=ticket_id,
                to_object_type="companies"
            )
            if company_associations.results:
                associated_companies = [result.id for result in company_associations.results]
        except Exception as e:
            logger.warning(f"Error obteniendo empresas asociadas al ticket: {e}")
        
        try:
            contact_associations = hubspot_client.crm.tickets.associations_api.get_all(
                ticket_id=ticket_id,
                to_object_type="contacts"
            )
            if contact_associations.results:
                associated_contacts = [result.id for result in contact_associations.results]
        except Exception as e:
            logger.warning(f"Error obteniendo contactos asociados al ticket: {e}")
        
        return {
            "success": True,
            "id": api_response.id,
            "properties": api_response.properties,
            "companies": associated_companies,
            "contacts": associated_contacts
        }
    
    except ApiException as e:
        logger.error(f"Error de API HubSpot obteniendo ticket: {e}")
        return {"error": f"Error de API HubSpot: {str(e)}"}
    
    except Exception as e:
        logger.error(f"Error obteniendo ticket de HubSpot: {e}")
        return {"error": f"Error: {str(e)}"} 