"""
Router para manejar los endpoints relacionados con HubSpot.
"""
from fastapi import APIRouter, HTTPException, Header, Request, Response, status, Depends
from typing import Dict, Any, Optional
from pydantic import BaseModel
try:
    from hubspot_tools.sync import hubspot_sync, hubspot_cache
    from hubspot_tools.utils import verify_webhook_signature, log_webhook_event, log_sync_operation, format_error_response
    # Importar función de contactos
    try:
        from hubspot_tools.contacts import buscar_contacto_hubspot as search_hubspot_contact
    except ImportError:
        from hubspot_tools.contacts import search_hubspot_contact
    from hubspot_tools.deals import buscar_deal_hubspot
except ImportError as e:
    import logging
    logging.error(f"Error importando módulos de hubspot_tools local: {e}")

import httpx
import os
import logging
from dotenv import load_dotenv
from supabase import create_client, Client
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import RedirectResponse
import secrets
from datetime import datetime, timedelta

# No necesitamos importar estas bibliotecas aquí, ya se usan dentro de hubspot_tools
# Evitamos importaciones de la biblioteca original para prevenir conflictos

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

router = APIRouter(prefix="/hubspot", tags=["hubspot"])
security = HTTPBearer()

# Configuración de Supabase
supabase: Client = create_client(
    os.getenv("SUPABASE_URL", ""),
    os.getenv("SUPABASE_SERVICE_KEY", "")
)

# Configuración de HubSpot OAuth
HUBSPOT_CLIENT_ID = os.getenv("HUBSPOT_CLIENT_ID")
HUBSPOT_CLIENT_SECRET = os.getenv("HUBSPOT_CLIENT_SECRET")
HUBSPOT_APP_ID = os.getenv("HUBSPOT_APP_ID")
HUBSPOT_SCOPE = os.getenv("HUBSPOT_SCOPE", "contacts timeline")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:8080")

if not all([HUBSPOT_CLIENT_ID, HUBSPOT_CLIENT_SECRET, HUBSPOT_APP_ID, HUBSPOT_SCOPE]):
    logger.warning("Falta configuración de HubSpot OAuth")
    for key in ["HUBSPOT_CLIENT_ID", "HUBSPOT_CLIENT_SECRET", "HUBSPOT_APP_ID", "HUBSPOT_SCOPE"]:
        if not os.getenv(key):
            logger.warning(f"Falta la variable de entorno: {key}")

# Almacenamiento temporal de estados OAuth
oauth_states = {}

async def get_user_api_key(user_id: str) -> Optional[str]:
    """
    Obtiene la API key de HubSpot de un usuario desde Supabase.
    """
    try:
        response = supabase.table("user_integrations").select("config").eq("user_id", user_id).eq("provider", "hubspot").execute()
        if response.data and len(response.data) > 0:
            return response.data[0]["config"].get("apiKey")
    except Exception as e:
        log_sync_operation("get_api_key", "user", user_id, success=False, error=str(e))
    return None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """
    Obtiene el ID del usuario actual desde el token JWT.
    """
    try:
        # Verificar el token con Supabase
        response = supabase.auth.get_user(credentials.credentials)
        return response.user.id
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado"
        )

class SyncRequest(BaseModel):
    """Modelo para solicitudes de sincronización"""
    id: str
    type: str
    force: bool = False

class WebhookEvent(BaseModel):
    """Modelo para eventos de webhook de HubSpot"""
    eventId: str
    subscriptionId: str
    portalId: int
    appId: int
    occurredAt: int
    subscriptionType: str
    attemptNumber: int
    objectId: int
    changeSource: str
    changeFlag: str

class VerifyApiKeyRequest(BaseModel):
    """Modelo para verificar API key de HubSpot"""
    apiKey: str

class SearchRequest(BaseModel):
    """Modelo para solicitudes de búsqueda en HubSpot"""
    type: str  # 'deal', 'contact', 'ticket', 'company'
    query: str  # Término de búsqueda

