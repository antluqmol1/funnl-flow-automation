"""
Router para manejar los endpoints relacionados con HubSpot.
"""
from fastapi import APIRouter, HTTPException, Header, Request, Response, status, Depends
from typing import Dict, Any, Optional
from pydantic import BaseModel
from hubspot.sync import hubspot_sync, hubspot_cache
from hubspot.utils import verify_webhook_signature, log_webhook_event, log_sync_operation, format_error_response
import httpx
import os
import logging
from dotenv import load_dotenv
from supabase import create_client, Client
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import RedirectResponse
import secrets

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
            
            if response.status_code == 401:
                return {"connected": False, "message": "Token expirado o inválido"}
            elif response.status_code != 200:
                return {"connected": False, "message": f"Error al verificar conexión: {response.status_code}"}

            return {"connected": True, "message": "Conectado a HubSpot"}
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
        f"&redirect_uri={FRONTEND_URL}/auth/hubspot/callback"
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
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?error={error}"
        )

    if state not in oauth_states:
        logger.error(f"Estado OAuth no encontrado: {state[:8]}...")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?error=invalid_state"
        )

    user_id = oauth_states.pop(state)
    logger.info(f"Usuario identificado: {user_id}")

    try:
        logger.info("Intercambiando código por token...")
        # Intercambiar código por token
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.hubapi.com/oauth/v1/token",
                data={
                    "grant_type": "authorization_code",
                    "client_id": HUBSPOT_CLIENT_ID,
                    "client_secret": HUBSPOT_CLIENT_SECRET,
                    "redirect_uri": f"{FRONTEND_URL}/auth/hubspot/callback",
                    "code": code
                }
            )

            logger.info(f"Respuesta de token: {response.status_code}")
            
            if response.status_code != 200:
                error_data = response.json()
                logger.error(f"Error al obtener token: {error_data}")
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings?error=token_exchange_failed:{error_data.get('message', 'Unknown error')}"
                )

            data = response.json()
            access_token = data["access_token"]
            
            logger.info("Token obtenido correctamente")

            try:
                # Primero intentamos obtener el registro existente
                logger.info(f"Verificando si ya existe integración para usuario: {user_id}")
                result = supabase.table("user_integrations").select("*").eq("user_id", user_id).eq("provider", "hubspot").execute()
                
                if result.data and len(result.data) > 0:
                    # Ya existe, actualizamos el token
                    logger.info("Actualizando token existente")
                    integration_id = result.data[0]["id"]
                    supabase.table("user_integrations").update({
                        "config": {"apiKey": access_token}
                    }).eq("id", integration_id).execute()
                else:
                    # No existe, lo creamos
                    logger.info("Creando nueva integración")
                    supabase.table("user_integrations").insert({
                        "user_id": user_id,
                        "provider": "hubspot",
                        "config": {"apiKey": access_token}
                    }).execute()
            except Exception as db_error:
                logger.error(f"Error al guardar en base de datos: {str(db_error)}")
                # Si hay un error de clave duplicada, intentamos actualizar
                if "duplicate key value" in str(db_error) or "23505" in str(db_error):
                    logger.info("Intentando actualizar mediante upsert")
                    supabase.table("user_integrations").update({
                        "config": {"apiKey": access_token}
                    }).eq("user_id", user_id).eq("provider", "hubspot").execute()
                else:
                    # Es otro tipo de error, lo propagamos
                    raise db_error

            # Configurar token en el sincronizador
            await hubspot_sync.set_api_key(user_id, access_token)
            
            logger.info("Token guardado correctamente")

            return RedirectResponse(
                url=f"{FRONTEND_URL}/settings?success=true"
            )

    except Exception as e:
        logger.error(f"Error en proceso de OAuth: {str(e)}")
        # Codificar el error para evitar problemas en la URL
        import urllib.parse
        encoded_error = urllib.parse.quote(str(e))
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?error={encoded_error}"
        ) 