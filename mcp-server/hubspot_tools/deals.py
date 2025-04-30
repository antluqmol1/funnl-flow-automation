"""
Módulo para gestionar deals (oportunidades) en HubSpot.
"""
import logging
import os
from dotenv import load_dotenv
from hubspot import HubSpot
from hubspot.crm.objects.exceptions import ApiException
from hubspot.crm.objects.models import PublicObjectSearchRequest, SimplePublicObjectInput
from typing import Optional
from datetime import datetime

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

async def crear_deal_hubspot(
    dealname: str,
    dealstage: str,
    amount: Optional[str] = None,
    closedate: Optional[str] = None, # Espera formato YYYY-MM-DD
    dealtype: Optional[str] = None,
    description: Optional[str] = None,
    user_id: Optional[str] = None
):
    """
    Crea un nuevo deal en HubSpot en el pipeline de ventas por defecto.

    Args:
        dealname: Nombre del deal (obligatorio).
        dealstage: Nombre de la etapa del deal en español (Visitante, Captado, Cultivado, Demo, Negociación, Ganado, Perdido).
        amount: Monto del deal.
        closedate: Fecha de cierre (formato YYYY-MM-DD).
        dealtype: Tipo de deal (e.g., 'newbusiness', 'existingbusiness').
        description: Descripción del deal.
        user_id: ID del usuario para obtener su token específico.

    Returns:
        dict: Datos del deal creado o error.
    """
    try:
        access_token = await get_hubspot_token(user_id)
        if not access_token:
            return {"error": "No se pudo obtener token de acceso a HubSpot"}

        hubspot_client = HubSpot(access_token=access_token)
        
        # Pipeline fijo por defecto
        default_pipeline_id = "default"
        
        # Mapeo fijo Español -> Inglés (Label HubSpot)
        stage_mapping_es_to_en = {
            "visitante": "Visitor Engaged",
            "captado": "Lead Captured", 
            "cultivado": "Lead Nurtured",
            "demo": "Demo delivered",
            "negociación": "In Negotiation",
            "negociacion": "In Negotiation",
            "ganado": "Deal Won",
            "perdido": "Deal Lost"
        }

        # --- Mapeo de Deal Stage Fijo ---
        hubspot_stage_id = None
        dealstage_lower = dealstage.lower().strip()
        target_english_label = stage_mapping_es_to_en.get(dealstage_lower)

        if not target_english_label:
            error_msg = f"Nombre de etapa en español no válido: '{dealstage}'. Usar uno de: {', '.join(stage_mapping_es_to_en.keys())}"
            logger.error(error_msg)
            return {"error": error_msg, "stage_provided": dealstage}

        try:
            stages_response = hubspot_client.crm.pipelines.pipeline_stages_api.get_all(
                pipeline_id=default_pipeline_id, # Usar pipeline por defecto
                object_type="deals"
            )
            
            if stages_response.results:
                found_stage = False
                for stage in stages_response.results:
                    if stage.label == target_english_label:
                        hubspot_stage_id = stage.id
                        found_stage = True
                        break
                if found_stage:
                     logger.info(f"Etapa mapeada para pipeline '{default_pipeline_id}': {dealstage} -> {target_english_label} -> ID: {hubspot_stage_id}")
                else:
                    # Esto no debería ocurrir si el mapeo es correcto y las etapas existen
                    logger.warning(f"No se encontró la etapa con label '{target_english_label}' en el pipeline '{default_pipeline_id}'. Verifique la configuración de etapas en HubSpot.")
                    # Devolvemos error porque el mapeo falló internamente
                    error_msg = f"No se encontró la etapa HubSpot '{target_english_label}' mapeada desde '{dealstage}'."
                    return {"error": error_msg, "pipeline_checked": default_pipeline_id, "stage_checked": dealstage, "target_label": target_english_label}
            else:
                 logger.warning(f"No se encontraron etapas para el pipeline por defecto '{default_pipeline_id}'.")
                 # Devolvemos error porque no podemos asignar etapa
                 error_msg = f"No se encontraron etapas en el pipeline por defecto '{default_pipeline_id}'."
                 return {"error": error_msg, "pipeline_checked": default_pipeline_id}

        except ApiException as e:
            logger.error(f"Error de API obteniendo etapas del pipeline por defecto '{default_pipeline_id}': {e}")
            return {"error": f"Error de API obteniendo etapas: {str(e)}", "pipeline_checked": default_pipeline_id}
        except Exception as e:
            logger.error(f"Error inesperado obteniendo etapas del pipeline por defecto '{default_pipeline_id}': {e}", exc_info=True)
            return {"error": f"Error inesperado obteniendo etapas: {str(e)}", "pipeline_checked": default_pipeline_id}
        # --- Fin Mapeo Deal Stage Fijo ---
        
        # --- Validación de Etapa Mapeada (Redundante con lógica anterior, pero por seguridad) ---
        if not hubspot_stage_id:
            error_msg = f"No se pudo mapear la etapa '{dealstage}' a un ID válido para el pipeline '{default_pipeline_id}'. Verifica los nombres."
            logger.error(error_msg)
            return {"error": error_msg, "pipeline_checked": default_pipeline_id, "stage_checked": dealstage}
        # --- Fin Validación ---
            
        properties = {
            "dealname": dealname,
            "pipeline": default_pipeline_id # Usar pipeline por defecto
        }

        if hubspot_stage_id:
            properties["dealstage"] = hubspot_stage_id
        else:
            # Si no pudimos mapear, enviamos el nombre tal cual, puede que funcione o falle
            properties["dealstage"] = dealstage 
            logger.warning(f"No se pudo mapear la etapa '{dealstage}'. Se enviará el nombre directamente.")

        if amount is not None:
            properties["amount"] = str(amount) # Asegurar que sea string
        if closedate:
            try:
                # Validar y formatear fecha YYYY-MM-DD
                datetime.strptime(closedate, '%Y-%m-%d')
                properties["closedate"] = closedate
            except ValueError:
                logger.warning(f"Formato de fecha de cierre inválido: {closedate}. Se omitirá.")
        if dealtype:
            properties["dealtype"] = dealtype
        if description:
            properties["description"] = description

        simple_public_object_input = SimplePublicObjectInput(properties=properties)

        api_response = hubspot_client.crm.deals.basic_api.create(
            simple_public_object_input_for_create=simple_public_object_input
        )
        
        # Podríamos añadir lógica para asociaciones aquí si fuera necesario
        
        # Actualizar deal en Supabase si existe localmente (opcional)
        # ...

        return {
            "success": True,
            "id": api_response.id,
            "properties": api_response.properties
        }

    except ApiException as e:
        logger.error(f"Error de API HubSpot creando deal: {e}")
        return {"error": f"Error de API HubSpot: {str(e)}", "details": str(e.response.text if e.response else '')}
    except Exception as e:
        logger.error(f"Error creando deal en HubSpot: {e}", exc_info=True)
        return {"error": f"Error inesperado: {str(e)}"}