@router.post("/verify")
async def verify_api_key(
    request: VerifyApiKeyRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Verifica si una API key de HubSpot es válida.
    """
    try:
        # Intentar hacer una llamada a la API de HubSpot para verificar la key
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.hubapi.com/crm/v3/objects/contacts",
                headers={
                    "Authorization": f"Bearer {request.apiKey}",
                    "Content-Type": "application/json",
                },
                params={"limit": 1}  # Solo necesitamos verificar la autenticación
            )

            if response.status_code == 401:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="API Key inválida"
                )
            elif response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Error verificando API Key"
                )

            # Si la verificación es exitosa, actualizar la API key en el sincronizador
            await hubspot_sync.set_api_key(user_id, request.apiKey)
            
            return {"status": "success", "message": "API Key válida"}
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error de conexión: {str(e)}"
        )

@router.post("/webhook")
async def hubspot_webhook(
    request: Request,
    event: WebhookEvent,
    response: Response,
    x_hubspot_signature: Optional[str] = Header(None)
):
    """
    Endpoint para recibir webhooks de HubSpot.
    Verifica la firma del webhook y procesa el evento.
    """
    # Obtener el cuerpo del request en bytes para verificar la firma
    body = await request.body()
    
    # Verificar que el App ID coincida
    if HUBSPOT_APP_ID and str(event.appId) != HUBSPOT_APP_ID:
        response.status_code = status.HTTP_401_UNAUTHORIZED
        return {"error": "App ID inválido"}
    
    # Verificar la firma del webhook
    if not x_hubspot_signature or not verify_webhook_signature(x_hubspot_signature, body):
        response.status_code = status.HTTP_401_UNAUTHORIZED
        return {"error": "Firma inválida o no proporcionada"}

    try:
        # Registrar el evento en el log
        log_webhook_event(event.subscriptionType, event.dict())
        
        # Procesar el evento
        await hubspot_sync.handle_webhook(event.subscriptionType, event.dict())
        
        return {
            "status": "success",
            "message": f"Webhook procesado: {event.subscriptionType}",
            "eventId": event.eventId
        }
    except Exception as e:
        log_sync_operation(
            "webhook_process",
            event.subscriptionType,
            str(event.objectId),
            success=False,
            error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=format_error_response(e)
        )

@router.post("/sync")
async def sync_hubspot_object(
    request: SyncRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Sincroniza un objeto específico de HubSpot.
    """
    try:
        # Obtener la API key del usuario
        api_key = await get_user_api_key(user_id)
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="HubSpot no está configurado para este usuario"
            )

        # Asegurarse de que la API key esté configurada en el sincronizador
        await hubspot_sync.set_api_key(user_id, api_key)

        result = None
        if request.type == "contact":
            result = await hubspot_sync.sync_contact(user_id, request.id, request.force)
        elif request.type == "deal":
            result = await hubspot_sync.sync_deal(user_id, request.id, request.force)
        elif request.type == "ticket":
            result = await hubspot_sync.sync_ticket(user_id, request.id, request.force)
        elif request.type == "company":
            result = await hubspot_sync.sync_company(user_id, request.id, request.force)
        else:
            raise ValueError(f"Tipo de objeto inválido: {request.type}")

        if result.get("error"):
            raise Exception(result["error"])

        # Registrar operación exitosa
        log_sync_operation("sync", request.type, request.id, success=True)
        
        return {
            "status": "success",
            "data": result,
            "metadata": {
                "type": request.type,
                "id": request.id,
                "forced": request.force
            }
        }
    except Exception as e:
        # Registrar operación fallida
        log_sync_operation("sync", request.type, request.id, success=False, error=str(e))
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=format_error_response(e)
        )

@router.delete("/cache/{key}")
async def invalidate_cache(
    key: str,
    user_id: str = Depends(get_current_user)
):
    """
    Invalida una entrada específica del caché.
    """
    try:
        # Solo permitir invalidar el caché del propio usuario
        if not key.startswith(f"{user_id}_"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para invalidar este caché"
            )

        await hubspot_cache.invalidate(key)
        log_sync_operation("cache_invalidate", "cache", key, success=True)
        
        return {
            "status": "success",
            "message": f"Caché invalidado para la clave: {key}"
        }
    except Exception as e:
        log_sync_operation("cache_invalidate", "cache", key, success=False, error=str(e))
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=format_error_response(e)
        )

@router.delete("/cache")
async def clear_cache(user_id: str = Depends(get_current_user)):
    """
    Limpia todo el caché de HubSpot.
    """
    try:
        # Por ahora, permitimos que cada usuario limpie todo el caché
        # En una implementación más segura, deberíamos limpiar solo el caché del usuario
        await hubspot_cache.clear()
        log_sync_operation("cache_clear", "cache", "all", success=True)
        
        return {
            "status": "success",
            "message": "Caché limpiado completamente"
        }
    except Exception as e:
        log_sync_operation("cache_clear", "cache", "all", success=False, error=str(e))
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=format_error_response(e)
        )

@router.get("/status")
async def get_hubspot_status(user_id: str = Depends(get_current_user)):
    """
    Obtiene el estado de la conexión con HubSpot para el usuario actual.
    """
    logger.info(f"Verificando estado de HubSpot para usuario: {user_id}")
    try:
        api_key = await get_user_api_key(user_id)
        if not api_key:
            logger.info(f"No se encontró API key para usuario: {user_id}")
            return {"connected": False, "message": "No hay conexión con HubSpot"}

        # Verificar si la API key es válida
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.hubapi.com/crm/v3/objects/contacts",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                params={"limit": 1}
            )
            
            logger.info(f"Respuesta de HubSpot: {response.status_code}")
            
            # Ser más estrictos: solo 200 OK significa conexión válida
            if response.status_code == 200:
                 return {"connected": True, "message": "Conectado a HubSpot"}
            elif response.status_code == 401:
                return {"connected": False, "message": "Token expirado o inválido"}
            else:
                 # Cualquier otro código se considera no conectado o con error
                return {"connected": False, "message": f"Error al verificar conexión: {response.status_code}"}

    except Exception as e:
        logger.error(f"Error al verificar estado de HubSpot: {str(e)}")
        return {"connected": False, "message": f"Error: {str(e)}"}

@router.get("/auth")
async def start_oauth(user_id: str = Depends(get_current_user)):
    """
    Inicia el proceso de OAuth con HubSpot.
    """
    logger.info(f"Iniciando OAuth para usuario: {user_id}")
    
    # Generar estado aleatorio para seguridad
    state = secrets.token_urlsafe(32)
    oauth_states[state] = user_id
    
    logger.info(f"Estado OAuth generado: {state[:8]}...")

    # Construir URL de autorización
    auth_url = (
        "https://app.hubspot.com/oauth/authorize"
        f"?client_id={HUBSPOT_CLIENT_ID}"
        f"&scope={HUBSPOT_SCOPE}"
        f"&state={state}"
        f"&redirect_uri={FRONTEND_URL}/api/auth/hubspot/callback"
    )
    
    logger.info(f"URL de autorización generada: {auth_url[:100]}...")
    
    return {"auth_url": auth_url}

