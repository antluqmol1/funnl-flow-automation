"""
Módulo HubSpot para interactuar con la API de HubSpot.
Proporciona funciones para manejar contactos, empresas, deals y tickets.
"""

from .contacts import buscar_contacto_hubspot, crear_contacto_hubspot
from .companies import (
    buscar_empresa_hubspot,
    obtener_empresa_hubspot,
    crear_empresa_hubspot,
    actualizar_empresa_hubspot
)
from .deals import buscar_deal_hubspot, obtener_deal_hubspot
from .tickets import buscar_ticket_hubspot, obtener_ticket_hubspot

__all__ = [
    'buscar_contacto_hubspot',
    'crear_contacto_hubspot',
    'buscar_empresa_hubspot',
    'obtener_empresa_hubspot',
    'crear_empresa_hubspot',
    'actualizar_empresa_hubspot',
    'buscar_deal_hubspot',
    'obtener_deal_hubspot',
    'buscar_ticket_hubspot',
    'obtener_ticket_hubspot'
] 