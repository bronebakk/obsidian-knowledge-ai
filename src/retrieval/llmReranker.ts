import type { LLMClient, ChatOptions, ChatMessage } from 'src/providers/types';
import type { SearchHit } from 'src/types/data';
import type { Reranker } from 'src/retrieval/types';

const SYSTEM_PROMPT = [
  'You are a retrieval relevance scorer.',
  'For the user\'s question, judge how relevant each note candidate is.',
  'Output a JSON array sorted by relevance descending, with every candidate\'s index (the N from [N] in the user message) and a 0-10 score.',
].join('\n');

const MAX_CONTENT_CHARS = 300;

export class LLMReranker implements Reranker {
  readonly name = 'llm';

  constructor(
    private readonly client: LLMClient,
    private readonly model: string
  ) {}

  async rerank(query: string, candidates: SearchHit[]): Promise<SearchHit[]> {
    if (candidates.length === 0) return [];

    const userLines: string[] = [`Question: ${query}`, 'Candidates:'];
    candidates.forEach((c, i) => {
      const truncated = c.chunk.content.length > MAX_CONTENT_CHARS
        ? c.chunk.content.slice(0, MAX_CONTENT_CHARS) + '…'
        : c.chunk.content;
      userLines.push(`[${i + 1}] Heading: ${c.chunk.headingText || '(none)'}`);
      userLines.push(`    Content: ${truncated}`);
    });
    userLines.push('');
    userLines.push('Return strict JSON: {"rankings":[{"index":N,"score":0-10}, ...]}');

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userLines.join('\n') },
    ];

    const opts: ChatOptions = {
      messages,
      model: this.model,
      maxTokens: Math.max(4000, candidates.length * 200),
    };
    if (this.client.capabilities.supportsJsonMode) {
      opts.responseFormat = 'json_object';
    }

    let raw: string;
    try {
      const res = await this.client.chat(opts);
      raw = res.content;
    } catch {
      return fallback(candidates);
    }

    const parsed = parseRankings(raw);
    if (!parsed) return fallback(candidates);

    return applyRankings(candidates, parsed);
  }
}

function fallback(candidates: SearchHit[]): SearchHit[] {
  return candidates.map((c, i) => ({ ...c, finalRank: i }));
}

function parseRankings(raw: string): Array<{ index: number; score: number }> | null {
  try {
    const obj = JSON.parse(raw);
    if (Array.isArray(obj?.rankings)) return obj.rankings;
  } catch { /* fall through */ }
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[0]);
    if (Array.isArray(obj?.rankings)) return obj.rankings;
  } catch { /* ignore */ }
  return null;
}

function applyRankings(
  candidates: SearchHit[],
  rankings: Array<{ index: number; score: number }>
): SearchHit[] {
  const seen = new Set<number>();
  const out: SearchHit[] = [];
  for (const r of rankings) {
    const idx = Number(r.index);
    if (!Number.isInteger(idx) || idx < 1 || idx > candidates.length) continue;
    if (seen.has(idx - 1)) continue;
    seen.add(idx - 1);
    out.push({
      ...candidates[idx - 1],
      rerankScore: typeof r.score === 'number' ? r.score : 0,
      finalRank: out.length,
    });
  }
  candidates.forEach((c, i) => {
    if (!seen.has(i)) out.push({ ...c, finalRank: out.length });
  });
  return out;
}
