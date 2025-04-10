"""
Utilidades para la integración con HubSpot.
"""
import os
import hmac
import hashlib
import logging
from typing import Dict, Any
from dotenv import load_dotenv

load_dotenv()

# Configuración de logging
logger = logging.getLogger("hubspot")
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
))
logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Configuración de HubSpot
HUBSPOT_CLIENT_SECRET = os.getenv("HUBSPOT_CLIENT_SECRET")
if not HUBSPOT_CLIENT_SECRET:
    logger.warning("HUBSPOT_CLIENT_SECRET no está configurado. La verificación de webhooks estará deshabilitada.")

def verify_webhook_signature(signature: str, body: bytes) -> bool:
    """
    Verifica la firma de un webhook de HubSpot.
    
    Args:
        signature: Firma proporcionada en el header X-HubSpot-Signature
        body: Cuerpo del request en bytes
    
    Returns:
        bool: True si la firma es válida, False en caso contrario
    """
    if not HUBSPOT_CLIENT_SECRET:
        logger.warning("No se puede verificar la firma: HUBSPOT_CLIENT_SECRET no está configurado")
        return False

    try:
        # Calcular el hash HMAC-SHA256 del cuerpo usando el Client Secret
        source_signature = hmac.new(
            HUBSPOT_CLIENT_SECRET.encode('utf-8'),
            body,
            hashlib.sha256
        ).hexdigest()
        
        # Comparar con la firma proporcionada
        return hmac.compare_digest(signature, source_signature)
    except Exception as e:
        logger.error(f"Error verificando firma del webhook: {str(e)}")
        return False

def log_webhook_event(event_type: str, data: Dict[str, Any]) -> None:
    """
    Registra un evento de webhook en el log.
    
    Args:
        event_type: Tipo de evento del webhook
        data: Datos del evento
    """
    try:
        logger.info(f"Webhook recibido - Tipo: {event_type}")
        logger.debug(f"Datos del webhook: {data}")
    except Exception as e:
        logger.error(f"Error registrando evento de webhook: {str(e)}")

def log_sync_operation(operation: str, object_type: str, object_id: str, success: bool, error: str = None) -> None:
    """
    Registra una operación de sincronización en el log.
    
    Args:
        operation: Tipo de operación (sync, cache, etc.)
        object_type: Tipo de objeto (contact, deal, etc.)
        object_id: ID del objeto
        success: Si la operación fue exitosa
        error: Mensaje de error si hubo uno
    """
    try:
        if success:
            logger.info(f"{operation} exitoso - Tipo: {object_type}, ID: {object_id}")
        else:
            logger.error(f"{operation} fallido - Tipo: {object_type}, ID: {object_id}")
            if error:
                logger.error(f"Error: {error}")
    except Exception as e:
        logger.error(f"Error registrando operación: {str(e)}")

def format_error_response(error: Exception) -> Dict[str, str]:
    """
    Formatea un error para la respuesta de la API.
    
    Args:
        error: Excepción a formatear
    
    Returns:
        Dict con el mensaje de error formateado
    """
    return {
        "error": str(error),
        "type": error.__class__.__name__
    } 