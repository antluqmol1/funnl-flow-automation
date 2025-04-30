import express, { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase'; // Para validación de usuario
import { initMCP } from '../lib/utils';
import { MCPClient } from '../../mcpClient';
import { z } from 'zod'; // Para validación de entrada

const router = express.Router();

// Esquema de validación para el objeto de acción esperado
const actionSchema = z.object({
    id: z.string(),
    description: z.string(),
    mcp_tool: z.string(),
    arguments: z.record(z.unknown()), // Objeto con claves string y valores any
    confirmation_required: z.boolean(),
});

type ActionPayload = z.infer<typeof actionSchema>;

/**
 * Ruta para ejecutar una acción sugerida a través de MCP.
 * Método: POST
 * Ruta: /execute
 * Body: { action: ActionPayload }
 */
router.post('/execute', async (req: Request, res: Response, next: NextFunction) => {
    console.log('[Routes][Actions] Solicitud POST /execute recibida.');

    // 1. Validar Input
    const actionFromBody = req.body.action;
    const validationResult = actionSchema.safeParse(actionFromBody);

    if (!validationResult.success) {
        console.error('[Routes][Actions] Payload de acción inválido:', validationResult.error.errors);
        return res.status(400).json({
            error: 'Payload de acción inválido.',
            details: validationResult.error.format()
        });
    }

    const action: ActionPayload = validationResult.data;
    console.log(`[Routes][Actions] Acción a ejecutar: ${action.mcp_tool} con ID ${action.id}`);

    // 2. Validar Usuario
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Falta cabecera de autorización' });
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Token de autorización mal formado' });
    }

    let userId: string | null = null;
    try {
        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData?.user) {
            console.error('[Routes][Actions] Error de autenticación:', userError);
            return res.status(401).json({ error: 'Token inválido o usuario no encontrado', details: userError?.message });
        }
        userId = userData.user.id;
        console.log(`[Routes][Actions] Usuario ${userId} validado para ejecutar acción.`);
    } catch (authError) {
        console.error('[Routes][Actions] Excepción durante la validación de usuario:', authError);
        return res.status(500).json({ error: 'Error interno al validar usuario' });
    }

    // 3. Inicializar MCP Client
    let mcpClient: MCPClient;
    try {
        mcpClient = await initMCP();
    } catch (mcpInitError) {
        console.error('[Routes][Actions] Error inicializando MCPClient:', mcpInitError);
        return res.status(500).json({ error: 'No se pudo conectar con el servicio de acciones (MCP).' });
    }

    // 4. Ejecutar Herramienta MCP
    try {
        console.log(`[Routes][Actions] Llamando a MCP tool: ${action.mcp_tool} con args:`, action.arguments);
        const result = await mcpClient.callMCPToolDirectly(action.mcp_tool, action.arguments);
        console.log(`[Routes][Actions] Resultado de MCP tool ${action.mcp_tool}:`, result);

        // Verificar si el resultado de MCP indica un error interno de la herramienta
        if (result && result.error) {
            console.error(`[Routes][Actions] La herramienta MCP ${action.mcp_tool} devolvió un error:`, result.error);
            return res.status(400).json({
                error: `La acción '${action.description}' falló.`,
                details: result.error // Devolver el error específico de la herramienta
            });
        }

        // Si todo va bien, devolver éxito y el resultado de la herramienta
        return res.status(200).json({
            message: `Acción '${action.description}' ejecutada correctamente.`,
            result: result // Incluir el resultado para posible uso en frontend
        });

    } catch (mcpCallError: any) {
        console.error(`[Routes][Actions] Error al llamar a MCP tool ${action.mcp_tool}:`, mcpCallError);
        // Devolver un error genérico pero informativo
        return res.status(500).json({
            error: `Error al ejecutar la acción '${action.description}'.`,
            details: mcpCallError.message || 'Error desconocido en la comunicación con MCP.'
        });
    }
});

export default router; 