async def actualizar_deal_hubspot(
    deal_id: str,
    amount: Optional[str] = None,
    closedate: Optional[str] = None, # Espera formato YYYY-MM-DD
    deal_currency_code: Optional[str] = None,
    dealname: Optional[str] = None,
    dealstage: Optional[str] = None, # Nombre en español
    dealtype: Optional[str] = None,
    description: Optional[str] = None,
    user_id: Optional[str] = None
):
    """
    Actualiza un deal existente en HubSpot en el pipeline de ventas por defecto.

    Args:
        deal_id: ID del deal en HubSpot a actualizar (obligatorio).
        amount: Nuevo monto del deal.
        closedate: Nueva fecha de cierre (formato YYYY-MM-DD).
        deal_currency_code: Nuevo código de moneda.
        dealname: Nuevo nombre del deal.
        dealstage: Nuevo nombre de la etapa del deal en español (Visitante, Captado, ...).
        dealtype: Nuevo tipo de deal.
        description: Nueva descripción.
        user_id: ID del usuario para obtener su token específico.

    Returns:
        dict: Información del deal actualizado o error.
    """
    try:
        access_token = await get_hubspot_token(user_id)
        if not access_token:
            return {"error": "No se pudo obtener token de acceso a HubSpot"}

        hubspot_client = HubSpot(access_token=access_token)
        
        properties_to_update = {}
        hubspot_stage_id = None
        
        # Pipeline fijo por defecto
        default_pipeline_id = "default"
        
        # Mapeo fijo Español -> Inglés (Label HubSpot)
        stage_mapping_es_to_en = {
            "visitante": "Visitor Engaged",
            "captado": "Lead Captured", 
            "cultivado": "Lead Nurtured",
            "demo": "Demo delivered",
            "negociación": "In Negotiation",
            "negociacion": "In Negotiation",
            "ganado": "Deal Won",
            "perdido": "Deal Lost"
        }

        # Mapear dealstage si se proporciona
        if dealstage: 
            dealstage_lower = dealstage.lower().strip()
            target_english_label = stage_mapping_es_to_en.get(dealstage_lower)
            
            if not target_english_label:
                error_msg = f"Nombre de etapa en español no válido al actualizar: '{dealstage}'. Usar uno de: {', '.join(stage_mapping_es_to_en.keys())}"
                logger.error(error_msg)
                return {"error": error_msg, "stage_provided": dealstage}

            # --- Mapeo de Deal Stage Fijo (similar a create) ---
            try:
                stages_response = hubspot_client.crm.pipelines.pipeline_stages_api.get_all(
                    pipeline_id=default_pipeline_id, 
                    object_type="deals"
                )
                if stages_response.results:
                    found_stage = False
                    for stage in stages_response.results:
                        if stage.label == target_english_label:
                            hubspot_stage_id = stage.id
                            found_stage = True
                            break
                    if found_stage:
                         logger.info(f"Etapa mapeada para pipeline '{default_pipeline_id}': {dealstage} -> {target_english_label} -> ID: {hubspot_stage_id}")
                         properties_to_update["dealstage"] = hubspot_stage_id
                    else:
                        logger.warning(f"No se encontró la etapa con label '{target_english_label}' en el pipeline '{default_pipeline_id}' al actualizar. La etapa no será actualizada.")
                        # Podríamos devolver error o solo advertir. Advierto y no actualizo.
                else:
                     logger.warning(f"No se encontraron etapas para el pipeline por defecto '{default_pipeline_id}' al actualizar. La etapa no será actualizada.")
            except Exception as e:
                logger.warning(f"Error mapeando dealstage '{dealstage}' para pipeline '{default_pipeline_id}' al actualizar: {e}")
            # --- Fin Mapeo Deal Stage Fijo ---
             
        # Añadir otras propiedades si se proporcionan
        if amount is not None:
            properties_to_update["amount"] = str(amount)
        if closedate:
            try:
                datetime.strptime(closedate, '%Y-%m-%d')
                properties_to_update["closedate"] = closedate
            except ValueError:
                logger.warning(f"Formato de fecha de cierre inválido: {closedate}. Se omitirá.")
        if deal_currency_code:
            properties_to_update["deal_currency_code"] = deal_currency_code
        if dealname:
            properties_to_update["dealname"] = dealname
        if dealtype:
            properties_to_update["dealtype"] = dealtype
        if description:
            properties_to_update["description"] = description

        # --- Validación de Etapa para Actualización (Opcional, si queremos forzar que exista) ---
        # if dealstage and not properties_to_update.get("dealstage"):
        #     # Si se proporcionó dealstage pero no se pudo mapear a un ID
        #    error_msg = f"No se pudo mapear la etapa '{dealstage}' a un ID válido para el pipeline por defecto. La etapa no será actualizada."
        #    logger.error(error_msg)
        #    return {"error": error_msg, "pipeline_checked": default_pipeline_id, "stage_checked": dealstage}
        # --- Fin Validación Opcional ---
            
        if not properties_to_update:
            return {"success": False, "message": "No se proporcionaron propiedades válidas para actualizar."}

        simple_public_object_input = SimplePublicObjectInput(properties=properties_to_update)

        api_response = hubspot_client.crm.deals.basic_api.update(
            deal_id=deal_id,
            simple_public_object_input=simple_public_object_input
        )

        return {
            "success": True,
            "id": api_response.id,
            "properties": api_response.properties
        }

    except ApiException as e:
        logger.error(f"Error de API HubSpot actualizando deal: {e}")
        return {"error": f"Error de API HubSpot: {str(e)}", "details": str(e.response.text if e.response else '')}
    except Exception as e:
        logger.error(f"Error actualizando deal en HubSpot: {e}", exc_info=True)
        return {"error": f"Error inesperado: {str(e)}"}


# --- FIN NUEVAS FUNCIONES --- 