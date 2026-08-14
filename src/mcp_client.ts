/**
 * MCP Client Wrapper for Google Workspace MCP Server
 * 
 * Uses raw SSE (EventSource) transport to communicate with the MCP server.
 * This bypasses the @modelcontextprotocol/sdk's strict inputSchema validation
 * which fails on servers that don't include `type: "object"` in their tool schemas.
 */
import { EventSource } from 'eventsource';

export interface MCPToolResult {
  content: Array<{ type: string; text: string }>;
}

export interface MCPToolError {
  error: string;
}

export type MCPToolResponse = MCPToolResult | MCPToolError;

export function isMCPError(response: MCPToolResponse): response is MCPToolError {
  return 'error' in response;
}

export class MCPClient {
  private serverUrl: string;
  private es: InstanceType<typeof EventSource> | null = null;
  private messageEndpoint: string | null = null;
  private nextId = 1;
  private pendingRequests = new Map<number, {
    resolve: (val: any) => void;
    reject: (err: any) => void;
  }>();
  private connected = false;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  /**
   * Connect to the MCP server via SSE, perform initialize handshake.
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    return new Promise((resolve, reject) => {
      const sseUrl = `${this.serverUrl}/sse`;
      console.log(`[MCP] Connecting to ${sseUrl}...`);

      this.es = new EventSource(sseUrl);

      const timeout = setTimeout(() => {
        reject(new Error('[MCP] Connection timeout after 30 seconds'));
      }, 30000);

      this.es.addEventListener('endpoint', async (event: MessageEvent) => {
        this.messageEndpoint = new URL(event.data, this.serverUrl).toString();
        console.log(`[MCP] SSE connected. Message endpoint: ${this.messageEndpoint}`);

        try {
          // Initialize handshake
          const initResult = await this.sendRequest('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'feedback-pulse-client', version: '1.0.0' }
          });
          console.log(`[MCP] Server: ${initResult.serverInfo?.name} v${initResult.serverInfo?.version}`);

          // Send initialized notification
          await this.sendNotification('notifications/initialized', {});

          this.connected = true;
          clearTimeout(timeout);
          resolve();
        } catch (e) {
          clearTimeout(timeout);
          reject(e);
        }
      });

      this.es.addEventListener('message', (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        if (data.id && this.pendingRequests.has(data.id)) {
          const handler = this.pendingRequests.get(data.id)!;
          this.pendingRequests.delete(data.id);
          if (data.error) {
            handler.reject(new Error(`MCP error ${data.error.code}: ${data.error.message}`));
          } else {
            handler.resolve(data.result);
          }
        }
      });

      this.es.onerror = (err: Event) => {
        const msg = (err as any).message || 'SSE connection error';
        if (!this.connected) {
          clearTimeout(timeout);
          reject(new Error(`[MCP] SSE Error: ${msg}`));
        } else {
          console.error(`[MCP] SSE Error: ${msg}`);
        }
      };
    });
  }

  /**
   * Send a JSON-RPC request and wait for the response.
   */
  private async sendRequest(method: string, params: any): Promise<any> {
    if (!this.messageEndpoint) {
      throw new Error('[MCP] Not connected — no message endpoint');
    }

    const id = this.nextId++;
    return new Promise(async (resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      // Set a per-request timeout
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`[MCP] Request ${method} (id=${id}) timed out after 30s`));
        }
      }, 30000);

      try {
        const resp = await fetch(this.messageEndpoint!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
        });

        if (!resp.ok && resp.status !== 202) {
          this.pendingRequests.delete(id);
          clearTimeout(timeout);
          reject(new Error(`[MCP] HTTP ${resp.status} for ${method}`));
        }
      } catch (e) {
        this.pendingRequests.delete(id);
        clearTimeout(timeout);
        reject(e);
      }

      // Clear timeout when resolved/rejected
      const origResolve = this.pendingRequests.get(id)?.resolve;
      if (origResolve) {
        this.pendingRequests.set(id, {
          resolve: (val) => { clearTimeout(timeout); resolve(val); },
          reject: (err) => { clearTimeout(timeout); reject(err); }
        });
      }
    });
  }

  /**
   * Send a JSON-RPC notification (no response expected).
   */
  private async sendNotification(method: string, params: any): Promise<void> {
    if (!this.messageEndpoint) {
      throw new Error('[MCP] Not connected — no message endpoint');
    }

    await fetch(this.messageEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params })
    });
  }

  /**
   * Call an MCP tool by name with the given arguments.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResponse> {
    if (!this.connected) {
      throw new Error('[MCP] Client not connected. Call connect() first.');
    }

    console.log(`[MCP] Calling tool: ${name}`);
    try {
      const result = await this.sendRequest('tools/call', {
        name,
        arguments: args
      });
      return result as MCPToolResult;
    } catch (e: any) {
      return { error: e.message || String(e) };
    }
  }

  /**
   * Disconnect from the MCP server.
   */
  async disconnect(): Promise<void> {
    if (this.es) {
      this.es.close();
      this.es = null;
    }
    this.connected = false;
    this.messageEndpoint = null;
    this.pendingRequests.clear();
    console.log('[MCP] Disconnected.');
  }
}
