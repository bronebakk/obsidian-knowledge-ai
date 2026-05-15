import { describe, it, expect } from 'vitest';
import {
  TokenLimitError,
  isTokenLimitMessage,
  parseTokenLimitNumbers,
  friendlyTokenLimitMessage,
} from 'src/providers/errors';

describe('isTokenLimitMessage', () => {
  it('matches Moonshot style', () => {
    expect(isTokenLimitMessage(
      'Invalid request: Your request exceeded model token limit: 32768 (requested: 57337)'
    )).toBe(true);
  });

  it('matches OpenAI style', () => {
    expect(isTokenLimitMessage(
      "This model's maximum context length is 8192 tokens. However, your messages resulted in 8500 tokens."
    )).toBe(true);
  });

  it('matches DeepSeek error.type', () => {
    expect(isTokenLimitMessage(
      '{"error":{"type":"context_length_exceeded","message":"..."}}'
    )).toBe(true);
  });

  it('matches Chinese 超出上下文', () => {
    expect(isTokenLimitMessage('请求 tokens 超出上下文长度')).toBe(true);
  });

  it('returns false for unrelated 400', () => {
    expect(isTokenLimitMessage('Invalid API key')).toBe(false);
    expect(isTokenLimitMessage('rate limit exceeded')).toBe(false);
  });
});

describe('parseTokenLimitNumbers', () => {
  it('parses Moonshot pair', () => {
    const { modelLimit, requested } = parseTokenLimitNumbers(
      'Your request exceeded model token limit: 32768 (requested: 57337)'
    );
    expect(modelLimit).toBe(32768);
    expect(requested).toBe(57337);
  });

  it('parses OpenAI pair', () => {
    const { modelLimit, requested } = parseTokenLimitNumbers(
      "This model's maximum context length is 8192 tokens. However, your messages resulted in 8500 tokens."
    );
    expect(modelLimit).toBe(8192);
    expect(requested).toBe(8500);
  });

  it('returns empty object when no numbers present', () => {
    expect(parseTokenLimitNumbers('context_length_exceeded')).toEqual({});
  });

  it('extracts limit-only when requested is missing', () => {
    const { modelLimit, requested } = parseTokenLimitNumbers(
      'token limit: 65536 — request too large'
    );
    expect(modelLimit).toBe(65536);
    expect(requested).toBeUndefined();
  });
});

describe('friendlyTokenLimitMessage', () => {
  it('includes model name and numbers', () => {
    const err = new TokenLimitError('raw', 32768, 57337);
    const msg = friendlyTokenLimitMessage(err, 'moonshot-v1-32k');
    expect(msg).toContain('moonshot-v1-32k');
    expect(msg).toContain('32768');
    expect(msg).toContain('57337');
    expect(msg).toContain('Context window');
  });

  it('falls back when model name missing', () => {
    const err = new TokenLimitError('raw', 32768);
    const msg = friendlyTokenLimitMessage(err);
    expect(msg).toContain('当前模型');
    expect(msg).toContain('32768');
  });

  it('handles missing numbers gracefully', () => {
    const err = new TokenLimitError('raw');
    const msg = friendlyTokenLimitMessage(err, 'X');
    expect(msg).toContain('X');
    expect(msg).toContain('上下文窗口不足');
  });
});
