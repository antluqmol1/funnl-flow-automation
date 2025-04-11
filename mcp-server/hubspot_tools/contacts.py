"""
Módulo para gestionar contactos en HubSpot.
"""
import logging
import os
from dotenv import load_dotenv
from hubspot import HubSpot
from hubspot.crm.objects.exceptions import ApiException
from hubspot.crm.objects.models import SimplePublicObjectInput
# Eliminar importación que ya no existe en v11.1.0
# from hubspot.crm.objects.models import CollectionResponseSimplePublicObject
from hubspot.crm.objects.models import SimplePublicObject
from hubspot.crm.objects.models import PublicObjectSearchRequest
from hubspot.crm.objects.models import FilterGroup

# Importar desde módulo local si existe
try:
    from ..db import supabase
except ImportError:
    # Fallback para cuando se importa directamente
    try:
        import sys
        import importlib.util
        # Intentar importar usando path absoluto o relativo
        try:
            # Intento 1: Usando importlib
            spec = importlib.util.spec_from_file_location("db", "../db.py")
            db_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(db_module)
            supabase = db_module.supabase
        except (ImportError, FileNotFoundError, AttributeError):
            # Intento 2: Importar directamente si está en sys.path
            sys.path.append("../")
            from db import supabase
    except ImportError:
        supabase = None
        logging.warning("No se pudo importar supabase. Algunas funcionalidades pueden no estar disponibles.")

# Configurar logging
logger = logging.getLogger(__name__)

# Cargar variables de entorno
load_dotenv()

async def get_hubspot_token(user_id: str = None):
    """
    Obtiene el token de acceso de HubSpot.
    Si se proporciona user_id, lo busca en la tabla user_integrations.
    En otro caso, usa un token fijo para pruebas.
    """
    if user_id and supabase:
        try:
            response = supabase.table("user_integrations") \
                .select("config") \
                .eq("user_id", user_id) \
                .eq("provider", "hubspot") \
                .execute()
            
            if response.data and len(response.data) > 0:
                return response.data[0]["config"].get("access_token")
        except Exception as e:
            logger.error(f"Error obteniendo token de HubSpot: {e}")
    
    # Token para pruebas
    return os.getenv("HUBSPOT_TOKEN")

async def buscar_contacto_hubspot(search_query: str, user_id: str = None):
    """
    Busca un contacto en HubSpot por email, nombre u otra propiedad.
    
    Args:
        search_query: Término de búsqueda (email, nombre, etc.)
        user_id: ID del usuario para obtener su token específico
        
    Returns:
        dict: Datos del contacto encontrado o información sobre el error
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
        api_response = hubspot_client.crm.contacts.search_api.do_search(
            public_object_search_request=search_request
        )
        
        if api_response.results and len(api_response.results) > 0:
            # Formatear resultados
            results = []
            for contact in api_response.results:
                contact_data = {
                    "id": contact.id,
                    "properties": contact.properties
                }
                
                # Añadir datos útiles comunes al nivel principal para facilitar acceso
                for key in ["email", "firstname", "lastname", "phone", "company"]:
                    if key in contact.properties:
                        contact_data[key] = contact.properties[key]
                
                results.append(contact_data)
                
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
                "message": "No se encontraron contactos"
            }
        
    except ApiException as e:
        logger.error(f"Error de API HubSpot buscando contacto: {e}")
        return {"error": f"Error de API HubSpot: {str(e)}"}
    
    except Exception as e:
        logger.error(f"Error buscando contacto en HubSpot: {e}")
        return {"error": f"Error: {str(e)}"}

async def crear_contacto_hubspot(firstname: str, email: str, lastname: str = "", phone: str = "", company: str = "", user_id: str = None):
    """
    Crea un nuevo contacto en HubSpot.
    
    Args:
        firstname: Nombre del contacto
        email: Email del contacto
        lastname: Apellido del contacto
        phone: Teléfono del contacto
        company: Empresa del contacto
        user_id: ID del usuario para obtener su token específico
        
    Returns:
        dict: Datos del contacto creado o información sobre el error
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
            "firstname": firstname,
            "email": email
        }
        
        # Añadir propiedades adicionales si están disponibles
        if lastname:
            properties["lastname"] = lastname
        if phone:
            properties["phone"] = phone
        if company:
            properties["company"] = company
        
        # Verificar si el contacto ya existe
        # Buscar por email para evitar duplicados
        search_request = PublicObjectSearchRequest(
            filter_groups=[
                {
                    "filters": [
                        {
                            "property_name": "email",
                            "operator": "EQ",
                            "value": email
                        }
                    ]
                }
            ],
            limit=1
        )
        
        search_response = hubspot_client.crm.contacts.search_api.do_search(
            public_object_search_request=search_request
        )
        
        if search_response.total > 0:
            return {
                "success": False,
                "error": "El contacto ya existe",
                "contact": {
                    "id": search_response.results[0].id,
                    "properties": search_response.results[0].properties
                }
            }
        
        # Crear el contacto
        simple_public_object_input = SimplePublicObjectInput(properties=properties)
        api_response = hubspot_client.crm.contacts.basic_api.create(
            simple_public_object_input=simple_public_object_input
        )
        
        return {
            "success": True,
            "id": api_response.id,
            "properties": api_response.properties
        }
    
    except ApiException as e:
        logger.error(f"Error de API HubSpot creando contacto: {e}")
        return {"error": f"Error de API HubSpot: {str(e)}"}
    
    except Exception as e:
        logger.error(f"Error creando contacto en HubSpot: {e}")
        return {"error": f"Error: {str(e)}"} 