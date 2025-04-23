# Automated Funnl

Una aplicación para automatizar la gestión de ventas, con procesamiento natural de lenguaje y conexión a Hubspot CRM.

## Características

- Autenticación de usuarios con NextAuth.js
- Dashboard para ver métricas y analíticas
- Gestión de contactos y empresas
- Envío de emails automatizados
- Gestión de actividades y tareas
- Asistente virtual por texto y voz usando AI
- Sincronización con Hubspot CRM

## Tecnologías

- **Frontend**: Next.js, React, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express, TypeScript
- **Base de datos**: PostgreSQL, Prisma ORM
- **Autenticación**: NextAuth.js
- **AI**: OpenAI GPT-4, OpenAI Whisper para transcripción de voz
- **Integración**: API de Hubspot CRM

## Estructura del proyecto

```
automated-funnl/
├── funnl-frontend/       # Aplicación Next.js
├── funnl-backend/        # API Express 
└── mcpClient/            # Cliente para la comunicación con OpenAI
```

## Configuración

### Variables de entorno

Crea un archivo `.env.local` en la raíz del directorio `funnl-frontend`:

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=tu_secreto_aqui

# Variables de Supabase (usadas por el cliente Supabase @/lib/supabase)
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key_de_supabase

# URL del backend principal (mcp-server)
VITE_API_URL=http://localhost:8000

# Variables de OpenAI (si se usan directamente en el frontend)
# NEXT_PUBLIC_OPENAI_API_KEY=tu_api_key_de_openai

# --- HUBSPOT_API_KEY ya no es necesaria aquí ---
# La conexión con HubSpot se gestiona a través del backend mcp-server
```

Crea un archivo `.env` en la raíz del directorio `funnl-backend` (si este backend aún usa alguna variable):

```
PORT=3001
# OPENAI_API_KEY=tu_api_key_de_openai 
# DATABASE_URL=postgresql://usuario:password@localhost:5432/funnl # Si usa Prisma
SUPABASE_URL=tu_url_de_supabase # Si este backend interactúa con Supabase
SUPABASE_SERVICE_KEY=tu_service_key_de_supabase # Si necesita permisos elevados
```

Crea un archivo `.env` en la raíz del directorio `mcp-server` (FastAPI Backend):

```
PORT=8000
OPENAI_API_KEY=tu_api_key_de_openai

# --- Clave de API de HubSpot --- 
# ¡¡Obligatoria para la conexión global con HubSpot!!
HUBSPOT_API_KEY=tu_api_key_de_hubspot 

# Variables de Supabase (para validar tokens de usuario y acceder a datos)
SUPABASE_URL=tu_url_de_supabase
SUPABASE_SERVICE_KEY=tu_service_key_de_supabase # Necesaria para validar tokens

# Variables OAuth de HubSpot (No usadas para la conexión básica, pero pueden ser usadas por otras funciones)
# HUBSPOT_CLIENT_ID=...
# HUBSPOT_CLIENT_SECRET=...
# HUBSPOT_APP_ID=...
# HUBSPOT_SCOPE=...
# FRONTEND_URL=http://localhost:8080 # URL base del frontend para callbacks OAuth si se usan

```

### Instalación

1. **Instalar dependencias del frontend**

```bash
cd funnl-frontend
npm install
```

2. **Instalar dependencias del backend**

```bash
cd funnl-backend
npm install
```

3. **Instalar dependencias del cliente MCP**

```bash
cd mcpClient
npm install
```

## Desarrollo

Para iniciar el servidor de desarrollo:

1. **Iniciar el frontend**

```bash
cd funnl-frontend
npm run dev
```

El frontend estará disponible en `http://localhost:3000`.

2. **Iniciar el backend**

```bash
cd funnl-backend
npm run dev
```

El servidor backend estará disponible en `http://localhost:3001`.

## Procesamiento de Voz con OpenAI Whisper

La aplicación ahora incluye procesamiento de voz utilizando la API de OpenAI Whisper para transcribir mensajes de audio. Esta funcionalidad permite a los usuarios interactuar con el asistente mediante comandos de voz.

### Características principales:

- Grabación de audio desde el navegador
- Transcripción de audio a texto utilizando OpenAI Whisper API
- Procesamiento de la transcripción por el asistente MCP
- Respuesta generada por el asistente en base al contenido del audio

### Requisitos:

- Clave de API de OpenAI (OPENAI_API_KEY) configurada en el archivo `.env` del backend
- Permisos de micrófono en el navegador

### Uso:

1. Haz clic en el botón de micrófono en la interfaz de chat
2. Habla tu consulta o instrucción
3. La grabación se detiene automáticamente o puedes detenerla manualmente
4. El audio se envía al servidor para ser transcrito por Whisper
5. La transcripción se procesa con el asistente MCP
6. Recibirás la respuesta en la interfaz de chat

