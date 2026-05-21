import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenRouterEmbeddingClient, BatchTooLargeError } from 'src/embedding/apiEmbeddingClient';

const FAKE_KEY = 'sk-or-test';
const FAKE_MODEL = 'mistralai/mistral-embed';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/embeddings';

function mockFetch(vectors: number[][]): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: vectors.map((v, i) => ({ index: i, embedding: v })),
    }),
  } as Response);
}

describe('OpenRouterEmbeddingClient', () => {
  let originalFetch: typeof fetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('embedDocuments returns vectors for each text', async () => {
    const vecs = [[1, 0, 0], [0, 1, 0]];
    globalThis.fetch = mockFetch(vecs);
    const client = new OpenRouterEmbeddingClient({ apiKey: FAKE_KEY, model: FAKE_MODEL });
    const result = await client.embedDocuments(['a', 'b']);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([1, 0, 0]);
  });

  it('embedQuery calls fetch with single-element array and returns first vector', async () => {
    globalThis.fetch = mockFetch([[0.5, 0.5]]);
    const client = new OpenRouterEmbeddingClient({ apiKey: FAKE_KEY, model: FAKE_MODEL });
    const result = await client.embedQuery('hello');
    expect(result).toEqual([0.5, 0.5]);
  });

  it('targets the OpenRouter embeddings endpoint and sends attribution headers', async () => {
    globalThis.fetch = mockFetch([[1]]);
    const client = new OpenRouterEmbeddingClient({ apiKey: FAKE_KEY, model: FAKE_MODEL });
    await client.embedQuery('test');
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(OPENROUTER_URL);
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${FAKE_KEY}`);
    expect(headers['HTTP-Referer']).toBeTruthy();
    expect(headers['X-Title']).toBeTruthy();
  });

  it('exposes a stable modelId namespaced under openrouter/', () => {
    const client = new OpenRouterEmbeddingClient({ apiKey: FAKE_KEY, model: FAKE_MODEL });
    expect(client.modelId).toBe(`openrouter/${FAKE_MODEL}`);
  });

  it('throws BatchTooLargeError when texts.length > 96', async () => {
    const client = new OpenRouterEmbeddingClient({ apiKey: FAKE_KEY, model: FAKE_MODEL });
    const texts = Array.from({ length: 97 }, (_, i) => `text ${i}`);
    await expect(client.embedDocuments(texts)).rejects.toBeInstanceOf(BatchTooLargeError);
  });

  it('respects AbortSignal', async () => {
    const controller = new AbortController();
    controller.abort();
    globalThis.fetch = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'));
    const client = new OpenRouterEmbeddingClient({ apiKey: FAKE_KEY, model: FAKE_MODEL });
    await expect(client.embedQuery('q', { signal: controller.signal }))
      .rejects.toMatchObject({ name: 'AbortError' });
  });

  it('throws on non-ok HTTP response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 401, text: async () => 'Unauthorized',
    } as Response);
    const client = new OpenRouterEmbeddingClient({ apiKey: FAKE_KEY, model: FAKE_MODEL });
    await expect(client.embedQuery('q')).rejects.toThrow('401');
  });
});
