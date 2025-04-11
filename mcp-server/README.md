# MCP Server para Automated Funnl

Este proyecto combina un servidor MCP (Model Context Protocol) con una API web FastAPI para proporcionar integración con HubSpot y otras funcionalidades.

Tras analizar el código y realizar pruebas, hemos identificado que la mejor manera de ejecutar el sistema es **separar los servidores** para evitar conflictos. Esta documentación explicará cómo configurar y ejecutar cada componente.

## Arquitectura del Sistema

El sistema consta de dos componentes principales:

1. **Servidor MCP (mcp_server.py)**: Proporciona herramientas para interactuar con HubSpot a través del protocolo MCP. Este servidor está diseñado para ser consumido por clientes MCP como Claude Desktop.

2. **API Web (api.py)**: API REST basada en FastAPI que proporciona endpoints para gestionar la integración con HubSpot, ejecutar migraciones y más. Este componente se ejecuta con Uvicorn.

## Requisitos

- Python 3.10 o superior
- [uv](https://github.com/astral-sh/uv) - Gestor de paquetes para Python (recomendado)

## Configuración

1. Clona el repositorio
2. Crea un entorno virtual:
   ```bash
   uv venv
   source .venv/bin/activate  # En Windows: .venv\Scripts\activate
   ```
3. Instala las dependencias:
   ```bash
   uv pip install -r requirements.txt
   ```
   o alternativamente:
   ```bash
   uv install -r requirements.txt
   ```
   
   Para instalar específicamente la integración con HubSpot:
   ```bash
   uv add hubspot-api-client  # Actualmente instalará la versión 11.1.0
   ```
4. Configura el archivo `.env` con tus credenciales:
   ```
   # Supabase
   SUPABASE_URL=tu_url_de_supabase
   SUPABASE_SERVICE_KEY=tu_clave_de_servicio

   # HubSpot
   HUBSPOT_CLIENT_ID=tu_client_id
   HUBSPOT_CLIENT_SECRET=tu_client_secret
   HUBSPOT_REDIRECT_URI=http://localhost:3000/ # O tu URI de redirección
   HUBSPOT_TOKEN=tu_token_de_hubspot  # Para pruebas directas con la API
   
   # Configuración del servidor
   PORT=8000  # Puerto para la API FastAPI
   LOG_LEVEL=INFO  # Nivel de logging
   ```

## Ejecución de los Servidores

### Opción 1: Ejecutar cada servidor por separado (Recomendado)

Para una máxima estabilidad y control, ejecuta cada servidor en una terminal separada:

**Terminal 1 - API Web:**
```bash
cd mcp-server
python api.py
```
Esto iniciará la API FastAPI en `http://localhost:8000`.

**Terminal 2 - Servidor MCP:**
```bash
cd mcp-server
python mcp_server.py
```
Esto iniciará el servidor MCP que será accesible para clientes MCP como Claude Desktop.

### Opción 2: Ejecutar ambos servidores a la vez

Si prefieres ejecutar ambos con un solo comando, hemos proporcionado un script que los inicia en procesos separados:

```bash
cd mcp-server
python run_servers.py
```

Este script:
- Inicia primero la API Web
- Luego inicia el servidor MCP
- Muestra mensajes de estado
- Gestiona la terminación ordenada con Ctrl+C

### ⚠️ IMPORTANTE: No usar main.py

No utilices el archivo `main.py` original, ya que intenta ejecutar ambos servidores en un mismo proceso, lo que causa conflictos. Este archivo se mantiene por razones de compatibilidad pero no debe usarse.

## Endpoints de la API Web

- `GET /` - Verificar que el servidor está funcionando
- `POST /migrations/add-hubspot-fields` - Añadir columnas de HubSpot a la tabla `tasks`
- `POST /migrations/add-hubspot-fields-contacts` - Añadir columnas de HubSpot a la tabla `contacts`

### Endpoints de HubSpot

- `GET /hubspot/auth` - Iniciar proceso de autorización de HubSpot
- `GET /hubspot/callback` - Callback para el proceso de autorización
- `GET /hubspot/status` - Verificar estado de la conexión con HubSpot
- `POST /hubspot/sync-all` - Sincronizar contactos entre Supabase y HubSpot
- `POST /hubspot/disconnect` - Desconectar la integración con HubSpot

## Herramientas MCP

Las siguientes herramientas están disponibles para los clientes MCP:

- **Contactos**: `find_contact`, `create_contact`
- **Empresas**: `find_company`, `get_company`, `create_company`, `update_company`
- **Deals**: `find_deal`, `get_deal`
- **Tickets**: `find_ticket`, `get_ticket`
- **Análisis**: `analyze_activities`

## Configuración para Claude Desktop

Para usar el servidor MCP con Claude Desktop, edita el archivo de configuración:

```json
{
    "mcpServers": {
        "funnl-tools": {
            "command": "/ruta/absoluta/al/python",
            "args": [
                "-m",
                "mcp_server.py"
            ],
            "cwd": "/ruta/absoluta/a/mcp-server"
        }
    }
}
```

## Solución de Problemas

### API Web no inicia

- Verifica que el puerto 8000 no esté ocupado por otra aplicación
- Revisa los logs por errores específicos
- Asegúrate de haber instalado todas las dependencias
- Verifica la configuración en el archivo `.env`

### Servidor MCP no se conecta con Claude Desktop

- Revisa la configuración en Claude Desktop
- Verifica la ruta absoluta al archivo Python
- Asegúrate de que el directorio de trabajo (cwd) sea correcto
- Revisa los logs del servidor MCP por errores

### Errores en las migraciones de Supabase

1. Asegúrate de que la API esté ejecutándose: `python api.py`
2. Verifica la conexión a Supabase ejecutando:
   ```bash
   curl http://localhost:8000/
   ```
3. Ejecuta las migraciones:
   ```bash
   curl -X POST http://localhost:8000/migrations/add-hubspot-fields
   curl -X POST http://localhost:8000/migrations/add-hubspot-fields-contacts
   ```
4. Revisa los logs del servidor por posibles errores

### Problemas con la biblioteca HubSpot

Si ves advertencias sobre "No module named 'hubspot'":
1. Verifica que la biblioteca está instalada: `uv add hubspot-api-client`
2. Actualiza a la versión correcta (actualmente 11.1.0): `uv add hubspot-api-client==11.1.0`
3. Revisa que no haya conflictos de nombres entre la biblioteca y los módulos locales

Si ves errores relacionados con importaciones específicas como "cannot import name 'CollectionResponseSimplePublicObject'":
1. La estructura de la API de HubSpot cambia significativamente entre versiones
2. La versión 11.1.0 tiene una estructura diferente a la 8.2.2 usada originalmente
3. Puedes modificar los archivos en `hubspot_tools/` para adaptarlos a la versión que estés usando
4. Alternativamente, puedes instalar una versión específica: `uv add hubspot-api-client==8.2.2`

Nota que el servidor puede funcionar parcialmente incluso con estas advertencias, ya que muchas funcionalidades no dependen directamente de la API de HubSpot.

## Estructura del Proyecto

```
mcp-server/
├── __init__.py           # Convierte la carpeta en un paquete Python
├── api.py                # Servidor FastAPI para endpoints REST
├── mcp_server.py         # Servidor MCP para clientes como Claude Desktop
├── run_servers.py        # Script para ejecutar ambos servidores a la vez
├── main.py               # Archivo original (no usar)
├── db.py                 # Inicializa la conexión a Supabase
├── requirements.txt      # Dependencias del proyecto
├── .env                  # Variables de entorno (credenciales)
├── hubspot_tools/        # Módulos para interactuar con HubSpot
│   ├── __init__.py
│   ├── contacts.py       # Funciones para manejar contactos
│   ├── companies.py      # Funciones para manejar empresas
│   ├── deals.py          # Funciones para manejar deals
│   ├── tickets.py        # Funciones para manejar tickets
│   ├── sync.py           # Funciones de sincronización con HubSpot
│   └── utils.py          # Utilidades para HubSpot
├── routers/              # Routers de FastAPI para diferentes funcionalidades
│   ├── __init__.py
│   └── hubspot.py        # Endpoints para integración con HubSpot
└── util/                 # Utilidades compartidas
    ├── __init__.py
    └── auth.py           # Funciones de autenticación
```

## Desarrollo

Para añadir nuevas herramientas MCP, modifica el archivo `mcp_server.py` y usa el decorador `@mcp.tool()`.

Para añadir nuevos endpoints API, crea un nuevo router en la carpeta `routers/` y añádelo en `api.py`.

## Contribuciones

Las contribuciones son bienvenidas. Por favor, sigue estos pasos:

1. Haz fork del repositorio
2. Crea una rama para tu feature: `git checkout -b feature/nueva-caracteristica`
3. Haz commit de tus cambios: `git commit -am 'Añadir nueva característica'`
4. Haz push a la rama: `git push origin feature/nueva-caracteristica`
5. Crea un Pull Request