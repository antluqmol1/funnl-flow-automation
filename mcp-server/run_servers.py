import subprocess
import os
import sys
import time
import signal
import logging
from dotenv import load_dotenv

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Cargar variables de entorno
load_dotenv()

# Procesos de los servidores
api_process = None
mcp_process = None

def start_servers():
    """Inicia ambos servidores como procesos separados."""
    global api_process, mcp_process
    
    # Obtener puerto para la API
    port = os.getenv("PORT", "8000")
    
    # Directorio actual
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    try:
        # Iniciar API FastAPI
        logger.info(f"Iniciando API FastAPI en el puerto {port}...")
        api_process = subprocess.Popen(
            [sys.executable, "api.py"],
            cwd=current_dir
        )
        logger.info(f"API iniciada con PID: {api_process.pid}")
        
        # Esperar un momento para que la API pueda iniciar
        time.sleep(2)
        
        # Iniciar servidor MCP
        logger.info("Iniciando servidor MCP...")
        mcp_process = subprocess.Popen(
            [sys.executable, "mcp_server.py"],
            cwd=current_dir
        )
        logger.info(f"Servidor MCP iniciado con PID: {mcp_process.pid}")
        
        # Mostrar mensaje de éxito
        logger.info("=============================================================")
        logger.info("¡Ambos servidores están en ejecución!")
        logger.info(f"API FastAPI: http://localhost:{port}")
        logger.info("Servidor MCP: Ejecutándose en modo escucha para clientes MCP")
        logger.info("=============================================================")
        logger.info("Presiona Ctrl+C para detener ambos servidores")
        
        # Esperar a que los procesos terminen (o hasta Ctrl+C)
        while True:
            if api_process.poll() is not None:
                logger.error("El proceso de API terminó inesperadamente")
                break
            if mcp_process.poll() is not None:
                logger.error("El proceso MCP terminó inesperadamente")
                break
            time.sleep(1)
    
    except KeyboardInterrupt:
        logger.info("Recibida señal de interrupción (Ctrl+C)")
    finally:
        stop_servers()

def stop_servers():
    """Detiene ambos servidores de manera ordenada."""
    global api_process, mcp_process
    
    logger.info("Deteniendo servidores...")
    
    # Detener API
    if api_process and api_process.poll() is None:
        logger.info(f"Terminando proceso API (PID: {api_process.pid})...")
        if sys.platform == 'win32':
            api_process.terminate()
        else:
            os.kill(api_process.pid, signal.SIGTERM)
        api_process.wait(timeout=5)
        logger.info("Proceso API terminado")
    
    # Detener MCP
    if mcp_process and mcp_process.poll() is None:
        logger.info(f"Terminando proceso MCP (PID: {mcp_process.pid})...")
        if sys.platform == 'win32':
            mcp_process.terminate()
        else:
            os.kill(mcp_process.pid, signal.SIGTERM)
        mcp_process.wait(timeout=5)
        logger.info("Proceso MCP terminado")
    
    logger.info("Servidores detenidos correctamente")

if __name__ == "__main__":
    start_servers() 