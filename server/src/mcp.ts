import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import db from './database.js'

export interface MCPServer {
    id: number
    user_id: number
    name: string
    transport_type: 'stdio' | 'sse' | 'streamable_http'
    command?: string
    args?: string // JSON array
    env?: string // JSON object
    url?: string
    enabled: boolean
    created_at: string
    updated_at: string
}

export interface MCPTool {
    name: string
    description?: string
    inputSchema: any
}

export interface MCPResource {
    uri: string
    name: string
    description?: string
    mimeType?: string
}

export interface MCPPrompt {
    name: string
    description?: string
    arguments?: Array<{ name: string; description?: string; required?: boolean }>
}

// Cache for MCP clients per user
const clientCache = new Map<string, { client: Client; server: MCPServer }>()

/**
 * Get cache key for a server
 */
function getCacheKey(userId: number, serverId: number): string {
    return `${userId}:${serverId}`
}

/**
 * Create and connect to an MCP server
 */
async function connectToServer(server: MCPServer): Promise<Client> {
    const client = new Client({
        name: 'ai-chat-client',
        version: '1.0.0'
    })

    let transport

    switch (server.transport_type) {
        case 'stdio':
            if (!server.command) {
                throw new Error('Command is required for stdio transport')
            }
            transport = new StdioClientTransport({
                command: server.command,
                args: server.args ? JSON.parse(server.args) : [],
                env: server.env ? JSON.parse(server.env) : undefined
            })
            break

        case 'sse':
            if (!server.url) {
                throw new Error('URL is required for SSE transport')
            }
            transport = new SSEClientTransport(new URL(server.url))
            break

        case 'streamable_http':
            if (!server.url) {
                throw new Error('URL is required for Streamable HTTP transport')
            }
            transport = new StreamableHTTPClientTransport(new URL(server.url))
            break

        default:
            throw new Error(`Unsupported transport type: ${server.transport_type}`)
    }

    await client.connect(transport)
    return client
}

/**
 * Get or create MCP client for a server
 */
async function getClient(userId: number, serverId: number): Promise<Client> {
    const cacheKey = getCacheKey(userId, serverId)
    
    // Check cache
    const cached = clientCache.get(cacheKey)
    if (cached) {
        return cached.client
    }

    // Get server config from database
    const server = db.prepare(`
        SELECT * FROM mcp_servers 
        WHERE id = ? AND user_id = ? AND enabled = 1
    `).get(serverId, userId) as MCPServer | undefined

    if (!server) {
        throw new Error('MCP server not found or disabled')
    }

    // Connect to server
    const client = await connectToServer(server)
    
    // Cache the client
    clientCache.set(cacheKey, { client, server })
    
    return client
}

/**
 * Get all enabled MCP servers for a user
 */
export function getUserMCPServers(userId: number): MCPServer[] {
    return db.prepare(`
        SELECT * FROM mcp_servers 
        WHERE user_id = ? 
        ORDER BY name ASC
    `).all(userId) as MCPServer[]
}

/**
 * Get a single MCP server
 */
export function getMCPServer(serverId: number, userId: number): MCPServer | undefined {
    return db.prepare(`
        SELECT * FROM mcp_servers 
        WHERE id = ? AND user_id = ?
    `).get(serverId, userId) as MCPServer | undefined
}

/**
 * Create a new MCP server configuration
 */
