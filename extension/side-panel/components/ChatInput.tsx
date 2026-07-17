import React, { RefObject, useState } from 'react';
import { Plus, ChevronDown, Check, ArrowUp, Square, X } from 'lucide-react';

/* ── small local helpers ── */
const CircleCheckIcon = () => (
  <div
    style={{
      width: '18px',
      height: '18px',
      borderRadius: '50%',
      backgroundColor: 'var(--red)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    <Check size={12} strokeWidth={4} color="#ffffff" />
  </div>
);

const ChevronIcon = ({ isUp }: { isUp: boolean }) => (
  <ChevronDown
    size={14}
    style={{ transform: isUp ? 'none' : 'rotate(180deg)', transition: 'transform 0.2s' }}
  />
);

const Favicon: React.FC<{ url: string; size?: number; className?: string }> = ({
  url,
  size = 20,
  className,
}) => {
  const domain = safeUrl(url);
  const [errored, setErrored] = useState(false);
  const isLocal = !domain || domain === 'localhost' || domain.startsWith('127.') || domain === '0.0.0.0';
  const showFallback = errored || isLocal;
  const letter = (domain || '?').charAt(0).toUpperCase();

  const boxStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '4px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--text-muted, #8e8e8e)',
    color: '#ffffff',
    fontWeight: 600,
    fontSize: Math.max(9, Math.round(size * 0.55)),
    textTransform: 'uppercase',
  };

  if (showFallback) {
    return <div className={className} style={boxStyle}>{letter}</div>;
  }

  return (
    <img
      className={className}
      src={`https://icons.duckduckgo.com/ip3/${domain}.ico`}
      alt=""
      style={{ width: size, height: size, borderRadius: '4px', flexShrink: 0, objectFit: 'cover' }}
      onError={() => setErrored(true)}
    />
  );
};

type ModelTier = 'basic' | 'intermediate' | 'advanced';

const TIER_CONFIG: Record<ModelTier, { label: string; color: string }> = {
  basic:        { label: 'Basic',        color: 'var(--text-muted, #8e8e8e)' },
  intermediate: { label: 'Intermediate', color: 'var(--text-secondary, #b0b0b0)' },
  advanced:     { label: 'Advanced',     color: 'var(--text-primary, #ffffff)' },
};

interface ModelEntry {
  value: string;
  label: string;
  desc: string;
  icon: string;
  tier: ModelTier;
}

interface Product {
  url: string;
  name?: string;
  store?: string;
}

interface ChatInputProps {
  /* textarea state */
  inputValue: string;
  setInputValue: (v: string) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  isStreaming: boolean;
  onSubmit: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;

  /* attach popup */
  showPopup: boolean;
  setShowPopup: (v: boolean) => void;
  attachPopupRef: RefObject<HTMLDivElement | null>;
  products: Product[];
  selectedUrls: string[];
  selectedProducts: Product[];
  activeTabUrl: string;
  onToggleUrl: (url: string) => void;

  /* selected tabs inline panel */
  showSelected: boolean;
  setShowSelected: (v: boolean) => void;
  selectedPanelRef: RefObject<HTMLDivElement | null>;

  /* model dropdown */
  showModelPopup: boolean;
  setShowModelPopup: (v: boolean) => void;
  modelDropdownRef: RefObject<HTMLDivElement | null>;
  model: string;
  modelsData: ModelEntry[];
  selectedModelLabel: string;
  selectedModelIcon: string;
  onSelectModel: (val: string) => void;
  onStop: () => void;
}

const safeUrl = (url: string) => {
  try { return new URL(url).hostname; } catch { return ''; }
};

export const ChatInput: React.FC<ChatInputProps> = ({
  inputValue,
  setInputValue,
  inputRef,
  isStreaming,
  onSubmit,
  onKeyDown,
  showPopup,
  setShowPopup,
  attachPopupRef,
  products,
  selectedUrls,
  selectedProducts,
  activeTabUrl,
  onToggleUrl,
  showSelected,
  setShowSelected,
  selectedPanelRef,
  showModelPopup,
  setShowModelPopup,
  modelDropdownRef,
  model,
  modelsData,
  selectedModelLabel,
  selectedModelIcon,
  onSelectModel,
  onStop,
}) => {
  const selectedTabs = products.filter((p: any) => selectedUrls.includes(p.url));

  return (
    <div id="input-outer-container">
      {/* ── Child 1: Chip UI (selected tabs) — floats above the input ── */}
      {selectedUrls.length > 0 && (
        <div id="context-chips">
          <div className="chips-row">
            <span className="chips-text">
              Sharing {selectedTabs.length} tab{selectedTabs.length > 1 ? 's' : ''}
            </span>
            <button
              className="chips-expand"
              title={showSelected ? 'Hide selected tabs' : 'Show selected tabs'}
              onClick={() => { setShowPopup(false); setShowSelected(!showSelected); }}
            >
              <ChevronIcon isUp={showSelected} />
            </button>
          </div>

          {showSelected && (
            <div id="selected-detail">
              <div className="selected-detail-header">Selected Tabs · {selectedTabs.length}</div>
              {selectedTabs.map((p: any) => (
                <div key={p.url} className="popup-item active">
                  <Favicon url={p.url} size={20} className="popup-item-icon" />
                  <div className="popup-item-info">
                    <div className="popup-item-name">
                      {p.title || p.url}
                      {p.active && (
                        <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}> • Current tab</span>
                      )}
                    </div>
                    <div className="popup-item-store">{p.product?.store || safeUrl(p.url)}</div>
                  </div>
                  <button
                    className="popup-item-remove"
                    title="Remove tab"
                    onClick={() => onToggleUrl(p.url)}
                    style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '6px' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Child 2: Chat Input bubble ── */}
      <div id="input-capsule-wrapper" className={isStreaming ? 'streaming' : ''}>

        {/* ── Tab Attach Popup ── */}
        {showPopup && (
          <div ref={attachPopupRef} id="attach-popup" className="popup">
            <div style={{ padding: '6px 12px', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              Open Tabs
            </div>
            {products.map((p: any) => {
              const isSelected = selectedUrls.includes(p.url);
              return (
                <div
                  key={p.url}
                  className={`popup-item ${isSelected ? 'active' : ''}`}
                  onClick={() => onToggleUrl(p.url)}
                >
                  <Favicon url={p.url} size={20} className="popup-item-icon" />
                  <div className="popup-item-info">
                    <div className="popup-item-name">
                      {p.title || p.url}
                      {p.active && (
                        <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}> • Current tab</span>
                      )}
                    </div>
                    <div className="popup-item-store">{p.product?.store || safeUrl(p.url)}</div>
                  </div>
                  {isSelected && <CircleCheckIcon />}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Textarea + Bottom Action Row ── */}
        <div id="input-capsule">
          <textarea
            ref={inputRef}
            id="input"
            value={inputValue}
            placeholder="Type @ to ask about a tab"
            rows={1}
            disabled={isStreaming}
            onKeyDown={onKeyDown}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
              setInputValue(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
          />

          <div className="input-actions-row">
            {/* Left: attach btn */}
            <div className="input-left-actions">
              <button
                className="input-action-circle-btn"
                title="Attach tabs"
                onClick={() => { setShowSelected(false); setShowPopup(!showPopup); }}
              >
                <Plus size={18} />
              </button>
            </div>

            {/* Right: model selector */}
            <div className="input-right-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="model-dropdown-wrapper" ref={modelDropdownRef}>
                <button
                  className="model-dropdown-trigger-btn"
                  onClick={() => setShowModelPopup(!showModelPopup)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {selectedModelIcon && (
                    <img
                      src={chrome.runtime.getURL(`icons/models/${selectedModelIcon}`)}
                      alt=""
                      style={{ width: '16px', height: '16px', borderRadius: '2px', display: 'block' }}
                    />
                  )}
                  <span className="model-dropdown-trigger-text">{selectedModelLabel}</span>
                  <ChevronDown
                    size={14}
                    style={{ transform: showModelPopup ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                  />
                </button>

                {showModelPopup && (
                  <div className="model-popup">
                    <div className="model-popup-header">Choose model</div>
                    <div className="model-popup-list">
                      {(Object.keys(TIER_CONFIG) as ModelTier[]).map((tier) => {
                        const tierModels = modelsData.filter((m) => m.tier === tier);
                        if (tierModels.length === 0) return null;
                        const cfg = TIER_CONFIG[tier];
                        return (
                          <div key={tier}>
                            <div
                              className="model-popup-tier-header"
                              style={{
                                padding: '6px 12px 2px',
                                fontSize: '10px',
                                fontWeight: 600,
                                letterSpacing: '0.5px',
                                textTransform: 'uppercase',
                                color: cfg.color,
                              }}
                            >
                              {cfg.label}
                            </div>
                            {tierModels.map((m) => {
                              const isSelected = model === m.value;
                              return (
                                <div
                                  key={m.value}
                                  className={`model-popup-item ${isSelected ? 'active' : ''}`}
                                  onClick={() => onSelectModel(m.value)}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                    <img
                                      src={chrome.runtime.getURL(`icons/models/${m.icon}`)}
                                      alt=""
                                      style={{ width: '20px', height: '20px', borderRadius: '4px', display: 'block', flexShrink: 0 }}
                                    />
                                    <div className="model-popup-item-info">
                                      <div className="model-popup-item-label">{m.label}</div>
                                      <div className="model-popup-item-desc">{m.desc}</div>
                                    </div>
                                  </div>
                                  {isSelected && <Check size={16} strokeWidth={3} color="#ffffff" />}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {isStreaming ? (
                <button
                  className="submit-btn active"
                  title="Stop generating"
                  onClick={onStop}
                  style={{
                    backgroundColor: 'var(--red, #ea4335)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Square size={10} fill="#ffffff" stroke="none" />
                </button>
              ) : (
                <button
                  className={`submit-btn ${inputValue.trim() ? 'active' : ''}`}
                  title="Send message"
                  onClick={onSubmit}
                  disabled={!inputValue.trim()}
                  style={{
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    backgroundColor: inputValue.trim() ? '#ffffff' : 'transparent',
                    color: inputValue.trim() ? '#131314' : '#8e8e8e',
                    cursor: inputValue.trim() ? 'pointer' : 'default',
                  }}
                >
                  <ArrowUp size={14} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
