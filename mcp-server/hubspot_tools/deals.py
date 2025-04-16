"""
Módulo para gestionar deals (oportunidades) en HubSpot.
"""
import logging
import os
from dotenv import load_dotenv
from hubspot import HubSpot
from hubspot.crm.objects.exceptions import ApiException
from hubspot.crm.objects.models import PublicObjectSearchRequest, SimplePublicObjectInput

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

async def crear_deal_hubspot(deal_data, user_id: str = None):
    """
    Crea un nuevo deal en HubSpot.
    
    Args:
        deal_data: Diccionario con datos del deal a crear
        user_id: ID del usuario para obtener su token específico
        
    Returns:
        dict: Datos del deal creado o error
    """
    try:
        # Obtener token
        access_token = await get_hubspot_token(user_id)
        if not access_token:
            return {"error": "No se pudo obtener token de acceso a HubSpot"}
        
        # Inicializar cliente
        hubspot_client = HubSpot(access_token=access_token)
        
        # Obtener etapa local para intentar mapearla a HubSpot
        stage_id = deal_data.get("stage_id")
        stage_name = None
        stage_position = None
        
        if stage_id:
            try:
                from db import supabase
                stage_response = supabase.table("pipeline_stages").select("name, position").eq("id", stage_id).maybe_single().execute()
                if stage_response.data:
                    stage_name = stage_response.data.get("name")
                    stage_position = stage_response.data.get("position")
                    logger.info(f"Etapa local encontrada: {stage_name} (posición {stage_position})")
            except Exception as e:
                logger.warning(f"Error obteniendo información de la etapa local: {e}")
        
        # Obtener opciones válidas de pipeline stages
        hubspot_stage_id = None
        stage_mapping = {
            # Mapeo entre etapas locales y HubSpot
            "visitante": "Visitor Engaged",
            "captado": "Lead Captured",
            "cultivado": "Lead Nurtured",
            "demo": "Demo Delivered",
            "negociación": "In Negotiation",
            "ganado": "Deal Won",
            "perdido": "Deal Lost"
        }
        
        try:
            # Obtenemos las etapas disponibles en HubSpot
            stages_response = hubspot_client.crm.pipelines.pipeline_stages_api.get_all(
                pipeline_id="default",
                object_type="deals"
            )
            
            # Registramos todas las etapas disponibles para referencia
            all_hubspot_stages = []
            if stages_response.results and len(stages_response.results) > 0:
                # Por defecto, usamos la primera etapa
                hubspot_stage_id = stages_response.results[0].id
                logger.info(f"ID de etapa predeterminada obtenido: {hubspot_stage_id}")
                
                for stage in stages_response.results:
                    all_hubspot_stages.append({
                        "id": stage.id,
                        "label": stage.label,
                        "displayOrder": getattr(stage, "display_order", 0)
                    })
                    logger.info(f"Etapa disponible: {stage.label} (ID: {stage.id}, Orden: {getattr(stage, 'display_order', 0)})")
                
                # Intentar mapear por nombre si tenemos el nombre de la etapa local
                if stage_name:
                    # Normalizar a minúsculas sin espacios para comparación
                    normalized_stage_name = stage_name.lower().replace(" ", "")
                    
                    # Buscar en el mapeo predefinido
                    if normalized_stage_name in stage_mapping:
                        hubspot_stage_key = stage_mapping[normalized_stage_name]
                        # Buscar esta etapa en los resultados de HubSpot por label (no por ID)
                        for stage in stages_response.results:
                            if stage.label == hubspot_stage_key:
                                hubspot_stage_id = stage.id
                                logger.info(f"Etapa mapeada por nombre exacto: {stage.label} (ID: {hubspot_stage_id})")
                                break
                                
                        # Si no encontramos coincidencia exacta, buscar por substring
                        if not hubspot_stage_id or hubspot_stage_id == stages_response.results[0].id:
                            for stage in stages_response.results:
                                if hubspot_stage_key.lower() in stage.label.lower():
                                    hubspot_stage_id = stage.id
                                    logger.info(f"Etapa mapeada por nombre parcial: {stage.label} (ID: {hubspot_stage_id})")
                                    break
            
            # Si no se encontró en el mapeo, buscar coincidencia directa o por posición
            if not hubspot_stage_id or hubspot_stage_id == stages_response.results[0].id:
                # Intentar buscar coincidencia directa por nombre
                for stage in stages_response.results:
                    if stage.label.lower().replace(" ", "") == normalized_stage_name:
                        hubspot_stage_id = stage.id
                        logger.info(f"Etapa mapeada directamente: {stage.label} (ID: {hubspot_stage_id})")
                        break
                
                # Si aún no hay coincidencia y tenemos la posición, mapear por orden
                if (not hubspot_stage_id or hubspot_stage_id == stages_response.results[0].id) and stage_position is not None:
                    # Ordenar etapas de HubSpot por displayOrder
                    ordered_stages = sorted(all_hubspot_stages, key=lambda x: x["displayOrder"])
                    # Ajustar la posición a los límites del array
                    adjusted_position = min(stage_position - 1, len(ordered_stages) - 1)
                    if adjusted_position >= 0 and adjusted_position < len(ordered_stages):
                        hubspot_stage_id = ordered_stages[adjusted_position]["id"]
                        logger.info(f"Etapa mapeada por posición: {ordered_stages[adjusted_position]['label']} (ID: {hubspot_stage_id})")
            
            # Si es la etapa "Ganado", usar Deal Won
            if stage_name and "ganado" in stage_name.lower():
                for stage in stages_response.results:
                    if stage.label == "Deal Won":
                        hubspot_stage_id = stage.id
                        logger.info(f"Etapa mapeada a Ganado/Deal Won: {stage.label} (ID: {hubspot_stage_id})")
                        break
            
            # Si es la etapa "Perdido", usar Deal Lost
            if stage_name and "perdido" in stage_name.lower():
                for stage in stages_response.results:
                    if stage.label == "Deal Lost":
                        hubspot_stage_id = stage.id
                        logger.info(f"Etapa mapeada a Perdido/Deal Lost: {stage.label} (ID: {hubspot_stage_id})")
                        break
        except Exception as e:
            logger.warning(f"Error obteniendo etapas de pipeline: {e}")
            # Si no podemos obtener las etapas, asignamos un valor predeterminado
            hubspot_stage_id = None  # No asignar valor por defecto, se configurará al crear el deal en HubSpot
            logger.info("No se pudo obtener lista de etapas de HubSpot. Se usará la etapa predeterminada de HubSpot.")
        
        # Mapear propiedades del deal de Supabase a formato HubSpot
        properties = {
            "dealname": deal_data.get("title", "Deal sin título"),
            "description": deal_data.get("description", ""),
            "amount": str(deal_data.get("value", 0)) if deal_data.get("value") is not None else "0",
            "pipeline": "default",  # Pipeline predeterminado
        }
        
        # Usar ID de stage válido que obtuvimos o el valor predeterminado
        if hubspot_stage_id:
            properties["dealstage"] = hubspot_stage_id
            logger.info(f"Asignando etapa en HubSpot: {hubspot_stage_id}")
        
        # Formatear fecha de cierre esperada si existe
        if deal_data.get("expected_close_date"):
            try:
                # Formatear la fecha al formato requerido por HubSpot (YYYY-MM-DD)
                from datetime import datetime
                close_date = deal_data.get("expected_close_date")
                # Si es un string, intentar convertirlo a fecha
                if isinstance(close_date, str):
                    close_date = datetime.strptime(close_date, "%Y-%m-%d").date()
                properties["closedate"] = close_date.strftime("%Y-%m-%d")
            except Exception as e:
                logger.warning(f"Error formateando fecha de cierre: {e}")
                # No incluir la fecha si hay error
        
        # Crear objeto de entrada para HubSpot
        simple_public_object_input = SimplePublicObjectInput(properties=properties)
        
        # Crear deal en HubSpot
        api_response = hubspot_client.crm.deals.basic_api.create(
            simple_public_object_input_for_create=simple_public_object_input
        )
        
        # Una vez creado el deal, podemos asociar contactos o empresas si es necesario
        hubspot_deal_id = api_response.id
        
        # Asociar contacto si hay contact_id
        if deal_data.get("contact_id"):
            try:
                # Obtener el hubspot_id del contacto desde la BD
                from db import supabase
                contact_response = supabase.table("contacts").select("hubspot_id").eq("id", deal_data["contact_id"]).maybe_single().execute()
                
                if contact_response.data and contact_response.data.get("hubspot_id"):
                    hubspot_contact_id = contact_response.data["hubspot_id"]
                    
                    # Asociar contacto con deal
                    hubspot_client.crm.deals.associations_api.create(
                        deal_id=hubspot_deal_id,
                        to_object_type="contacts",
                        to_object_id=hubspot_contact_id,
                        association_type="deal_to_contact"
                    )
                    logger.info(f"Contacto {hubspot_contact_id} asociado al deal {hubspot_deal_id} en HubSpot")
            except Exception as e:
                logger.warning(f"Error al asociar contacto al deal en HubSpot: {e}")
        
        # Si hay una empresa, buscarla en HubSpot o crearla
        if deal_data.get("company"):
            try:
                # Si tenemos el ID de HubSpot de la empresa, usarlo directamente
                hubspot_company_id = deal_data.get("hubspot_company_id")
                company_name = deal_data.get("company")
                
                # Si no tenemos el ID de HubSpot, buscarlo por nombre
                if not hubspot_company_id:
                    logger.info(f"Buscando empresa '{company_name}' en HubSpot...")
                    
                    # Método 1: Búsqueda exacta por nombre
                    search_response = hubspot_client.crm.companies.search_api.do_search(
                        public_object_search_request=PublicObjectSearchRequest(
                            filter_groups=[
                                {
                                    "filters": [
                                        {
                                            "propertyName": "name",
                                            "operator": "EQ",
                                            "value": company_name
                                        }
                                    ]
                                }
                            ],
                            properties=["name", "domain"],
                            limit=5
                        )
                    )
                    
                    # Si hay resultados, usar el primero
                    if search_response.results and len(search_response.results) > 0:
                        hubspot_company_id = search_response.results[0].id
                        logger.info(f"Empresa encontrada en HubSpot (búsqueda exacta): {company_name} (ID: {hubspot_company_id})")
                    else:
                        # Método 2: Búsqueda parcial con CONTAINS_TOKEN
                        try:
                            search_response = hubspot_client.crm.companies.search_api.do_search(
                                public_object_search_request=PublicObjectSearchRequest(
                                    filter_groups=[
                                        {
                                            "filters": [
                                                {
                                                    "propertyName": "name",
                                                    "operator": "CONTAINS_TOKEN",
                                                    "value": company_name
                                                }
                                            ]
                                        }
                                    ],
                                    properties=["name", "domain"],
                                    limit=5
                                )
                            )
                            
                            # Si hay resultados, comparar nombres para encontrar la mejor coincidencia
                            if search_response.results and len(search_response.results) > 0:
                                # Normalizar el nombre para comparación
                                normalized_name = company_name.lower().strip()
                                
                                for company in search_response.results:
                                    result_name = company.properties.get("name", "").lower().strip()
                                    # Si los nombres son muy similares, usar esta empresa
                                    if normalized_name == result_name or (
                                       normalized_name in result_name or result_name in normalized_name):
                                        hubspot_company_id = company.id
                                        logger.info(f"Empresa encontrada en HubSpot (búsqueda parcial): {company.properties.get('name')} (ID: {hubspot_company_id})")
                                        break
                        except Exception as search_error:
                            logger.warning(f"Error en búsqueda parcial de empresa: {search_error}")
                    
                    # Si aún no se encontró, crear la empresa
                    if not hubspot_company_id:
                        logger.info(f"No se encontró la empresa '{company_name}' en HubSpot. Creando...")
                        
                        # Verificar si la empresa ya existe localmente y tiene un hubspot_id
                        try:
                            from db import supabase
                            company_response = supabase.table("contacts").select("hubspot_id").eq("company", company_name).execute()
                            
                            if company_response.data and len(company_response.data) > 0:
                                for contact in company_response.data:
                                    if contact.get("hubspot_id"):
                                        # Intentar obtener la empresa asociada a este contacto
                                        try:
                                            contact_hubspot_id = contact.get("hubspot_id")
                                            associations_response = hubspot_client.crm.contacts.associations_api.get_all(
                                                contact_id=contact_hubspot_id,
                                                to_object_type="companies"
                                            )
                                            
                                            if associations_response.results and len(associations_response.results) > 0:
                                                hubspot_company_id = associations_response.results[0].id
                                                logger.info(f"Empresa encontrada a través de contacto: ID {hubspot_company_id}")
                                                break
                                        except Exception as assoc_error:
                                            logger.warning(f"Error buscando asociaciones de contacto: {assoc_error}")
                        except Exception as db_error:
                            logger.warning(f"Error buscando empresa en base de datos local: {db_error}")
                        
                        # Si todavía no se encontró, crear la empresa
                        if not hubspot_company_id:
                            try:
                                create_company_response = hubspot_client.crm.companies.basic_api.create(
                                    simple_public_object_input=SimplePublicObjectInput(
                                        properties={
                                            "name": company_name
                                        }
                                    )
                                )
                                hubspot_company_id = create_company_response.id
                                logger.info(f"Empresa creada en HubSpot: {company_name} (ID: {hubspot_company_id})")
                            except Exception as create_error:
                                logger.error(f"Error creando empresa en HubSpot: {create_error}")
                else:
                    logger.info(f"Usando hubspot_company_id proporcionado: {hubspot_company_id}")
                
                # Asociar la empresa con el deal
                if hubspot_company_id:
                    try:
                        hubspot_client.crm.deals.associations_api.create(
                            deal_id=hubspot_deal_id,
                            to_object_type="companies",
                            to_object_id=hubspot_company_id,
                            association_type="deal_to_company"
                        )
                        logger.info(f"Empresa {hubspot_company_id} asociada al deal {hubspot_deal_id} en HubSpot")
                    except Exception as assoc_error:
                        logger.error(f"Error al asociar empresa al deal: {assoc_error}")
                else:
                    logger.warning(f"No se pudo encontrar ni crear la empresa '{company_name}' en HubSpot")
            except Exception as e:
                logger.error(f"Error al procesar empresa para deal: {e}")
        
        # Actualizar el deal en Supabase con el ID de HubSpot
        try:
            from db import supabase
            update_response = supabase.table("deals").update({
                "hubspot_id": hubspot_deal_id,
                "hubspot_type": "deal"
            }).eq("id", deal_data["id"]).execute()
            
            logger.info(f"Deal {deal_data['id']} actualizado con hubspot_id {hubspot_deal_id}")
        except Exception as e:
            logger.error(f"Error actualizando deal con hubspot_id: {e}")
            # Continuamos a pesar del error, ya que el deal se creó correctamente en HubSpot
        
        return {
            "success": True,
            "id": api_response.id,
            "properties": api_response.properties
        }
    
    except ApiException as e:
        logger.error(f"Error de API HubSpot creando deal: {e}")
        return {"error": f"Error de API HubSpot: {str(e)}"}
    
    except Exception as e:
        logger.error(f"Error creando deal en HubSpot: {e}")
        return {"error": f"Error: {str(e)}"} 