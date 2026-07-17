import React, { RefObject } from 'react';
import { Plus, ChevronDown, Check, ArrowUp, Square } from 'lucide-react';

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

interface ModelEntry {
  value: string;
  label: string;
  desc: string;
  icon: string;
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
  return (
    <div id="input-outer-container">
      <div id="input-capsule-wrapper" className={isStreaming ? 'streaming' : ''}>

        {/* ── Product Attach Popup ── */}
        {showPopup && (
          <div ref={attachPopupRef} id="attach-popup" className="popup">
            {products.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                No products detected on open tabs
              </div>
            ) : (
              products.map((p: any) => {
                const isSelected = selectedUrls.includes(p.url);
                return (
                  <div
                    key={p.url}
                    className={`popup-item ${isSelected ? 'active' : ''}`}
                    onClick={() => onToggleUrl(p.url)}
                  >
                    <img
                      className="popup-item-icon"
                      src={`https://www.google.com/s2/favicons?domain=${safeUrl(p.url)}&sz=20`}
                      alt=""
                    />
                    <div className="popup-item-info">
                      <div className="popup-item-name">
                        {p.name || 'Unknown'}
                        {p.url === activeTabUrl && (
                          <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}> • Current tab</span>
                        )}
                      </div>
                      <div className="popup-item-store">{p.store || safeUrl(p.url)}</div>
                    </div>
                    {isSelected && <CircleCheckIcon />}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Sharing Banner ── */}
        {selectedUrls.length > 0 && (
          <div id="sharing-banner" onClick={() => setShowPopup(!showPopup)}>
            <div className="sharing-info">
              <div className="overlapping-favicons">
                {selectedProducts.slice(0, 2).map((p: any, idx: number) => (
                  <img
                    key={p.url}
                    className={`sharing-icon ${idx > 0 ? 'overlapping' : ''}`}
                    src={`https://www.google.com/s2/favicons?domain=${safeUrl(p.url)}&sz=16`}
                    alt=""
                  />
                ))}
              </div>
              <span className="sharing-text">
                Sharing {selectedUrls.length === 1 ? '1 tab' : `${selectedUrls.length} tabs`}
              </span>
            </div>
            <button
              className="sharing-chevron"
              title="Toggle Popup"
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); setShowPopup(!showPopup); }}
            >
              <ChevronIcon isUp={showPopup} />
            </button>
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
                title="Switch product"
                onClick={() => setShowPopup(!showPopup)}
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
                      {modelsData.map((m) => {
                        const isSelected = model === m.value;
                        return (
                          <div
                            key={m.value}
                            className={`model-popup-item ${isSelected ? 'active' : ''}`}
                            onClick={() => onSelectModel(m.value)}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
