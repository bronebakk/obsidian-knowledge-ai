import en from './locales/en';

export type Locale = 'en';

const DICT: Record<string, string> = en;

/**
 * Translate `key`. Falls back to the raw key if missing. Supports `{name}`
 * style interpolation.
 *
 * Example:
 *   t('common.cancel') → "Cancel"
 *   t('notebook.progress', { done: 3, total: 10 }) → "3 / 10 indexed"
 */
export function t(key: string, params?: Record<string, string | number>): string {
  let s = DICT[key];
  if (s === undefined) s = key;
  if (params) {
    for (const k of Object.keys(params)) {
      s = s.split(`{${k}}`).join(String(params[k]));
    }
  }
  return s;
}
