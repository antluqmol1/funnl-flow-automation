"""
Módulo para gestionar deals (oportunidades) en HubSpot.
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

async def buscar_deal_hubspot(search_query: str, user_id: str = None):
    """
    Busca un deal en HubSpot por nombre u otra propiedad.
    
    Args:
        search_query: Término de búsqueda (nombre, monto, etc.)
        user_id: ID del usuario para obtener su token específico
        
    Returns:
        dict: Datos del deal encontrado o información sobre el error
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
        api_response = hubspot_client.crm.deals.search_api.do_search(
            public_object_search_request=search_request
        )
        
        if api_response.results and len(api_response.results) > 0:
            # Formatear resultados
            results = []
            for deal in api_response.results:
                deal_data = {
                    "id": deal.id,
                    "properties": deal.properties
                }
                
                # Añadir datos útiles comunes al nivel principal para facilitar acceso
                for key in ["dealname", "amount", "dealstage", "closedate", "pipeline"]:
                    if key in deal.properties:
                        deal_data[key] = deal.properties[key]
                
                results.append(deal_data)
                
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
                "message": "No se encontraron deals"
            }
        
    except ApiException as e:
        logger.error(f"Error de API HubSpot buscando deal: {e}")
        return {"error": f"Error de API HubSpot: {str(e)}"}
    
    except Exception as e:
        logger.error(f"Error buscando deal en HubSpot: {e}")
        return {"error": f"Error: {str(e)}"}

async def obtener_deal_hubspot(deal_id: str, user_id: str = None):
    """
    Obtiene información detallada de un deal en HubSpot por su ID.
    
    Args:
        deal_id: ID del deal en HubSpot
        user_id: ID del usuario para obtener su token específico
        
    Returns:
        dict: Información detallada del deal o error
    """
    try:
        # Obtener token
        access_token = await get_hubspot_token(user_id)
        if not access_token:
            return {"error": "No se pudo obtener token de acceso a HubSpot"}
        
        # Inicializar cliente
        hubspot_client = HubSpot(access_token=access_token)
        
        # Propiedades a recuperar
        properties = ["dealname", "amount", "dealstage", "closedate", "pipeline",
                      "description", "hubspot_owner_id", "createdate", "dealtype"]
        
        # Obtener deal
        api_response = hubspot_client.crm.deals.basic_api.get_by_id(
            deal_id=deal_id,
            properties=properties
        )
        
        # Obtener asociaciones con empresas y contactos
        associated_companies = []
        associated_contacts = []
        
        try:
            company_associations = hubspot_client.crm.deals.associations_api.get_all(
                deal_id=deal_id,
                to_object_type="companies"
            )
            if company_associations.results:
                associated_companies = [result.id for result in company_associations.results]
        except Exception as e:
            logger.warning(f"Error obteniendo empresas asociadas al deal: {e}")
        
        try:
            contact_associations = hubspot_client.crm.deals.associations_api.get_all(
                deal_id=deal_id,
                to_object_type="contacts"
            )
            if contact_associations.results:
                associated_contacts = [result.id for result in contact_associations.results]
        except Exception as e:
            logger.warning(f"Error obteniendo contactos asociados al deal: {e}")
        
        return {
            "success": True,
            "id": api_response.id,
            "properties": api_response.properties,
            "companies": associated_companies,
            "contacts": associated_contacts
        }
    
    except ApiException as e:
        logger.error(f"Error de API HubSpot obteniendo deal: {e}")
        return {"error": f"Error de API HubSpot: {str(e)}"}
    
    except Exception as e:
        logger.error(f"Error obteniendo deal de HubSpot: {e}")
        return {"error": f"Error: {str(e)}"} 