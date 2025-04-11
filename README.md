# Automated-Funnl

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
