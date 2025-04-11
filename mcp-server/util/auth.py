from fastapi import Depends, HTTPException, status, Header
from typing import Optional
import logging
import uuid

# Configurar logging
logger = logging.getLogger(__name__)

async def get_current_user(x_user_id: Optional[str] = Header(None)) -> str:
    """
    Función de dependencia para obtener el ID del usuario actual.
    
    En un entorno de producción, esto debería verificar un token JWT u otro método
    de autenticación seguro. Para simplificar, usamos un header personalizado.
    
    Args:
        x_user_id: Header personalizado con el ID del usuario
        
    Returns:
        str: ID del usuario autenticado
        
    Raises:
        HTTPException: Si no se proporciona un ID de usuario válido
    """
    if not x_user_id:
        # Para desarrollo/pruebas, podríamos devolver un ID de usuario de prueba
        # En producción, esto debería lanzar una excepción
        test_user_id = "00000000-0000-0000-0000-000000000000"  # ID de prueba
        logger.warning(f"No se proporcionó ID de usuario. Usando ID de prueba: {test_user_id}")
        return test_user_id
    
    # Validar que el ID de usuario tenga formato UUID
    try:
        user_id = str(uuid.UUID(x_user_id))
        return user_id
    except ValueError:
        logger.error(f"ID de usuario inválido: {x_user_id}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ID de usuario inválido"
        ) 