@router.get("/callback")
async def oauth_callback(
    code: str,
    state: str,
    error: Optional[str] = None,
):
    """
    Maneja el callback de OAuth de HubSpot.
    """
    logger.info(f"Recibido callback OAuth - State: {state[:8]}...")
    
    if error:
        logger.error(f"Error en callback OAuth: {error}")
        # Codificar el error para la URL
        import urllib.parse
        encoded_error = urllib.parse.quote(error)
        return RedirectResponse(
            url=f"{FRONTEND_URL}/?hubspot_error={encoded_error}"
        )

    if state not in oauth_states:
        logger.error(f"Estado OAuth no encontrado: {state[:8]}...")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/?hubspot_error=invalid_state"
        )

    user_id = oauth_states.pop(state)
    logger.info(f"Usuario identificado: {user_id}")

    try:
        logger.info("Intercambiando código por token...")
        # Intercambiar código por token
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://api.hubapi.com/oauth/v1/token",
                data={
                    "grant_type": "authorization_code",
                    "client_id": HUBSPOT_CLIENT_ID,
                    "client_secret": HUBSPOT_CLIENT_SECRET,
                    "redirect_uri": f"{FRONTEND_URL}/api/auth/hubspot/callback", # Asegúrate que esta es la URI registrada en HubSpot
                    "code": code
                }
            )

        logger.info(f"Respuesta de token: {token_response.status_code}")
        token_response.raise_for_status() # Lanza HTTPStatusError si no es 2xx
        
        data = token_response.json()
        access_token = data["access_token"]
        # refresh_token = data.get("refresh_token") # Importante guardar también el refresh token
        # expires_in = data.get("expires_in")
            
        logger.info("Token obtenido correctamente")

        # Definir la configuración de integración con el token obtenido
        integration_config = {
            "apiKey": access_token,
            # "refreshToken": refresh_token, 
            # "expiresAt": datetime.now() + timedelta(seconds=expires_in) # Calcular expiración
        }

        try:
            # Guardar/Actualizar token en Supabase
            logger.info(f"Verificando si ya existe integración para usuario: {user_id}")
            try:
                result = supabase.table("user_integrations").select("id, config").eq("user_id", user_id).eq("provider", "hubspot").maybe_single().execute()
                
                # Verificar si result tiene datos
                if result and hasattr(result, 'data') and result.data:
                    # Actualizar token existente
                    logger.info("Actualizando token existente")
                    integration_id = result.data["id"]
                    # Preservar otra configuración si existe
                    existing_config = result.data.get("config", {})
                    existing_config.update(integration_config)
                    supabase.table("user_integrations").update({
                        "config": existing_config
                    }).eq("id", integration_id).execute()
                else:
                    # Si no tiene datos o result es None, crear nueva integración
                    logger.info("Creando nueva integración (no se encontró existente)")
                    supabase.table("user_integrations").insert({
                        "user_id": user_id,
                        "provider": "hubspot",
                        "config": integration_config
                    }).execute()
            except Exception as db_error:
                logger.error(f"Error al consultar o actualizar base de datos: {db_error}")
                # Si hay un error en la consulta, intentamos crear una nueva entrada
                logger.info("Intentando crear nueva integración después de error")
                supabase.table("user_integrations").insert({
                    "user_id": user_id,
                    "provider": "hubspot",
                    "config": integration_config
                }).execute()

            logger.info("Token guardado correctamente en base de datos")

            # Verificar si hubspot_sync está disponible antes de usarlo
            try:
                if hubspot_sync:
                    # Actualizar token en el sincronizador
                    await hubspot_sync.set_api_key(user_id, access_token)
            except Exception as e:
                logger.warning(f"No se pudo actualizar el token en el sincronizador: {e}")
                # Continuar a pesar del error ya que el token se guardó en la base de datos
            
            # Redirigir a la página principal en lugar de /dashboard
            redirect_url = f"{FRONTEND_URL}/?hubspot=success"
            
        except Exception as e:
            logger.error(f"Error inesperado en proceso de OAuth callback: {e}")
            # Redirigir a la página de error con mensaje de error
            redirect_url = f"{FRONTEND_URL}/?hubspot=error&message={str(e)}"

        return RedirectResponse(url=redirect_url)

    except httpx.HTTPStatusError as e:
        # Error específico al obtener el token de HubSpot
        error_detail = "token_exchange_failed"
        try:
            error_data = e.response.json()
            error_detail += f":{error_data.get('message', 'Unknown HubSpot error')}"
        except:
            error_detail += f":{e.response.text[:100]}" # Primeros 100 chars si no es JSON
            
        logger.error(f"Error en el intercambio de token: {error_detail}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/?hubspot_error={error_detail}"
        )
    
    except HTTPException as e: # Re-lanzar excepciones HTTP que ya hemos generado (como el DB error)
        raise e

    except Exception as e:
        # Captura general para otros errores inesperados
        logger.error(f"Error inesperado en proceso de OAuth callback: {str(e)}")
        import urllib.parse
        encoded_error = urllib.parse.quote(f"unknown_error:{str(e)[:100]}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/?hubspot_error={encoded_error}"
        )

