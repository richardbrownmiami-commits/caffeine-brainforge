export interface BrainForgeConfig {
  apiUrl?: string;
  secret?: string;
  projectId?: string;
}

export interface ChatOptions {
  message: string;
  projectId?: string;
  model?: string;
}

export interface ChatResponse {
  reply: string;
  model: string;
  tokens?: number;
}

export class BrainForge {
  private apiUrl: string;
  private secret: string;
  private defaultProjectId: string;

  constructor(config: BrainForgeConfig = {}) {
    this.apiUrl = config.apiUrl || process.env.BRAINFORGE_API_URL || 'https://brainforge-api.richard-brown-miami.workers.dev';
    this.secret = config.secret || process.env.BRAINFORGE_SECRET || '';
    this.defaultProjectId = config.projectId || process.env.BRAINFORGE_PROJECT_ID || 'default';
  }

  private async request(path: string, method: string = 'GET', body?: unknown): Promise<unknown> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Secret': this.secret,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`BrainForge API error: ${res.status}`);
    return res.json();
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    return this.request('/api/ai', 'POST', {
      message: options.message,
      projectId: options.projectId || this.defaultProjectId,
      model: options.model,
    }) as Promise<ChatResponse>;
  }

  async status(): Promise<unknown> {
    return this.request('/api/status');
  }

  async health(): Promise<unknown> {
    return this.request('/api/health');
  }
}

export default BrainForge;
