// anthropic sdk
import { Anthropic } from "@anthropic-ai/sdk";
import {
    MessageParam,
    Tool
} from "@anthropic-ai/sdk/resources/messages.mjs"

// mcp sdk
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import dotenv from "dotenv";

dotenv.config();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
}

// export interface Tool {
//     name: string;
//     description: string;
//     input_schema: any;
// }

// export interface MessageParam {
//     role: "user" | "assistant" | string;
//     content: string;
// }



export class MCPClient {
    private mcp: Client;
    private llm: Anthropic;
    private transport: StdioClientTransport | null = null;
    private tools: Tool[] = [];
    private messageHistory: MessageParam[] = [];

    constructor() {
        this.llm = new Anthropic({
            apiKey: ANTHROPIC_API_KEY,
        });
        this.mcp = new Client({ name: "mcp-client-cli", version: "1.0.0" });
    }

    // Connect to the MCP
    async connectToServer(serverScriptPath: string) {
        const isJs = serverScriptPath.endsWith(".js");
        const isPy = serverScriptPath.endsWith(".py");
        if (!isJs && !isPy) {
            throw new Error("Server script must be a .js or .py file");
        }
        const command = isPy
            ? process.platform === "win32"
                ? "python"
                : "python3"
            : process.execPath;

        this.transport = new StdioClientTransport({
            command, // python /path/to/server.py or node /path/to/server.js
            args: [serverScriptPath],
        });
        await this.mcp.connect(this.transport);

        // Register tools
        const toolsResult = await this.mcp.listTools();
        this.tools = toolsResult.tools.map((tool) => {
            return {
                name: tool.name,
                description: tool.description,
                input_schema: tool.inputSchema
            };
        });

        console.log("Connected to MCP server with tools",
            this.tools.map(({ name }) => name).join(", ")
        );
    }

    // Process query
    async processQuery(query: string): Promise<string> {
        this.messageHistory.push({
            role: "user",
            content: query,
        });

        const response = await this.llm.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1000,
            messages: this.messageHistory,
            tools: this.tools,
        });

        // check the response
        const finalText: string[] = [];
        const toolResults = [];

        // if text -> return response
        for (const content of response.content) {
            if (content.type === "text") {
                finalText.push(content.text);
                this.messageHistory.push({
                    role: "assistant",
                    content: content.text,
                });
            } else if (content.type === "tool_use") {
                // if tool -> call the tool on mcp server
                const toolName = content.name;
                const toolArgs = content.input as { [x: string]: unknown } | undefined;

                const result = await this.mcp.callTool({
                    name: toolName,
                    arguments: toolArgs,
                });
                toolResults.push(result);
                const toolMessage = `[Calling tool ${toolName} with args ${JSON.stringify(toolArgs)}]`;
                finalText.push(toolMessage);

                this.messageHistory.push({
                    role: "user",
                    content: result.content as string,
                });

                const response = await this.llm.messages.create({
                    model: "claude-3-5-sonnet-20241022",
                    max_tokens: 1000,
                    messages: this.messageHistory,
                });

                const responseText = response.content[0].type === "text" ? response.content[0].text : "";
                finalText.push(responseText);

                this.messageHistory.push({
                    role: "assistant",
                    content: responseText,
                });
            }
        }

        return finalText.join("\n");
    }

    // Nuevo método para llamar directamente a una herramienta MCP
    async callMCPToolDirectly(toolName: string, toolArgs?: { [x: string]: unknown }): Promise<any> {
        console.log(`[MCPClient] Calling tool directly: ${toolName} with args:`, toolArgs);
        if (!this.mcp) {
            throw new Error("MCP client not connected.");
        }

        // Verificar si la herramienta existe (opcional pero recomendado)
        const toolExists = this.tools.some(tool => tool.name === toolName);
        if (!toolExists) {
            console.error(`[MCPClient] Attempted to call non-existent tool: ${toolName}`);
            // Listar herramientas disponibles para ayudar a depurar
            console.log("[MCPClient] Available tools:", this.tools.map(t => t.name));
            throw new Error(`Tool '${toolName}' not found or not registered by the MCP server.`);
        }

        try {
            const result = await this.mcp.callTool({
                name: toolName,
                arguments: toolArgs,
            });
            console.log(`[MCPClient] Result from direct call to ${toolName}:`, result);

            // --- INICIO: Lógica de procesamiento de resultado mejorada ---
            if (result && Array.isArray(result.content) && result.content.length > 0) {
                const firstContent = result.content[0];
                if (firstContent && firstContent.type === 'text' && typeof firstContent.text === 'string') {
                    // Encontramos el string JSON esperado
                    try {
                        const parsedJson = JSON.parse(firstContent.text);
                        console.log(`[MCPClient] Successfully parsed JSON from tool ${toolName}`);
                        return parsedJson; // Devolver el objeto parseado
                    } catch (e) {
                        console.error(`[MCPClient] Failed to parse JSON content from tool ${toolName}:`, e);
                        // Devolver error o el string crudo si falla el parseo?
                        // Por ahora, lanzamos un error para indicar el problema de formato
                        throw new Error(`Failed to parse JSON response from tool ${toolName}. Raw text: ${firstContent.text}`);
                    }
                } else {
                    // El primer elemento de content no tiene la estructura esperada
                    console.warn(`[MCPClient] Unexpected structure in result.content[0] for tool ${toolName}:`, firstContent);
                    // Devolver el contenido crudo del primer elemento si no es texto?
                    return firstContent;
                }
            } else if (result && typeof result.content !== 'undefined') {
                // Si result.content existe pero no es el array esperado, devolverlo tal cual
                console.warn(`[MCPClient] result.content for tool ${toolName} was not the expected array structure:`, result.content);
                return result.content;
            } else {
                // Si no hay content, devolver el objeto de resultado completo (o null/error?)
                console.warn(`[MCPClient] No content found in result for tool ${toolName}. Returning full result object.`);
                return result;
            }
            // --- FIN: Lógica de procesamiento de resultado mejorada ---

        } catch (error) {
            console.error(`[MCPClient] Error calling tool ${toolName} directly:`, error);
            throw error; // Re-lanzar el error para que el llamador lo maneje
        }
    }

    async chatLoop() {
        const readline = await import("readline/promises");
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        try {
            console.log("\nMCP Client Started!")
            console.log("Type your queries or 'quit' to exit.\n");
            while (true) {
                const message = await rl.question("Query: ");
                if (message.toLowerCase() === "quit") {
                    break;
                }
                const response = await this.processQuery(message);
                console.log("\n" + response);
            }
        } finally {
            rl.close();
        }
    }

    async cleanup() {
        await this.mcp.close();
        this.messageHistory = [];
    }
}

async function main() {
    if (process.argv.length < 3) {
        console.error("Usage: node index.js <server-script-path>");
        return;
    }
    const mcpClient = new MCPClient();
    try {
        await mcpClient.connectToServer(process.argv[2]);
        await mcpClient.chatLoop();
    } finally {
        await mcpClient.cleanup();
        process.exit(0);
    }
}

if (require.main === module) {
    main();
}