@router.post("/sync-all")
async def sync_all_hubspot_data(user_id: str = Depends(get_current_user)):
    """
    Inicia una sincronización completa para vincular datos existentes 
    entre Supabase y HubSpot.
    """
    logger.info(f"Iniciando sincronización completa para usuario: {user_id}")
    api_key = await get_user_api_key(user_id)
    if not api_key:
        log_sync_operation("sync_all", "-", user_id, success=False, error="API Key no configurada")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="HubSpot no está configurado para este usuario"
        )
    
    # Asegurar que la API key esté en el sincronizador (puede que no sea necesario si ya se usa)
    await hubspot_sync.set_api_key(user_id, api_key)

    linked_contacts = 0
    errors = []

    try:
        # 1. Sincronizar Contactos
        logger.info(f"[Sync All] Obteniendo contactos de Supabase para {user_id}")
        supabase_contacts_resp = supabase.table("contacts").select("id, email, hubspot_id").eq("user_id", user_id).execute()
        
        # Crear un conjunto con todos los emails de Supabase para búsqueda rápida
        supabase_emails = set()
        
        if supabase_contacts_resp.data:
            supabase_contacts = supabase_contacts_resp.data
            logger.info(f"[Sync All] {len(supabase_contacts)} contactos encontrados en Supabase.")
            
            # Extraer todos los emails para verificación rápida después
            for contact in supabase_contacts:
                if contact.get('email'):
                    supabase_emails.add(contact['email'].lower())
            
            for contact in supabase_contacts:
                # Si ya está vinculado, saltar (a menos que forcemos)
                if contact.get('hubspot_id'):
                    continue

                if not contact.get('email'):
                    continue
                
                try:
                    logger.info(f"[Sync All] Buscando contacto HubSpot para email: {contact['email']}")
                    # Usar la API de búsqueda de contactos de HubSpot por email
                    async with httpx.AsyncClient() as client:
                        search_payload = {
                            "filterGroups": [{
                                "filters": [{
                                    "propertyName": "email",
                                    "operator": "EQ",
                                    "value": contact['email']
                                }]
                            }],
                            "properties": ["email"], # Solo necesitamos el ID
                            "limit": 1
                        }
                        hs_response = await client.post(
                            "https://api.hubapi.com/crm/v3/objects/contacts/search",
                            headers={
                                "Authorization": f"Bearer {api_key}",
                                "Content-Type": "application/json",
                            },
                            json=search_payload
                        )
                        hs_response.raise_for_status()
                        hs_results = hs_response.json()

                        if hs_results.get("total", 0) > 0:
                            hubspot_contact_id = hs_results["results"][0]["id"]
                            logger.info(f"[Sync All] Contacto HubSpot encontrado: {hubspot_contact_id}. Vinculando con Supabase ID: {contact['id']}")
                            # Actualizar registro en Supabase con el hubspot_id
                            supabase.table("contacts").update({
                                "hubspot_id": hubspot_contact_id,
                                "hubspot_type": "contact" # Asignar tipo
                            }).eq("id", contact['id']).execute()
                            linked_contacts += 1
                        else:
                            logger.info(f"[Sync All] No se encontró contacto en HubSpot para {contact['email']}")
                            
                except Exception as e:
                    error_msg = f"Error buscando/vinculando contacto {contact.get('email', contact['id'])}: {str(e)}"
                    logger.error(error_msg)
                    errors.append(error_msg)
                    log_sync_operation("sync_all_contact", contact.get('email', contact['id']), user_id, success=False, error=str(e))
        
        # NUEVA FUNCIONALIDAD: Importar contactos desde HubSpot que no existen en Supabase
        imported_contacts = 0
        
        logger.info(f"[Sync All] Obteniendo contactos de HubSpot para importar")
        try:
            # Obtener todos los contactos de HubSpot (con paginación)
            async with httpx.AsyncClient() as client:
                after_cursor = None
                total_imported = 0
                
                # Propiedades a obtener de cada contacto
                properties = ["email", "firstname", "lastname", "phone", "company", "jobtitle"]
                
                while True:
                    # Parámetros de la consulta
                    params = {
                        "limit": 50,  # Obtener 50 contactos por página
                        "properties": ",".join(properties)
                    }
                    
                    if after_cursor:
                        params["after"] = after_cursor
                    
                    hs_response = await client.get(
                        "https://api.hubapi.com/crm/v3/objects/contacts",
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json",
                        },
                        params=params
                    )
                    hs_response.raise_for_status()
                    hs_data = hs_response.json()
                    
                    # Procesar resultados
                    if hs_data.get("results", []):
                        for hs_contact in hs_data["results"]:
                            hs_properties = hs_contact.get("properties", {})
                            hs_email = hs_properties.get("email", "").lower()
                            
                            # Solo procesar contactos con email
                            if not hs_email:
                                continue
                                
                            # Verificar si este email ya existe en Supabase
                            if hs_email in supabase_emails:
                                continue
                                
                            # Preparar datos para insertar en Supabase
                            new_contact = {
                                "user_id": user_id,
                                "email": hs_email,
                                "name": f"{hs_properties.get('firstname', '')} {hs_properties.get('lastname', '')}".strip() or "Sin nombre",
                                "company": hs_properties.get("company") or "Sin empresa",  # Asegurar que nunca sea null aunque ahora es opcional
                                "position": hs_properties.get("jobtitle", "Sin cargo"),
                                "phone": hs_properties.get("phone") or "",  # Asegurar que nunca sea null
                                "status": "prospect",  # Estado predeterminado
                                "hubspot_id": hs_contact["id"],
                                "hubspot_type": "contact"
                            }
                            
                            # Insertar en Supabase
                            supabase.table("contacts").insert(new_contact).execute()
                            logger.info(f"[Sync All] Importado nuevo contacto desde HubSpot: {hs_email}")
                            imported_contacts += 1
                            supabase_emails.add(hs_email)  # Actualizar conjunto de emails para no duplicar
                    
                    # Verificar si hay más páginas
                    after_cursor = hs_data.get("paging", {}).get("next", {}).get("after")
                    if not after_cursor or not hs_data.get("results"):
                        break  # No hay más páginas o resultados
                        
            logger.info(f"[Sync All] Se importaron {imported_contacts} contactos nuevos desde HubSpot")
                
        except Exception as e:
            error_msg = f"Error importando contactos desde HubSpot: {str(e)}"
            logger.error(error_msg)
            errors.append(error_msg)
        
        # 2. Sincronizar Tareas (similar, si aplica)
        # Podríamos buscar tareas en Supabase y ver si tienen un contact_id con hubspot_id
        # O buscar tareas en HubSpot y vincularlas si coinciden con alguna local.
        # Por simplicidad, nos centramos en contactos por ahora.
        logger.info(f"[Sync All] Sincronización de contactos completada para {user_id}. Vinculados: {linked_contacts}, Importados: {imported_contacts}")
        
        # Registrar operación general
        log_sync_operation("sync_all", "all", user_id, success=True, error=f"{linked_contacts} contactos vinculados, {imported_contacts} importados.")

        return {
            "status": "success", 
            "message": f"Sincronización inicial completada. {linked_contacts} contactos vinculados, {imported_contacts} importados.",
            "details": {"linked_contacts": linked_contacts, "imported_contacts": imported_contacts, "errors": errors}
        }

    except Exception as e:
        error_detail = format_error_response(e)
        logger.error(f"[Sync All] Error general durante sincronización completa para {user_id}: {error_detail}")
        log_sync_operation("sync_all", "all", user_id, success=False, error=error_detail)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error durante la sincronización completa: {error_detail}"
        )

