"""
Utilidades para la integración con HubSpot.
"""
import hmac
import hashlib
import logging
import json
from typing import Any, Dict, Optional

# Configurar logging
logger = logging.getLogger(__name__)

def verify_webhook_signature(request_body: bytes, signature: str, client_secret: str) -> bool:
    """
    Verifica la firma del webhook de HubSpot.
    
    Args:
        request_body: Cuerpo de la petición en bytes
        signature: Firma del webhook proporcionada en el encabezado X-HubSpot-Signature
        client_secret: Secreto del cliente HubSpot
        
    Returns:
        bool: True si la firma es válida, False en caso contrario
    """
    try:
        # Calcular la firma usando el secreto del cliente
        computed_signature = hmac.new(
            key=client_secret.encode(),
            msg=request_body,
            digestmod=hashlib.sha256
        ).hexdigest()
        
        # Comparar con la firma proporcionada
        return hmac.compare_digest(computed_signature, signature)
    
    except Exception as e:
        logger.error(f"Error verificando firma del webhook: {e}")
        return False

def log_webhook_event(event_type: str, event_id: str, event_data: Dict[str, Any]) -> None:
    """
    Registra un evento de webhook en los logs.
    
    Args:
        event_type: Tipo de evento (p.ej., 'contact.propertyChange')
        event_id: ID del evento
        event_data: Datos del evento
    """
    try:
        logger.info(f"Webhook recibido: {event_type}, ID: {event_id}")
        logger.debug(f"Datos del evento: {json.dumps(event_data, indent=2)}")
    except Exception as e:
        logger.error(f"Error registrando evento webhook: {e}")

def log_sync_operation(operation: str, object_type: str, object_id: str, success: bool, error: Optional[str] = None) -> None:
    """
    Registra una operación de sincronización en los logs.
    
    Args:
        operation: Tipo de operación (p.ej., 'sync_contact', 'update_company')
        object_type: Tipo de objeto (p.ej., 'contact', 'company')
        object_id: ID del objeto
        success: Si la operación fue exitosa
        error: Mensaje de error (si hubo un error)
    """
    try:
        if success:
            logger.info(f"Operación {operation} completada para {object_type} {object_id}")
        else:
            logger.error(f"Error en operación {operation} para {object_type} {object_id}: {error}")
    except Exception as e:
        logger.error(f"Error registrando operación: {e}")

def format_error_response(error_message: str, status_code: int = 400) -> Dict[str, Any]:
    """
    Formatea una respuesta de error para las APIs.
    
    Args:
        error_message: Mensaje de error
        status_code: Código de estado HTTP
        
    Returns:
        Dict: Respuesta formateada
    """
    return {
        "success": False,
        "error": error_message,
        "status_code": status_code
    } 