export function createMCPServer(userId: number, config: Omit<MCPServer, 'id' | 'user_id' | 'created_at' | 'updated_at'>): number {
    const result = db.prepare(`
        INSERT INTO mcp_servers (user_id, name, transport_type, command, args, env, url, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        userId,
        config.name,
        config.transport_type,
        config.command || null,
        config.args || null,
        config.env || null,
        config.url || null,
        config.enabled ? 1 : 0
    )

    return result.lastInsertRowid as number
}

/**
 * Update an MCP server configuration
 */
export function updateMCPServer(serverId: number, userId: number, config: Partial<Omit<MCPServer, 'id' | 'user_id' | 'created_at'>>): void {
    const updates: string[] = []
    const values: any[] = []

    if (config.name !== undefined) {
        updates.push('name = ?')
        values.push(config.name)
    }
    if (config.transport_type !== undefined) {
        updates.push('transport_type = ?')
        values.push(config.transport_type)
    }
    if (config.command !== undefined) {
        updates.push('command = ?')
        values.push(config.command || null)
    }
    if (config.args !== undefined) {
        updates.push('args = ?')
        values.push(config.args || null)
    }
    if (config.env !== undefined) {
        updates.push('env = ?')
        values.push(config.env || null)
    }
    if (config.url !== undefined) {
        updates.push('url = ?')
        values.push(config.url || null)
    }
    if (config.enabled !== undefined) {
        updates.push('enabled = ?')
        values.push(config.enabled ? 1 : 0)
    }

    if (updates.length === 0) return

    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(serverId, userId)

    db.prepare(`
        UPDATE mcp_servers 
        SET ${updates.join(', ')}
        WHERE id = ? AND user_id = ?
    `).run(...values)

    // Clear cache for this server
    const cacheKey = getCacheKey(userId, serverId)
    const cached = clientCache.get(cacheKey)
    if (cached) {
        // Disconnect old client
        try {
            cached.client.close()
        } catch (error) {
            console.error('Error closing MCP client:', error)
        }
        clientCache.delete(cacheKey)
    }
}

/**
 * Delete an MCP server configuration
 */
export function deleteMCPServer(serverId: number, userId: number): void {
    // Clear cache
    const cacheKey = getCacheKey(userId, serverId)
    const cached = clientCache.get(cacheKey)
    if (cached) {
        try {
            cached.client.close()
        } catch (error) {
            console.error('Error closing MCP client:', error)
        }
        clientCache.delete(cacheKey)
    }

    // Delete from database
    db.prepare(`
        DELETE FROM mcp_servers 
        WHERE id = ? AND user_id = ?
    `).run(serverId, userId)
}

/**
 * List available tools from an MCP server
 */
export async function listMCPTools(userId: number, serverId: number): Promise<MCPTool[]> {
    const client = await getClient(userId, serverId)
    const response = await client.listTools()
    
    return response.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
    }))
}

/**
 * Call a tool on an MCP server
 */
export async function callMCPTool(userId: number, serverId: number, toolName: string, args: any): Promise<any> {
    const client = await getClient(userId, serverId)
    const response = await client.callTool({
        name: toolName,
        arguments: args
    })
    
    return response
}

/**
 * List available resources from an MCP server
 */
export async function listMCPResources(userId: number, serverId: number): Promise<MCPResource[]> {
    const client = await getClient(userId, serverId)
    const response = await client.listResources()
    
    return response.resources.map(resource => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType
    }))
}

/**
 * Read a resource from an MCP server
 */
export async function readMCPResource(userId: number, serverId: number, uri: string): Promise<any> {
    const client = await getClient(userId, serverId)
    const response = await client.readResource({ uri })
    
    return response
}

/**
 * List available prompts from an MCP server
 */
export async function listMCPPrompts(userId: number, serverId: number): Promise<MCPPrompt[]> {
    const client = await getClient(userId, serverId)
    const response = await client.listPrompts()
    
    return response.prompts.map(prompt => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments
    }))
}

/**
 * Get a prompt from an MCP server
 */
export async function getMCPPrompt(userId: number, serverId: number, promptName: string, args?: any): Promise<any> {
    const client = await getClient(userId, serverId)
    const response = await client.getPrompt({
        name: promptName,
        arguments: args
    })
    
    return response
}

/**
 * Test connection to an MCP server
 */
export async function testMCPConnection(config: Omit<MCPServer, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; error?: string }> {
    try {
        const tempServer: MCPServer = {
            id: 0,
            user_id: 0,
            ...config,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }

        const client = await connectToServer(tempServer)
        
        // Try to list tools to verify connection
        await client.listTools()
        
        // Close the test connection
        client.close()
        
        return { success: true }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

/**
 * Get all available tools from all enabled servers for a user
 */
export async function getAllUserMCPTools(userId: number): Promise<Array<MCPTool & { serverId: number; serverName: string }>> {
    const servers = getUserMCPServers(userId).filter(s => s.enabled)
    const allTools: Array<MCPTool & { serverId: number; serverName: string }> = []

    for (const server of servers) {
        try {
            const tools = await listMCPTools(userId, server.id)
            allTools.push(...tools.map(tool => ({
                ...tool,
                serverId: server.id,
                serverName: server.name
            })))
        } catch (error) {
            console.error(`Error listing tools from server ${server.name}:`, error)
        }
    }

    return allTools
}

/**
 * Clear all cached clients for a user
 */
export function clearUserMCPCache(userId: number): void {
    const keysToDelete: string[] = []
    
    for (const [key, cached] of clientCache.entries()) {
        if (cached.server.user_id === userId) {
            try {
                cached.client.close()
            } catch (error) {
                console.error('Error closing MCP client:', error)
            }
            keysToDelete.push(key)
        }
    }
    
    keysToDelete.forEach(key => clientCache.delete(key))
}