@router.post("/disconnect")
async def disconnect_hubspot(user_id: str = Depends(get_current_user)):
    """
    Desconecta la cuenta de HubSpot eliminando la integración.
    """
    try:
        # Eliminar la integración de la base de datos
        response = supabase.table("user_integrations").delete().eq("user_id", user_id).eq("provider", "hubspot").execute()
        
        if not response.data or len(response.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontró integración con HubSpot"
            )
        
        # Limpiar el caché específico del usuario
        user_cache_keys = []
        for key in hubspot_cache.cache.keys():
            if key.startswith(f"{user_id}_"):
                user_cache_keys.append(key)
        
        for key in user_cache_keys:
            await hubspot_cache.delete(key)
        
        log_sync_operation("disconnect", "integration", user_id, success=True)
        
        return {
            "status": "success",
            "message": "Desconectado de HubSpot correctamente"
        }
    except Exception as e:
        log_sync_operation("disconnect", "integration", user_id, success=False, error=str(e))
        
        if isinstance(e, HTTPException):
            raise e
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=format_error_response(e)
        )

class TaskUpdateRequest(BaseModel):
    """Modelo para solicitudes de actualización de tareas en HubSpot"""
    taskId: str
    hubspotId: str
    hubspotType: str
    title: str
    status: str
    priority: str
    time: str