## Despliegue

### Frontend (Next.js)

El frontend puede ser desplegado en Vercel:

```bash
cd funnl-frontend
vercel
```

### Backend (Express)

El backend puede ser desplegado en servicios como Heroku, Railway o cualquier otro que soporte Node.js:

```bash
cd funnl-backend
npm run build
```

## Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un issue primero para discutir los cambios que te gustaría hacer.

## Conexión y Sincronización con HubSpot (API Key)

El sistema utiliza una **API Key de HubSpot** configurada en el backend `mcp-server` para interactuar con HubSpot. Este enfoque simplificado se usa para la verificación del estado de conexión y potencialmente para operaciones de sincronización.

### Verificación de Conexión

*   El backend `mcp-server` expone un endpoint público `/hubspot/status` (GET).
*   Este endpoint **no requiere autenticación de usuario**.
*   Utiliza la variable de entorno `HUBSPOT_API_KEY` configurada en el servidor para realizar una llamada de verificación a la API de HubSpot.
*   Devuelve `{"connected": true}` si la API Key es válida y la conexión es exitosa, o `{"connected": false}` junto con un mensaje de error en caso contrario.
*   El componente `HubspotConfig.tsx` en el frontend llama a este endpoint para mostrar el estado de la conexión del servidor con HubSpot. El botón en este componente sirve para **re-verificar** el estado, no para iniciar una conexión.

### Funcionamiento del flujo de sincronización (Usando API Key del Servidor)

El sistema implementa mecanismos de sincronización entre Supabase y HubSpot utilizando la **API Key configurada en el servidor `mcp-server`**. Las operaciones de sincronización (como las iniciadas por `/sync` o `/sync-all` en `mcp-server/routers/hubspot.py`) se ejecutan en el backend usando esta clave global.

1.  **Vinculación de contactos existentes:**
    *   Los contactos que ya existen en Supabase se buscan en HubSpot (usando la API Key del servidor) por su email.
    *   Si se encuentra una coincidencia, se guarda el ID de HubSpot en el contacto de Supabase.
2.  **Importación desde HubSpot:**
    *   Se obtienen contactos desde HubSpot (usando la API Key del servidor).
    *   Si un contacto no existe en Supabase (verificado por email), se importa como nuevo, aplicando valores por defecto si es necesario.

**Nota:** Aunque el backend contiene código relacionado con OAuth 2.0 (`/auth`, `/callback`), el flujo principal de verificación de estado implementado actualmente se basa en la API Key global.

### Campos obligatorios en la tabla "contacts"

La tabla `contacts` en Supabase tiene las siguientes restricciones NOT NULL:

| Campo | Descripción | Valor por defecto si falta |
|-------|-------------|----------------------------|
| `user_id` | ID del usuario propietario | N/A (obligatorio) |
| `email` | Email del contacto | N/A (obligatorio) |
| `name` | Nombre completo | "Sin nombre" |
| `company` | Empresa | **AHORA OPCIONAL** - "Sin empresa" |
| `position` | Cargo | "Sin cargo" |
| `phone` | Teléfono | **OBLIGATORIO - no tiene valor predeterminado** |
| `status` | Estado del contacto | "prospect" |

### Manejo de contactos de HubSpot

**Importante:** Los contactos de HubSpot a menudo no tienen todos los campos completos, lo que puede generar errores en la sincronización:

- Los contactos de ejemplo y algunas importaciones pueden no tener números de teléfono
- HubSpot no requiere estos campos mientras que nuestra base de datos sí
- Si se producen errores de sincronización, verificar que los contactos en HubSpot tengan valores en los campos obligatorios

### Personalización

Para adaptar la sincronización a tus necesidades:

1. **Modificar restricciones de la base de datos:**
    *   Considera hacer campos como `phone` nullable en la tabla `contacts` si los datos de HubSpot suelen venir incompletos.
2. **Ajustar el código:**
    *   La lógica principal de las rutas de HubSpot está en `mcp-server/routers/hubspot.py`.
    *   Las funciones específicas de interacción con la API de HubSpot están en `mcp-server/hubspot_tools/`.
    *   Puedes modificar los valores predeterminados para los campos importados o la lógica de sincronización en estos archivos.

### Solución de problemas

Si encuentras errores como `null value in column "X" violates not-null constraint`:

1. Asegúrate de que los contactos en HubSpot tengan los campos requeridos
2. Considera modificar la estructura de la base de datos para hacer esos campos opcionales
3. Modifica el proceso de importación para proporcionar valores predeterminados
