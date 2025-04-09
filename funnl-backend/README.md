# Cliente MCP - Guía de Uso

## Requisitos Previos
- Asegúrate de estar en el directorio `~/automated-funnl`
- Tener el entorno virtual configurado

## Pasos de Ejecución

1. Activar el entorno virtual:
```bash
source ./mcp-server/.venv/bin/activate
```

2. Ejecutar el cliente MCP:
```bash
node ./funnl-backend/build/mcpClient.js ./mcp-server/main.py
```

## Resultado Esperado

Al ejecutar correctamente, verás un mensaje similar a:

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

Para salir del cliente, simplemente escribe `quit` en la línea de comandos.