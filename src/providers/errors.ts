/**
 * 厂商返回的 token 上限超限错误。OpenAI / Moonshot / DeepSeek / 智谱 等
 * 走 chat completions 时都用类似话术表达,这里统一抽象。
 *
 * 调用方应该用 `instanceof TokenLimitError` 检测,然后用 friendly 文案替换 raw HTTP 400。
 */
export class TokenLimitError extends Error {
  readonly modelLimit?: number;
  readonly requested?: number;
  readonly raw: string;

  constructor(raw: string, modelLimit?: number, requested?: number) {
    super(`token limit exceeded${modelLimit !== undefined ? ` (limit=${modelLimit})` : ''}`);
    this.name = 'TokenLimitError';
    this.raw = raw;
    this.modelLimit = modelLimit;
    this.requested = requested;
  }
}

/**
 * 判定厂商返回的错误体是否属于"上下文窗口超限"。匹配:
 *   - Moonshot:  "Your request exceeded model token limit: 32768 (requested: 57337)"
 *   - OpenAI:    "This model's maximum context length is 8192 tokens..."
 *   - DeepSeek:  error.type === "context_length_exceeded"
 *   - 智谱:      "tokens... 超出上下文长度"
 */
export function isTokenLimitMessage(text: string): boolean {
  return (
    /token limit/i.test(text) ||
    /maximum context length/i.test(text) ||
    /context_length_exceeded/i.test(text) ||
    /context length\b/i.test(text) ||
    /超出.*(上下文|context)/i.test(text) ||
    /上下文.*(超出|溢出|超过)/i.test(text)
  );
}

/** 从错误文本中尽量解析 (limit, requested) token 数。解析失败返回 undefined。 */
export function parseTokenLimitNumbers(text: string): { modelLimit?: number; requested?: number } {
  // Moonshot: "token limit: 32768 (requested: 57337)"
  const moonshot = text.match(/token limit[:\s]+(\d+)[^\d]*requested[:\s]+(\d+)/i);
  if (moonshot) return { modelLimit: Number(moonshot[1]), requested: Number(moonshot[2]) };

  // OpenAI: "maximum context length is 8192 tokens. However, your messages resulted in 8500 tokens"
  const openai = text.match(/maximum context length is\s+(\d+)[^]*?resulted in\s+(\d+)/i);
  if (openai) return { modelLimit: Number(openai[1]), requested: Number(openai[2]) };

  // 单独抓 limit
  const limitOnly =
    text.match(/(?:token limit|maximum context length is|context length)[:\s]+(\d+)/i);
  if (limitOnly) return { modelLimit: Number(limitOnly[1]) };

  return {};
}

/**
 * 把 TokenLimitError 转为面向最终用户的中文 actionable 提示。
 * 模型名由调用方传入(service 知道 task → model 映射,client 不知道)。
 */
export function friendlyTokenLimitMessage(err: TokenLimitError, modelName?: string): string {
  const model = modelName ? `「${modelName}」` : '当前模型';
  const limitPart = err.modelLimit !== undefined
    ? `上下文窗口仅 ${err.modelLimit} token`
    : '上下文窗口不足';
  const requestedPart = err.requested !== undefined
    ? `,本次请求 ${err.requested} token`
    : '';
  return (
    `${model}${limitPart}${requestedPart}。` +
    `请到「设置 → Provider 编辑」把 Context window 调到模型实际窗口大小,` +
    `或在任务分配里换用更大上下文的模型(如 kimi-k2.6、deepseek-v3、qwen-max 等 128K+ 模型)。`
  );
}
