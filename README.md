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

# Variables de la base de datos
DATABASE_URL=postgresql://usuario:password@localhost:5432/funnl

# Variables de Hubspot
HUBSPOT_API_KEY=tu_api_key_de_hubspot

# Variables de OpenAI
NEXT_PUBLIC_OPENAI_API_KEY=tu_api_key_de_openai
```

Crea un archivo `.env` en la raíz del directorio `funnl-backend`:

```
PORT=3001
HUBSPOT_API_KEY=tu_api_key_de_hubspot
OPENAI_API_KEY=tu_api_key_de_openai
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

## Sincronización con HubSpot

### Funcionamiento del flujo de sincronización

El sistema actualmente implementa una sincronización bidireccional entre Supabase y HubSpot:

1. **Vinculación de contactos existentes:**
   - Los contactos que ya existen en Supabase se buscan en HubSpot por su email
   - Si se encuentra una coincidencia, se guarda el ID de HubSpot en el contacto de Supabase

2. **Importación desde HubSpot:**
   - Se obtienen todos los contactos desde HubSpot
   - Si un contacto no existe en Supabase (verificado por email), se importa como nuevo

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
   - Hacer que el campo `phone` sea nullable en la tabla `contacts`
   - O añadir un valor predeterminado como cadena vacía

2. **Ajustar el código:**
   - El código de sincronización está en `mcp-server/routers/hubspot.py`
   - Puedes modificar los valores predeterminados para los campos importados

### Solución de problemas

Si encuentras errores como `null value in column "X" violates not-null constraint`:

1. Asegúrate de que los contactos en HubSpot tengan los campos requeridos
2. Considera modificar la estructura de la base de datos para hacer esos campos opcionales
3. Modifica el proceso de importación para proporcionar valores predeterminados
