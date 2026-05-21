import type { EmbeddingClient, EmbedOptions } from './types';

const MAX_BATCH_COUNT = 96;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const ATTRIBUTION_REFERER = 'https://github.com/david46liu/obsidian-knowledge-ai';
const ATTRIBUTION_TITLE = 'Obsidian Knowledge AI';

export class BatchTooLargeError extends Error {
  constructor(count: number) {
    super(`Batch too large: ${count} texts (max ${MAX_BATCH_COUNT})`);
    this.name = 'BatchTooLargeError';
  }
}

export interface OpenRouterEmbeddingClientConfig {
  apiKey: string;
  model: string;
}

export class OpenRouterEmbeddingClient implements EmbeddingClient {
  readonly modelId: string;
  readonly dimensions: number = 0;

  constructor(private readonly cfg: OpenRouterEmbeddingClientConfig) {
    this.modelId = `openrouter/${cfg.model}`;
  }

  async embedDocuments(texts: string[], opts?: EmbedOptions): Promise<number[][]> {
    if (texts.length > MAX_BATCH_COUNT) throw new BatchTooLargeError(texts.length);
    return this.callAPI(texts, opts);
  }

  async embedQuery(text: string, opts?: EmbedOptions): Promise<number[]> {
    const result = await this.callAPI([text], opts);
    return result[0];
  }

  private async callAPI(texts: string[], opts?: EmbedOptions): Promise<number[][]> {
    const res = await fetch(`${OPENROUTER_BASE_URL}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.cfg.apiKey}`,
        'Content-Type': 'application/json',
        // OpenRouter attribution headers (optional but recommended)
        'HTTP-Referer': ATTRIBUTION_REFERER,
        'X-Title': ATTRIBUTION_TITLE,
      },
      body: JSON.stringify({ model: this.cfg.model, input: texts }),
      signal: opts?.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OpenRouter embedding error ${res.status}: ${body}`);
    }

    const json = await res.json() as { data: Array<{ index: number; embedding: number[] }> };
    const result: number[][] = new Array(texts.length);
    for (const item of json.data) {
      result[item.index] = item.embedding;
    }
    return result;
  }
}
