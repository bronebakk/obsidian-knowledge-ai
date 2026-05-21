import React from 'react';
import type { EmbeddingConfig } from 'src/types/data';
import { t } from 'src/i18n';

const OPENROUTER_EMBEDDING_PRESETS = [
  { id: 'mistralai/mistral-embed', label: 'Mistral Embed (default, $0.10 / 1M tokens)' },
];

export interface VectorCoverage {
  total: number;
  embedded: number;
  failed: number;
  outdated: boolean;
}

export interface EmbeddingSectionProps {
  config: EmbeddingConfig;
  coverage: VectorCoverage | null;
  modelDownloadState: 'not-downloaded' | 'downloading' | 'ready' | 'error';
  downloadProgress: number;   // 0-100
  downloadError?: string | null;
  onConfigChange: (patch: Partial<EmbeddingConfig>) => void;
  onDownloadModel: () => void;
  onTriggerReindex: () => void;
}

const PRESET_MODELS = [
  { id: 'Xenova/multilingual-e5-small', label: 'multilingual-e5-small (default, multilingual)' },
  { id: 'Xenova/all-MiniLM-L6-v2', label: 'all-MiniLM-L6-v2 (English)' },
];

export function EmbeddingSection({
  config, coverage, modelDownloadState, downloadProgress, downloadError,
  onConfigChange, onDownloadModel, onTriggerReindex,
}: EmbeddingSectionProps) {
  const coverageLabel = (() => {
    if (!config.enabled) return t('settings.vector.coverageNotEnabled');
    if (!coverage) return t('common.loading');
    if (coverage.outdated) return `✗ ${t('settings.vector.coverageOutdated')}`;
    if (coverage.total === 0) return t('settings.vector.coverageNoFiles');
    if (coverage.failed > 0) {
      return `⚠ ${t('settings.vector.coveragePartialFailed', { embedded: coverage.embedded, total: coverage.total, failed: coverage.failed })}`;
    }
    if (coverage.embedded === coverage.total) {
      return `✓ ${t('settings.vector.coverageFull', { embedded: coverage.embedded, total: coverage.total })}`;
    }
    return `⚠ ${t('settings.vector.coveragePartial', { embedded: coverage.embedded, total: coverage.total })}`;
  })();

  return (
    <div className="notebook-ai-embedding-section">
      <div className="setting-item">
        <div className="setting-item-info">
          <div className="setting-item-name">{t('settings.vector.enable')}</div>
          <div className="setting-item-description">{t('settings.vector.enableDesc')}</div>
        </div>
        <div className="setting-item-control">
          <div
            className={`checkbox-container${config.enabled ? ' is-enabled' : ''}`}
            onClick={() => onConfigChange({ enabled: !config.enabled })}
          >
            <input type="checkbox" checked={config.enabled} readOnly />
          </div>
        </div>
      </div>

      {config.enabled && (
        <>
          <div className="setting-item">
            <div className="setting-item-info">
              <div className="setting-item-name">{t('settings.vector.source')}</div>
            </div>
            <div className="setting-item-control">
              <select
                value={config.source}
                onChange={e => onConfigChange({ source: e.target.value as 'openrouter' | 'local' })}
              >
                <option value="local">{t('settings.vector.source.local')}</option>
                <option value="openrouter">{t('settings.vector.source.openrouter')}</option>
              </select>
            </div>
          </div>

          {config.source === 'openrouter' && (
            <>
              <div className="setting-item">
                <div className="setting-item-info">
                  <div className="setting-item-name">{t('settings.vector.openrouterApiKey')}</div>
                  <div className="setting-item-description">{t('settings.vector.openrouterApiKeyDesc')}</div>
                </div>
                <div className="setting-item-control">
                  <input
                    type="password"
                    placeholder="sk-or-…"
                    autoComplete="off"
                    spellCheck={false}
                    value={config.openrouterApiKey ?? ''}
                    onChange={e => onConfigChange({ openrouterApiKey: e.target.value })}
                  />
                </div>
              </div>
              <div className="setting-item">
                <div className="setting-item-info">
                  <div className="setting-item-name">{t('settings.vector.openrouterModel')}</div>
                </div>
                <div className="setting-item-control">
                  <select
                    value={
                      OPENROUTER_EMBEDDING_PRESETS.some(m => m.id === config.openrouterModel)
                        ? config.openrouterModel
                        : '__custom__'
                    }
                    onChange={e => {
                      if (e.target.value === '__custom__') {
                        onConfigChange({ openrouterModel: '' });
                      } else {
                        onConfigChange({ openrouterModel: e.target.value });
                      }
                    }}
                  >
                    {OPENROUTER_EMBEDDING_PRESETS.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                    <option value="__custom__">{t('settings.vector.openrouterModelCustom')}</option>
                  </select>
                </div>
              </div>
              {!OPENROUTER_EMBEDDING_PRESETS.some(m => m.id === config.openrouterModel) && (
                <div className="setting-item">
                  <div className="setting-item-info">
                    <div className="setting-item-name">{t('settings.vector.openrouterModelCustomLabel')}</div>
                  </div>
                  <div className="setting-item-control">
                    <input
                      type="text"
                      placeholder="mistralai/mistral-embed"
                      value={config.openrouterModel ?? ''}
                      onChange={e => onConfigChange({ openrouterModel: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {config.source === 'local' && (
            <>
              <div className="setting-item">
                <div className="setting-item-info">
                  <div className="setting-item-name">{t('settings.vector.preset')}</div>
                </div>
                <div className="setting-item-control">
                  <select
                    value={config.localModelId ?? 'Xenova/multilingual-e5-small'}
                    onChange={e => onConfigChange({ localModelId: e.target.value })}
                  >
                    {PRESET_MODELS.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="setting-item">
                <div className="setting-item-info">
                  <div className="setting-item-name">{t('settings.vector.modelStatus')}</div>
                </div>
                <div className="setting-item-control">
                  {modelDownloadState === 'not-downloaded' && (
                    <button onClick={onDownloadModel}>{t('settings.vector.modelDownload')}</button>
                  )}
                  {modelDownloadState === 'downloading' && (
                    <div>
                      <progress value={downloadProgress} max={100} style={{ width: '120px' }} />
                      <span style={{ marginLeft: 8 }}>{downloadProgress}%</span>
                    </div>
                  )}
                  {modelDownloadState === 'ready' && (
                    <span style={{ color: 'var(--color-green)' }}>● {t('settings.vector.modelReady')}</span>
                  )}
                  {modelDownloadState === 'error' && (
                    <div>
                      <button onClick={onDownloadModel} style={{ marginRight: 8 }}>{t('common.retry')}</button>
                      <span style={{ color: 'var(--color-red)' }}>✗ {t('settings.vector.modelDownloadFailed')}</span>
                      {downloadError && (
                        <div style={{
                          marginTop: 6,
                          padding: 6,
                          background: 'var(--background-secondary)',
                          border: '1px solid var(--color-red)',
                          borderRadius: 4,
                          fontSize: '0.8em',
                          whiteSpace: 'pre-wrap',
                          maxWidth: 400,
                          color: 'var(--text-normal)',
                        }}>{downloadError}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="setting-item">
            <div className="setting-item-info">
              <div className="setting-item-name">{t('settings.vector.coverage')}</div>
              <div className="setting-item-description">{coverageLabel}</div>
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-item-info">
              <div className="setting-item-description">{t('settings.vector.reindexHint')}</div>
            </div>
            <div className="setting-item-control">
              <button onClick={onTriggerReindex}>{t('settings.vector.reindexAll')}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
