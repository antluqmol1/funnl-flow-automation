# Funnl Backend - Guía de Uso

## Requisitos Previos
- Asegúrate de estar en el directorio `~/automated-funnl`
- Tener el entorno virtual configurado
- Tener Node.js y npm instalados

## Opciones de Ejecución

### Opción 1: Ejecutar solo el cliente MCP (línea de comandos)

1. Activar el entorno virtual:
```bash
source ./mcp-server/.venv/bin/activate
```

2. Ejecutar el cliente MCP:
```bash
node ./funnl-backend/build/mcpClient.js ./mcp-server/mcp_server.py
```

3. Interactuar con el asistente por línea de comandos. Para salir, escribe `quit`.

### Opción 2: Ejecutar el servidor web completo (para el frontend)

1. Activar el entorno virtual:
```bash
source ./mcp-server/.venv/bin/activate
```

2. Compilar el backend (si hay cambios en TypeScript):
```bash
cd funnl-backend
npm run build
```

3. Iniciar el servidor Express:
```bash
npm start
```

4. En una terminal separada, iniciar el frontend:
```bash
cd ../funnl-frontend
npm run dev
```

5. Acceder a la interfaz del agente en `http://localhost:8080/agent`

## Resultado Esperado del Cliente MCP

Al ejecutar correctamente el cliente MCP, verás un mensaje similar a:

```
Connected to MCP server with tools:
- find_contact
- create_contact
- find_company
- get_company
- create_company
- update_company
- find_deal
- get_deal
- find_ticket
- get_ticket
- process_query
- analyze_activities

MCP Client Started!
Type your queries or 'quit' to exit.

Query:
```

## Depuración

Si encuentras errores:

1. Asegúrate de que el entorno virtual está activado
2. Verifica que todas las dependencias están instaladas (`npm install`)
3. Comprueba que el servidor MCP y el cliente se están ejecutando
4. Revisa los registros para identificar errores específicos

## Funcionalidad de Voz con OpenAI Whisper

La aplicación cuenta con una integración completa con la API de OpenAI Whisper para transcripción de audio a texto.

### Configuración de Whisper

1. Asegúrate de tener tu API key de OpenAI en el archivo `.env`:
```
OPENAI_API_KEY=tu-api-key-aquí
```

2. El sistema está configurado para intentar usar la API de OpenAI Whisper, pero caerá automáticamente a un modo simulado si ocurren errores de conexión o si la API key no está configurada.

### Solución de problemas con Whisper

Si encuentras errores como `ECONNRESET` o `Connection error` al usar la API de Whisper:

1. **Verifica tu conexión a Internet** - La API de OpenAI requiere una conexión estable
2. **Revisa el formato de audio** - Los formatos óptimos son mp3, mp4, mpeg, mpga, m4a, wav y webm
3. **Comprueba el tamaño del archivo** - OpenAI acepta archivos de hasta 25MB
4. **Verifica tu API key** - Asegúrate de que sea válida y esté correctamente configurada
5. **Revisa cuotas y límites** - Es posible que hayas alcanzado el límite de uso de tu cuenta

El sistema tiene un mecanismo de fallback que usará automáticamente respuestas simuladas cuando la API no esté disponible, lo que facilita el desarrollo y las pruebas.

Si necesitas forzar el uso del modo simulado, puedes hacerlo modificando `process.env.OPENAI_API_KEY` a undefined o a un valor inválido.