@router.post("/update-task")
async def update_task_in_hubspot(
    request: TaskUpdateRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Actualiza una tarea en HubSpot.
    """
    try:
        # Obtener la API key del usuario
        api_key = await get_user_api_key(user_id)
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="HubSpot no está configurado para este usuario"
            )

        # Asegurarse de que la API key esté configurada en el sincronizador
        await hubspot_sync.set_api_key(user_id, api_key)

        # Convertir datos de la tarea al formato esperado por HubSpot
        # La estructura dependerá del tipo de objeto en HubSpot
        properties = {
            "hs_task_subject": request.title,
            "hs_task_status": "COMPLETED" if request.status == "completed" else "NOT_STARTED",
            "hs_task_priority": request.priority.upper()
        }

        # Si hay una fecha/hora específica
        if request.time and request.time != "any":
            try:
                # Intentar convertir a timestamp para HubSpot
                time_obj = datetime.fromisoformat(request.time.replace('Z', '+00:00'))
                properties["hs_timestamp"] = str(int(time_obj.timestamp() * 1000))
            except ValueError:
                # Si no es un formato ISO, dejarlo como está
                properties["hs_task_body"] = f"Programado para: {request.time}"

        # Determinar la API a usar según el tipo de objeto
        endpoint = None
        if request.hubspotType == "contact":
            endpoint = f"https://api.hubapi.com/crm/v3/objects/contacts/{request.hubspotId}/associations/tasks/{request.taskId}"
        elif request.hubspotType == "deal":
            endpoint = f"https://api.hubapi.com/crm/v3/objects/deals/{request.hubspotId}/associations/tasks/{request.taskId}"
        elif request.hubspotType == "company":
            endpoint = f"https://api.hubapi.com/crm/v3/objects/companies/{request.hubspotId}/associations/tasks/{request.taskId}"
        elif request.hubspotType == "ticket":
            endpoint = f"https://api.hubapi.com/crm/v3/objects/tickets/{request.hubspotId}/associations/tasks/{request.taskId}"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tipo de objeto inválido: {request.hubspotType}"
            )

        # Primero intentamos actualizar la tarea en HubSpot
        task_endpoint = f"https://api.hubapi.com/crm/v3/objects/tasks/{request.taskId}"
        async with httpx.AsyncClient() as client:
            # Si la tarea no existe en HubSpot, la creamos primero
            try:
                update_response = await client.patch(
                    task_endpoint,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={"properties": properties}
                )
                
                if update_response.status_code == 404:
                    # La tarea no existe, necesitamos crearla
                    create_response = await client.post(
                        "https://api.hubapi.com/crm/v3/objects/tasks",
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json",
                        },
                        json={"properties": properties}
                    )
                    
                    if create_response.status_code != 201:
                        error_data = create_response.json()
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error al crear tarea en HubSpot: {error_data.get('message', str(create_response.status_code))}"
                        )
                    
                    # Si se creó correctamente, obtenemos el ID de la tarea para asociarla
                    task_data = create_response.json()
                    hubspot_task_id = task_data.get("id")
                    logger.info(f"Tarea creada correctamente. ID de HubSpot: {hubspot_task_id}, ID original: {request.taskId}")
                    
                    # Ahora asociamos la tarea al objeto correspondiente
                    # IMPORTANTE: Usar el ID de HubSpot, no el ID original
                    association_endpoint = None
                    if request.hubspotType == "contact":
                        association_endpoint = f"https://api.hubapi.com/crm/v3/objects/tasks/{hubspot_task_id}/associations/contacts/{request.hubspotId}"
                    elif request.hubspotType == "deal":
                        association_endpoint = f"https://api.hubapi.com/crm/v3/objects/tasks/{hubspot_task_id}/associations/deals/{request.hubspotId}"
                    elif request.hubspotType == "company":
                        association_endpoint = f"https://api.hubapi.com/crm/v3/objects/tasks/{hubspot_task_id}/associations/companies/{request.hubspotId}"
                    elif request.hubspotType == "ticket":
                        association_endpoint = f"https://api.hubapi.com/crm/v3/objects/tasks/{hubspot_task_id}/associations/tickets/{request.hubspotId}"
                    
                    logger.info(f"Asociando tarea {hubspot_task_id} con objeto {request.hubspotType} {request.hubspotId}...")
                    logger.info(f"Endpoint para asociación: {association_endpoint}")
                    
                    # Intentamos usar la API de asociaciones correcta según la documentación de HubSpot
                    # https://developers.hubspot.com/docs/api/crm/associations
                    try:
                        # Utilizamos POST con categoryId y typeId
                        association_data = {
                            "category": "HUBSPOT_DEFINED",
                            "typeId": 808  # Código específico para tarea -> contacto
                        }
                        
                        association_response = await client.put(
                            association_endpoint,
                            headers={
                                "Authorization": f"Bearer {api_key}",
                                "Content-Type": "application/json",
                            },
                            json=association_data
                        )
                        
                        # Si falla con PUT, intentamos con POST en la misma API v3
                        if association_response.status_code == 404:
                            logger.info("API v3 con PUT no funcionó, intentando con POST...")
                            association_response = await client.post(
                                association_endpoint,
                                headers={
                                    "Authorization": f"Bearer {api_key}",
                                    "Content-Type": "application/json",
                                },
                                json=association_data
                            )
                        
                        # Si sigue fallando, intentamos con el enfoque antiguo (simple, sin payload)
                        if association_response.status_code not in (200, 201, 204):
                            logger.info("Intentando con API v3 específica para tareas...")
                            
                            # Usar el endpoint específico para asociar tareas según la documentación oficial
                            # https://developers.hubspot.com/docs/reference/api/crm/engagements/tasks
                            
                            # Para tareas en HubSpot, necesitamos usar un formato específico
                            assoc_type = "HUBSPOT_DEFINED"
                            task_assoc_endpoint = f"https://api.hubapi.com/crm/v3/associations/task/contact/batch/create"
                            
                            if request.hubspotType == "deal":
                                task_assoc_endpoint = f"https://api.hubapi.com/crm/v3/associations/task/deal/batch/create"
                            elif request.hubspotType == "company":
                                task_assoc_endpoint = f"https://api.hubapi.com/crm/v3/associations/task/company/batch/create"
                            elif request.hubspotType == "ticket":
                                task_assoc_endpoint = f"https://api.hubapi.com/crm/v3/associations/task/ticket/batch/create"
                            
                            # El payload es diferente para el endpoint específico de tareas
                            task_assoc_payload = {
                                "inputs": [
                                    {
                                        "from": {"id": hubspot_task_id},
                                        "to": {"id": request.hubspotId},
                                        "type": "task_to_contact"
                                    }
                                ]
                            }
                            
                            # Ajustar el tipo de asociación según el tipo de objeto
                            if request.hubspotType == "deal":
                                task_assoc_payload["inputs"][0]["type"] = "task_to_deal"
                            elif request.hubspotType == "company":
                                task_assoc_payload["inputs"][0]["type"] = "task_to_company"
                            elif request.hubspotType == "ticket":
                                task_assoc_payload["inputs"][0]["type"] = "task_to_ticket"
                            
                            logger.info(f"Endpoint de asociación de tarea: {task_assoc_endpoint}")
                            logger.info(f"Payload de asociación de tarea: {task_assoc_payload}")
                            
                            association_response = await client.post(
                                task_assoc_endpoint,
                                headers={
                                    "Authorization": f"Bearer {api_key}",
                                    "Content-Type": "application/json",
                                },
                                json=task_assoc_payload
                            )
                            
                            # Si sigue fallando, probamos con la API básica (legacy) de tareas
                            if association_response.status_code not in (200, 201, 204):
                                logger.info("Intentando con API de engagements (legacy)...")
                                engagement_endpoint = f"https://api.hubapi.com/engagements/v1/engagements/tasks/{hubspot_task_id}/associations/{request.hubspotType}s/{request.hubspotId}"
                                
                                association_response = await client.put(
                                    engagement_endpoint,
                                    headers={
                                        "Authorization": f"Bearer {api_key}",
                                        "Content-Type": "application/json",
                                    }
                                )
                    
                        logger.info(f"Respuesta de asociación: Status {association_response.status_code}")
                        
                        if association_response.status_code not in (200, 201, 204):
                            # Manejar la respuesta de forma más segura
                            error_msg = f"Status code: {association_response.status_code}"
                            try:
                                # Intentar obtener el contenido de la respuesta como JSON
                                if association_response.content and len(association_response.content.strip()) > 0:
                                    error_data = association_response.json()
                                    if isinstance(error_data, dict) and "message" in error_data:
                                        error_msg = error_data["message"]
                                    else:
                                        error_msg = str(error_data)
                                    logger.error(f"Error al asociar tarea: {error_msg}")
                                else:
                                    logger.error(f"Respuesta vacía con código de estado: {association_response.status_code}")
                            except Exception as parse_error:
                                # En caso de error al parsear JSON o cualquier otro problema
                                logger.error(f"No se pudo parsear la respuesta como JSON: {str(parse_error)}")
                                logger.error(f"Contenido de la respuesta: {association_response.content[:500] if association_response.content else 'Vacío'}")
                                
                            # Construir un mensaje de error informativo
                            error_detail = f"Error al asociar tarea en HubSpot (Status {association_response.status_code}): {error_msg}"
                            raise HTTPException(
                                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail=error_detail
                            )
                    except httpx.RequestError as e:
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Error de conexión con HubSpot al asociar tarea: {str(e)}"
                        )
                
                elif update_response.status_code not in (200, 204):
                    # Usar el mismo patrón mejorado de manejo de errores
                    error_msg = f"Status code: {update_response.status_code}"
                    try:
                        # Intentar obtener el contenido de la respuesta como JSON
                        if update_response.content and len(update_response.content.strip()) > 0:
                            error_data = update_response.json()
                            if isinstance(error_data, dict) and "message" in error_data:
                                error_msg = error_data["message"]
                            else:
                                error_msg = str(error_data)
                            logger.error(f"Error al actualizar tarea: {error_msg}")
                        else:
                            logger.error(f"Respuesta vacía con código de estado: {update_response.status_code}")
                    except Exception as parse_error:
                        # En caso de error al parsear JSON o cualquier otro problema
                        logger.error(f"No se pudo parsear la respuesta como JSON: {str(parse_error)}")
                        logger.error(f"Contenido de la respuesta: {update_response.content[:500] if update_response.content else 'Vacío'}")
                    
                    # Construir un mensaje de error informativo
                    error_detail = f"Error al actualizar tarea en HubSpot (Status {update_response.status_code}): {error_msg}"
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=error_detail
                    )
            
            except httpx.RequestError as e:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error de conexión con HubSpot: {str(e)}"
                )

        # Registrar operación exitosa
        log_sync_operation("update_task", "task", request.taskId, success=True)
        
        return {
            "status": "success",
            "message": "Tarea actualizada correctamente en HubSpot",
            "task_id": request.taskId,
            "hubspot_id": request.hubspotId,
            "hubspot_type": request.hubspotType
        }
    
    except HTTPException:
        # Pasar excepciones HTTP directamente
        raise
    
    except Exception as e:
        # Registrar operación fallida
        log_sync_operation("update_task", "task", request.taskId, success=False, error=str(e))
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=format_error_response(e)
        )

@router.post("/search")
async def search_hubspot_objects(
    request: SearchRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Busca objetos en HubSpot según tipo y término de búsqueda.
    Devuelve una lista de resultados con ID, nombre y propiedades principales.
    """
    logger.info(f"Iniciando búsqueda en HubSpot para usuario: {user_id}, tipo: {request.type}, query: {request.query}")
    
    # Verificar que el tipo sea válido
    valid_types = ["deal", "contact", "ticket", "company", "companies"]
    if request.type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de objeto no válido. Debe ser uno de: {', '.join(valid_types)}"
        )
    
    # Verificar longitud mínima de búsqueda
    if len(request.query.strip()) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El término de búsqueda debe tener al menos 2 caracteres"
        )
    
    try:
        # Obtener la API key del usuario
        api_key = await get_user_api_key(user_id)
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="HubSpot no está configurado para este usuario"
            )
        
        # Definir propiedades a obtener según el tipo de objeto
        property_map = {
            "contact": ["email", "firstname", "lastname", "company"],
            "company": ["name", "domain", "industry"],
            "companies": ["name", "domain", "industry"],  # Añadir companies como alias de company
            "deal": ["dealname", "amount", "dealstage", "pipeline"],
            "ticket": ["subject", "content", "priority"]
        }
        
        properties = property_map.get(request.type, ["name"])
        
        # Preparar payload de búsqueda
        search_payload = {
            "filterGroups": [],
            "sorts": [],
            "properties": properties,
            "limit": 10  # Limitar a 10 resultados
        }
        
        # Adaptar la búsqueda según el tipo de objeto
        if request.type == "contact":
            # Buscar por email, nombre o apellido
            search_payload["filterGroups"] = [
                {
                    "filters": [
                        {
                            "propertyName": "email",
                            "operator": "CONTAINS_TOKEN",
                            "value": request.query
                        }
                    ]
                },
                {
                    "filters": [
                        {
                            "propertyName": "firstname",
                            "operator": "CONTAINS_TOKEN",
                            "value": request.query
                        }
                    ]
                },
                {
                    "filters": [
                        {
                            "propertyName": "lastname",
                            "operator": "CONTAINS_TOKEN",
                            "value": request.query
                        }
                    ]
                }
            ]
        elif request.type == "company" or request.type == "companies":
            # Buscar por nombre o dominio
            search_payload["filterGroups"] = [
                {
                    "filters": [
                        {
                            "propertyName": "name",
                            "operator": "CONTAINS_TOKEN",
                            "value": request.query
                        }
                    ]
                },
                {
                    "filters": [
                        {
                            "propertyName": "domain",
                            "operator": "CONTAINS_TOKEN",
                            "value": request.query
                        }
                    ]
                }
            ]
        elif request.type == "deal":
            # Buscar por nombre del deal
            search_payload["filterGroups"] = [
                {
                    "filters": [
                        {
                            "propertyName": "dealname",
                            "operator": "CONTAINS_TOKEN",
                            "value": request.query
                        }
                    ]
                }
            ]
        elif request.type == "ticket":
            # Buscar por asunto o contenido
            search_payload["filterGroups"] = [
                {
                    "filters": [
                        {
                            "propertyName": "subject",
                            "operator": "CONTAINS_TOKEN",
                            "value": request.query
                        }
                    ]
                },
                {
                    "filters": [
                        {
                            "propertyName": "content",
                            "operator": "CONTAINS_TOKEN",
                            "value": request.query
                        }
                    ]
                }
            ]
        
        # Realizar la búsqueda en HubSpot
        async with httpx.AsyncClient() as client:
            endpoint = f"https://api.hubapi.com/crm/v3/objects/{request.type}s/search"
            
            # Para tickets, la URL es diferente
            if request.type == "ticket":
                endpoint = "https://api.hubapi.com/crm/v3/objects/tickets/search"
            
            # Para companies, nos aseguramos de que el endpoint sea correcto
            elif request.type == "companies":
                endpoint = "https://api.hubapi.com/crm/v3/objects/companies/search"
            
            hs_response = await client.post(
                endpoint,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=search_payload
            )
            
            hs_response.raise_for_status()
            hs_results = hs_response.json()
            
            # Transformar resultados al formato esperado por el frontend
            results = []
            
            for item in hs_results.get("results", []):
                result = {
                    "id": item["id"],
                    "type": request.type,
                    "properties": {}
                }
                
                # Establecer el nombre según el tipo de objeto
                if request.type == "contact":
                    firstname = item["properties"].get("firstname", "")
                    lastname = item["properties"].get("lastname", "")
                    result["name"] = f"{firstname} {lastname}".strip() or "Sin nombre"
                    # Agregar propiedades adicionales
                    result["properties"] = {
                        "email": item["properties"].get("email", ""),
                        "company": item["properties"].get("company", "")
                    }
                elif request.type == "company" or request.type == "companies":
                    result["name"] = item["properties"].get("name", "Empresa sin nombre")
                    # Agregar propiedades adicionales
                    result["properties"] = {
                        "domain": item["properties"].get("domain", ""),
                        "industry": item["properties"].get("industry", "")
                    }
                elif request.type == "deal":
                    result["name"] = item["properties"].get("dealname", "Deal sin nombre")
                    # Agregar propiedades adicionales
                    result["properties"] = {
                        "amount": item["properties"].get("amount", ""),
                        "dealstage": item["properties"].get("dealstage", "")
                    }
                elif request.type == "ticket":
                    result["name"] = item["properties"].get("subject", "Ticket sin asunto")
                    # Agregar propiedades adicionales
                    result["properties"] = {
                        "priority": item["properties"].get("priority", ""),
                        "content": (item["properties"].get("content", "") or "")[:50] + "..."  # Truncar contenido largo
                    }
                
                results.append(result)
            
            return {"results": results, "total": len(results)}
            
    except httpx.HTTPStatusError as e:
        error_detail = "Error en API de HubSpot"
        try:
            error_data = e.response.json()
            error_detail = error_data.get("message", error_detail)
        except:
            error_detail = f"HTTP Error: {e.response.status_code}"
            
        logger.error(f"Error en búsqueda de HubSpot: {error_detail}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_detail
        )
        
    except Exception as e:
        error_detail = format_error_response(e)
        logger.error(f"Error general en búsqueda de HubSpot: {error_detail}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error durante la búsqueda: {error_detail}"
        ) 

