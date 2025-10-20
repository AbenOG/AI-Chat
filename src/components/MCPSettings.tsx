import { useState, useEffect } from 'react'
import { Plus, Trash2, Power, PowerOff, CheckCircle, XCircle, Loader2, Server, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { api } from '@/services/api'
import type { MCPServer } from '@/types'

export function MCPSettings() {
    const [servers, setServers] = useState<MCPServer[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddForm, setShowAddForm] = useState(false)
    const [editingServer, setEditingServer] = useState<MCPServer | null>(null)
    
    // Form state
    const [name, setName] = useState('')
    const [transportType, setTransportType] = useState<'stdio' | 'sse' | 'streamable_http'>('stdio')
    const [command, setCommand] = useState('')
    const [args, setArgs] = useState('')
    const [env, setEnv] = useState('')
    const [url, setUrl] = useState('')
    const [showEnv, setShowEnv] = useState(false)
    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        loadServers()
    }, [])

    const loadServers = async () => {
        try {
            setLoading(true)
            const response = await api.getMCPServers()
            setServers(response.servers)
        } catch (error) {
            console.error('Failed to load MCP servers:', error)
        } finally {
            setLoading(false)
        }
    }

    const resetForm = () => {
        setName('')
        setTransportType('stdio')
        setCommand('')
        setArgs('')
        setEnv('')
        setUrl('')
        setShowEnv(false)
        setTestResult(null)
        setError(null)
        setEditingServer(null)
    }

    const handleEdit = (server: MCPServer) => {
        setEditingServer(server)
        setName(server.name)
        setTransportType(server.transport_type)
        setCommand(server.command || '')
        setArgs(server.args || '')
        setEnv(server.env || '')
        setUrl(server.url || '')
        setShowAddForm(true)
        setTestResult(null)
        setError(null)
    }

    const handleTest = async () => {
        setTesting(true)
        setTestResult(null)
        setError(null)

        try {
            const result = await api.testMCPConnection({
                name,
                transport_type: transportType,
                command: transportType === 'stdio' ? command : undefined,
                args: transportType === 'stdio' && args ? args : undefined,
                env: transportType === 'stdio' && env ? env : undefined,
                url: transportType !== 'stdio' ? url : undefined
            })
            setTestResult(result)
        } catch (error) {
            setTestResult({
                success: false,
                error: error instanceof Error ? error.message : 'Test failed'
            })
        } finally {
            setTesting(false)
        }
    }

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Server name is required')
            return
        }

        if (transportType === 'stdio' && !command.trim()) {
            setError('Command is required for stdio transport')
            return
        }

        if (transportType !== 'stdio' && !url.trim()) {
            setError('URL is required for this transport type')
            return
        }

        setSaving(true)
        setError(null)

        try {
            const config = {
                name,
                transport_type: transportType,
                command: transportType === 'stdio' ? command : undefined,
                args: transportType === 'stdio' && args ? args : undefined,
                env: transportType === 'stdio' && env ? env : undefined,
                url: transportType !== 'stdio' ? url : undefined,
                enabled: true
            }

            if (editingServer) {
                await api.updateMCPServer(editingServer.id, config)
            } else {
                await api.createMCPServer(config)
            }

            await loadServers()
            setShowAddForm(false)
            resetForm()
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to save server')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (serverId: number) => {
        if (!confirm('Are you sure you want to delete this MCP server?')) return

        try {
            await api.deleteMCPServer(serverId)
            await loadServers()
        } catch (error) {
            console.error('Failed to delete server:', error)
        }
    }

    const handleToggleEnabled = async (server: MCPServer) => {
        try {
            await api.updateMCPServer(server.id, { enabled: !server.enabled })
            await loadServers()
        } catch (error) {
            console.error('Failed to toggle server:', error)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-white/60" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-foreground">MCP Servers</h3>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                        Connect to Model Context Protocol servers for extended capabilities
                    </p>
                </div>
                {!showAddForm && (
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-foreground hover:bg-white/15 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Server
                    </button>
                )}
            </div>

            {/* Add/Edit Form */}
            {showAddForm && (
                <div className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-4">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-md font-semibold text-foreground">
                            {editingServer ? 'Edit MCP Server' : 'Add MCP Server'}
                        </h4>
                        <button
                            onClick={() => {
                                setShowAddForm(false)
                                resetForm()
                            }}
                            className="text-muted-foreground/70 hover:text-foreground transition-colors"
                        >
                            ✕
                        </button>
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Server Name */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Server Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="My MCP Server"
                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-white/30 transition-colors"
                        />
                    </div>

                    {/* Transport Type */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Transport Type *
                        </label>
                        <select
                            value={transportType}
                            onChange={(e) => setTransportType(e.target.value as any)}
                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground focus:outline-none focus:border-white/30 transition-colors"
                        >
                            <option value="stdio">Standard I/O (Local Process)</option>
                            <option value="sse">SSE (Server-Sent Events)</option>
                            <option value="streamable_http">Streamable HTTP</option>
                        </select>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                            {transportType === 'stdio' && 'Run MCP server as a local process'}
                            {transportType === 'sse' && 'Connect to remote MCP server via SSE (legacy)'}
                            {transportType === 'streamable_http' && 'Connect to remote MCP server via HTTP'}
                        </p>
                    </div>

                    {/* Stdio Config */}
                    {transportType === 'stdio' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Command *
                                </label>
                                <input
                                    type="text"
                                    value={command}
                                    onChange={(e) => setCommand(e.target.value)}
                                    placeholder="node"
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-white/30 transition-colors"
                                />
                                <p className="text-xs text-muted-foreground/60 mt-1">
                                    Executable command (e.g., node, python, npx)
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Arguments (JSON array)
                                </label>
                                <input
                                    type="text"
                                    value={args}
                                    onChange={(e) => setArgs(e.target.value)}
                                    placeholder='["server.js", "--port", "3000"]'
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-white/30 transition-colors font-mono text-sm"
                                />
                                <p className="text-xs text-muted-foreground/60 mt-1">
                                    Optional: Command arguments as JSON array
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                                    Environment Variables (JSON object)
                                    <button
                                        type="button"
                                        onClick={() => setShowEnv(!showEnv)}
                                        className="text-muted-foreground/60 hover:text-foreground transition-colors"
                                    >
                                        {showEnv ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </label>
                                <input
                                    type={showEnv ? 'text' : 'password'}
                                    value={env}
                                    onChange={(e) => setEnv(e.target.value)}
                                    placeholder='{"API_KEY": "secret"}'
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-white/30 transition-colors font-mono text-sm"
                                />
                                <p className="text-xs text-muted-foreground/60 mt-1">
                                    Optional: Environment variables as JSON object
                                </p>
                            </div>
                        </>
                    )}

                    {/* HTTP/SSE Config */}
                    {transportType !== 'stdio' && (
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                                Server URL *
                            </label>
                            <input
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="http://localhost:3000/mcp"
                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-white/30 transition-colors"
                            />
                            <p className="text-xs text-muted-foreground/60 mt-1">
                                Full URL to the MCP server endpoint
                            </p>
                        </div>
                    )}

                    {/* Test Result */}
                    {testResult && (
                        <div className={`p-3 rounded-lg border flex items-start gap-2 ${
                            testResult.success 
                                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                : 'bg-red-500/10 border-red-500/30 text-red-400'
                        }`}>
                            {testResult.success ? (
                                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            ) : (
                                <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            )}
                            <div className="text-sm">
                                {testResult.success ? (
                                    <span>Connection successful!</span>
                                ) : (
                                    <div>
                                        <div className="font-medium">Connection failed</div>
                                        {testResult.error && (
                                            <div className="text-xs mt-1 opacity-80">{testResult.error}</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={handleTest}
                            disabled={testing || !name.trim()}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {testing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Server className="w-4 h-4" />
                            )}
                            Test Connection
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || testing}
                            className="flex-1 px-4 py-2 rounded-lg bg-white/15 border border-white/30 text-foreground hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                        >
                            {saving ? 'Saving...' : editingServer ? 'Update Server' : 'Add Server'}
                        </button>
                    </div>
                </div>
            )}

            {/* Server List */}
            {servers.length === 0 && !showAddForm ? (
                <div className="text-center py-12">
                    <Server className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                    <p className="text-muted-foreground/70">No MCP servers configured</p>
                    <p className="text-sm text-muted-foreground/50 mt-1">
                        Add a server to extend AI capabilities with tools, resources, and prompts
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {servers.map((server) => (
                        <div
                            key={server.id}
                            className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h4 className="text-sm font-semibold text-foreground">
                                            {server.name}
                                        </h4>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                            server.enabled
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-gray-500/20 text-gray-400'
                                        }`}>
                                            {server.enabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                        <span className="px-2 py-0.5 rounded bg-white/10 text-xs text-muted-foreground/70">
                                            {server.transport_type === 'stdio' && 'Local Process'}
                                            {server.transport_type === 'sse' && 'SSE'}
                                            {server.transport_type === 'streamable_http' && 'HTTP'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground/60">
                                        {server.transport_type === 'stdio' && server.command && (
                                            <span className="font-mono">{server.command}</span>
                                        )}
                                        {server.transport_type !== 'stdio' && server.url && (
                                            <span className="font-mono">{server.url}</span>
                                        )}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleToggleEnabled(server)}
                                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                                        title={server.enabled ? 'Disable' : 'Enable'}
                                    >
                                        {server.enabled ? (
                                            <Power className="w-4 h-4 text-green-400" />
                                        ) : (
                                            <PowerOff className="w-4 h-4 text-gray-400" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => handleEdit(server)}
                                        className="px-3 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-foreground hover:bg-white/10 transition-colors"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(server.id)}
                                        className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4 text-red-400" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Info Box */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
                <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-300/90">
                        <p className="font-medium mb-1">About MCP Servers</p>
                        <p className="text-blue-300/70 text-xs leading-relaxed">
                            Model Context Protocol (MCP) servers provide tools, resources, and prompts that extend AI capabilities.
                            Connect to local processes or remote servers to access file systems, databases, APIs, and more.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

