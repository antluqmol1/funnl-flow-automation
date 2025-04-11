from supabase import create_client, Client
import os
from dotenv import load_dotenv
import logging

# Configurar logging
logger = logging.getLogger(__name__)

# Cargar variables de entorno
load_dotenv()

# Obtener credenciales de Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("Variables de entorno para Supabase no configuradas")
    raise ValueError("SUPABASE_URL y SUPABASE_SERVICE_KEY deben estar configurados en el archivo .env")

# Inicializar cliente de Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) 