@router.post("/create-deal-migration")
async def create_deal_migration():
    """
    Migración para añadir campos hubspot_id y hubspot_type a la tabla deals.
    """
    try:
        supabase.table("deals").update({}, count_option="exact").execute()
        
        # Verificar si los campos ya existen
        try:
            # Intentar una consulta con los campos para ver si existen
            supabase.table("deals").select("hubspot_id, hubspot_type").limit(1).execute()
            return {"status": "success", "message": "Los campos ya existen en la tabla"}
        except Exception:
            # Si hay error, asumimos que los campos no existen
            pass
            
        # Añadir campo hubspot_id
        supabase.postgres.query("""
            ALTER TABLE deals 
            ADD COLUMN IF NOT EXISTS hubspot_id TEXT,
            ADD COLUMN IF NOT EXISTS hubspot_type TEXT
        """).execute()
        
        return {"status": "success", "message": "Campos añadidos correctamente"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/companies/search")
async def search_companies(
    request: SearchRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Busca empresas en HubSpot por nombre.
    """
    try:
        # Obtener la API key del usuario
        api_key = await get_user_api_key(user_id)
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="HubSpot no está configurado para este usuario"
            )

        # Importar función de búsqueda de empresas
        from hubspot_tools.companies import buscar_empresa_hubspot
        
        # Buscar empresas en HubSpot
        result = await buscar_empresa_hubspot(request.query, user_id)
        
        # Si hay error, devolverlo
        if result.get("error"):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result["error"]
            )
        
        # Formatear respuesta para el frontend
        companies = []
        for company in result.get("results", []):
            companies.append({
                "id": company.get("id"),
                "name": company.get("name", "Empresa sin nombre"),
                "type": "company",
                "properties": {
                    "domain": company.get("domain", ""),
                    "industry": company.get("industry", ""),
                    "city": company.get("city", "")
                }
            })
        
        return {"results": companies, "total": len(companies)}
        
    except Exception as e:
        logger.error(f"Error buscando empresas en HubSpot: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error buscando empresas: {str(e)}"
        ) 