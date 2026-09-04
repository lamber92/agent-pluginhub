/**
 * Typed IPC Client for Webview to VS Code Extension Host
 */

declare function acquireVsCodeApi(): {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
};

interface BridgeResponse<T = any> {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
}

class BridgeClient {
  private vscodeApi: any = null;
  private pendingRequests: Map<string, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();
  private eventListeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor() {
    if (typeof acquireVsCodeApi === 'function') {
      try {
        this.vscodeApi = acquireVsCodeApi();
      } catch (e) {
        console.warn('acquireVsCodeApi already called or unavailable', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('message', (event) => {
        const msg = event.data;
        if (!msg) return;

        // Check if it's a response to a pending request
        if (msg.id && this.pendingRequests.has(msg.id)) {
          const { resolve, reject } = this.pendingRequests.get(msg.id)!;
          this.pendingRequests.delete(msg.id);
          if (msg.success) {
            resolve(msg.data);
          } else {
            reject(new Error(msg.error || 'Unknown extension bridge error'));
          }
          return;
        }

        // Check if it's an event broadcast
        if (msg.event && this.eventListeners.has(msg.event)) {
          const listeners = this.eventListeners.get(msg.event)!;
          for (const listener of listeners) {
            try {
              listener(msg.data);
            } catch (err) {
              console.error(`Error in event listener for ${msg.event}:`, err);
            }
          }
        }
      });
    }
  }

  private safeClone(data: any): any {
    if (data === undefined || data === null) return data;
    try {
      return JSON.parse(JSON.stringify(data));
    } catch {
      return data;
    }
  }

  /**
   * Invoke a backend action and await response
   */
  public async invoke<T = any>(action: string, payload?: any): Promise<T> {
    const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    if (!this.vscodeApi) {
      console.warn(`[Dev Mock] Invoking action: ${action}`, payload);
      // In browser preview mode, simulate responses
      return this.mockAction(action, payload);
    }

    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      // Strip out Vue 3 Proxy and uncloneable references
      const safePayload = this.safeClone(payload);
      
      this.vscodeApi.postMessage({
        id,
        action,
        payload: safePayload
      });

      // 120s Timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Action timeout for: ${action}`));
        }
      }, 120000);
    });
  }

  /**
   * Subscribe to broadcast events from Extension Host
   */
  public on(event: string, callback: (data: any) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    return () => {
      const set = this.eventListeners.get(event);
      if (set) set.delete(callback);
    };
  }

  private mockAction(action: string, payload: any): any {
    if (action === 'getMarketplace' || action === 'getMarketplacePlugins') {
      return [
        {
          name: 'claude-code-reviewer',
          description: 'Automated PR and commit reviewer skill tailored for Antigravity Agent.',
          category: 'development',
          author: { name: 'Anthropic Official' },
          tags: ['review', 'git', 'quality'],
          source: { source: 'url', url: 'https://github.com/anthropics/claude-plugins-official' },
          sourceId: 'official-claude-plugins',
          sourceName: 'Anthropic Official Marketplace',
          version: '1.0.0',
          installed: false
        },
        {
          name: 'postgres-dba-toolkit',
          description: 'Database schema inspection, query optimization, and migration skill.',
          category: 'data',
          author: { name: 'Postgres Community' },
          tags: ['sql', 'postgres', 'database'],
          source: { source: 'url', url: 'https://github.com/anthropics/claude-plugins-official' },
          sourceId: 'official-claude-plugins',
          sourceName: 'Anthropic Official Marketplace',
          version: '1.0.0',
          installed: false
        },
        {
          name: 'docker-devops-assistant',
          description: 'Docker compose generator, container health inspector, and k8s manifest builder.',
          category: 'devops',
          author: { name: 'DevOps Guild' },
          tags: ['docker', 'k8s', 'devops'],
          source: { source: 'url', url: 'https://github.com/anthropics/claude-plugins-official' },
          sourceId: 'official-claude-plugins',
          sourceName: 'Anthropic Official Marketplace',
          version: '1.0.0',
          installed: false
        }
      ];
    }
    if (action === 'getSources') {
      return [
        {
          id: 'official-claude-plugins',
          name: 'Anthropic Official Marketplace',
          type: 'official',
          location: 'anthropics/claude-plugins-official',
          branch: 'main',
          enabled: true,
          isDefault: true
        }
      ];
    }
    if (action === 'getLocalSkills') {
      return [];
    }
    if (action === 'getSettings') {
      return {
        githubToken: '',
        mirrorAcceleration: true,
        proxyUrl: '',
        defaultInstallScope: 'ask'
      };
    }
    if (action === 'getWorkspaceFolders') {
      return [{ name: 'agent-pluginhub', path: 'd:/project/agent-pluginhub', index: 0 }];
    }
    return { success: true };
  }
}

export const bridge = new BridgeClient();
