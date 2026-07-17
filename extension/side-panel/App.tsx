import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAgent } from 'agents/react';
import { useAgentChat, getToolApproval } from '@cloudflare/ai-chat/react';

const WORKER_URL = 'http://127.0.0.1:8787';
const VALID_MODELS = [
  '@cf/meta/llama-4-scout-17b-16e-instruct',
  '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/openai/gpt-oss-120b',
  '@cf/qwen/qwen3-30b-a3b-fp8',
  '@cf/moonshotai/kimi-k2.6',
  '@cf/zai-org/glm-4.7-flash',
  '@cf/zai-org/glm-5.2',
];
const DEFAULT_MODEL = VALID_MODELS[0];
const MODELS = VALID_MODELS.map(v => ({ value: v, label: v.split('/').pop()! }));

// --- SVG Icons ---
const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const MoreIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
  </svg>
);

const PopoutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </svg>
);

const ThumbsUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
  </svg>
);

const ThumbsDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm12-3h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
  </svg>
);

// --- Code Highlighter & Markdown parsing functions ---
function highlightCode(code: string, language: string): React.ReactNode[] {
  const lines = code.split('\n');
  return lines.map((line, lineIdx) => {
    let content: React.ReactNode[] = [];
    
    if (language.toLowerCase() === 'sql') {
      const tokens = line.split(/(\s+|[,;()])/);
      tokens.forEach((token, tokIdx) => {
        const key = `${lineIdx}-${tokIdx}`;
        const upperToken = token.toUpperCase();
        const keywords = [
          'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALTER', 'DEFAULT', 'PRIVILEGES',
          'IN', 'SCHEMA', 'GRANT', 'ON', 'TO', 'CREATE', 'TABLE', 'DATABASE', 'WHERE',
          'FROM', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'AS', 'AND', 'OR', 'NOT'
        ];
        if (keywords.includes(upperToken)) {
          content.push(<span key={key} className="code-keyword">{token}</span>);
        } else if (token.startsWith("'") && token.endsWith("'")) {
          content.push(<span key={key} className="code-string">{token}</span>);
        } else if (/^\d+$/.test(token)) {
          content.push(<span key={key} className="code-number">{token}</span>);
        } else {
          content.push(token);
        }
      });
    } else {
      const tokens = line.split(/(\s+|[{}[\]().,;+\-*/=<>!&|:?])/);
      tokens.forEach((token, tokIdx) => {
        const key = `${lineIdx}-${tokIdx}`;
        const keywords = [
          'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
          'do', 'switch', 'case', 'break', 'continue', 'import', 'export', 'from',
          'class', 'extends', 'new', 'this', 'super', 'try', 'catch', 'finally',
          'throw', 'async', 'await', 'default'
        ];
        if (keywords.includes(token)) {
          content.push(<span key={key} className="code-keyword">{token}</span>);
        } else if (/^(["'`]).*\1$/.test(token)) {
          content.push(<span key={key} className="code-string">{token}</span>);
        } else if (/^\d+$/.test(token)) {
          content.push(<span key={key} className="code-number">{token}</span>);
        } else {
          content.push(token);
        }
      });
    }
    
    return (
      <div key={lineIdx}>
        {content.length > 0 ? content : line || ' '}
      </div>
    );
  });
}

function parseInlineStyles(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  const splitParts = text.split(regex);
  
  splitParts.forEach((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      parts.push(<strong key={i}>{part.slice(2, -2)}</strong>);
    } else if (part.startsWith('`') && part.endsWith('`')) {
      parts.push(<code key={i}>{part.slice(1, -1)}</code>);
    } else {
      parts.push(part);
    }
  });
  return parts;
}

interface CodeBlockProps {
  language: string;
  code: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const ext = language.toLowerCase() === 'sql' ? 'sql' : 'txt';
    link.download = `code-snippet.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="code-block-container">
      <div className="code-block-header">
        <span className="code-block-lang">{language.toUpperCase()}</span>
        <div className="code-block-actions">
          <button className="code-action-btn" title="Download Code" onClick={handleDownload}>
            <DownloadIcon />
          </button>
          <button className="code-action-btn" title="Copy Code" onClick={handleCopy}>
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        </div>
      </div>
      <pre className="code-block-content">
        <code>{highlightCode(code, language)}</code>
      </pre>
    </div>
  );
};

function renderTextBlocks(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  let currentListType: 'ul' | 'ol' | null = null;

  const flushList = (key: number) => {
    if (currentListType === 'ul') {
      blocks.push(<ul key={`list-${key}`}>{currentList}</ul>);
    } else if (currentListType === 'ol') {
      blocks.push(<ol key={`list-${key}`}>{currentList}</ol>);
    }
    currentList = [];
    currentListType = null;
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('### ')) {
      flushList(idx);
      blocks.push(<h3 key={`h3-${idx}`}>{parseInlineStyles(trimmed.slice(4))}</h3>);
    } else if (trimmed.startsWith('#### ')) {
      flushList(idx);
      blocks.push(<h4 key={`h4-${idx}`}>{parseInlineStyles(trimmed.slice(5))}</h4>);
    } else if (trimmed.startsWith('## ')) {
      flushList(idx);
      blocks.push(<h3 key={`h2-${idx}`}>{parseInlineStyles(trimmed.slice(3))}</h3>);
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (currentListType !== 'ul') {
        flushList(idx);
        currentListType = 'ul';
      }
      currentList.push(<li key={`li-${idx}`}>{parseInlineStyles(trimmed.slice(2))}</li>);
    } else if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^\d+\.\s/);
      const sliceLen = match ? match[0].length : 3;
      if (currentListType !== 'ol') {
        flushList(idx);
        currentListType = 'ol';
      }
      currentList.push(<li key={`li-${idx}`}>{parseInlineStyles(trimmed.slice(sliceLen))}</li>);
    } else if (!trimmed) {
      flushList(idx);
    } else {
      flushList(idx);
      blocks.push(<p key={`p-${idx}`}>{parseInlineStyles(line)}</p>);
    }
  });

  flushList(lines.length);
  return blocks;
}

function renderMarkdown(text: string): React.ReactNode {
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const textSection = text.substring(lastIndex, match.index);
      elements.push(...renderTextBlocks(textSection));
    }

    const language = match[1] || 'Code';
    const code = match[2];
    elements.push(
      <CodeBlock key={`code-${match.index}`} language={language} code={code} />
    );

    lastIndex = codeBlockRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    const textSection = text.substring(lastIndex);
    elements.push(...renderTextBlocks(textSection));
  }

  return <div className="message-content">{elements}</div>;
}

// --- Main App Component ---
export default function App() {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [user, setUser] = useState<any>(null);
  const [model, setModel] = useState(() => {
    const saved = localStorage.getItem('shopmate_model');
    return saved && VALID_MODELS.includes(saved) ? saved : DEFAULT_MODEL;
  });
  const [showPopup, setShowPopup] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const agent = useAgent({ agent: 'ChatAgent', host: WORKER_URL });
  const { messages, sendMessage, addToolApprovalResponse, status } = useAgentChat({
    agent,
    body: { model, canvas: products },
  });

  const activeTool = useMemo(() => {
    for (const msg of messages) {
      for (const part of msg.parts) {
        if ((part as any).type === 'tool-call' && (part as any).state === 'call') {
          return (part as any).toolName;
        }
      }
    }
    return null;
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'canvas:get' }, (response) => {
      const p = response?.canvas || [];
      setProducts(p);
      if (p.length > 0 && selectedIndex < 0) setSelectedIndex(0);
    });

    chrome.runtime.sendMessage({ type: 'auth:status' }, (response) => {
      if (response?.user) setUser(response.user);
    });
  }, []);

  const handleSignIn = () => {
    chrome.runtime.sendMessage({ type: 'auth:signin' }, (response) => {
      if (response?.user) setUser(response.user);
    });
  };

  const handleSignOut = () => {
    chrome.runtime.sendMessage({ type: 'auth:signout' }, () => setUser(null));
  };

  const handleRemoveProduct = (url: string) => {
    chrome.runtime.sendMessage({ type: 'canvas:remove', url }, () => {
      chrome.runtime.sendMessage({ type: 'canvas:get' }, (response) => {
        const p = response?.canvas || [];
        setProducts(p);
        if (selectedIndex >= p.length) setSelectedIndex(p.length - 1);
      });
    });
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setModel(value);
    localStorage.setItem('shopmate_model', value);
  };

  const handleSubmit = () => {
    if (inputValue.trim()) {
      sendMessage({ text: inputValue });
      setInputValue('');
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const safeUrl = (url: string) => {
    try { return new URL(url).hostname; } catch { return ''; }
  };

  const tabCount = products.length;
  const product = selectedIndex >= 0 && selectedIndex < products.length ? products[selectedIndex] : null;

  return (
    <>
      <header id="header">
        <div className="header-title-container">
          <span className="brand">Shop Mate</span>
          <button className="header-icon-btn" title="Rename Chat">
            <EditIcon />
          </button>
        </div>
        <div className="header-actions">
          <button className="header-icon-btn" title="Options">
            <MoreIcon />
          </button>
          <button className="header-icon-btn" title="Open in new tab">
            <PopoutIcon />
          </button>
          <button className="header-icon-btn" title="Close" onClick={() => window.close()}>
            <CloseIcon />
          </button>
        </div>
      </header>

      <div id="canvas-bar">
        <span className="canvas-label">Shopping across</span>
        <span id="canvas-count">{tabCount} product{tabCount !== 1 ? 's' : ''}</span>
      </div>

      <div id="account-bar">
        {user ? (
          <div id="account-profile">
            {user.picture && <img id="account-avatar" src={user.picture} alt="" />}
            <span id="account-name">{user.name || user.email?.split('@')[0]}</span>
            <button id="sign-out-btn" className="btn-outline" onClick={handleSignOut}>Sign out</button>
          </div>
        ) : (
          <div id="account-profile">
            <span id="account-name" style={{ fontStyle: 'italic' }}>Not signed in</span>
            <button id="sign-in-btn" className="btn-outline" onClick={handleSignIn}>Sign in with Google</button>
          </div>
        )}
      </div>

      <div id="messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            {msg.parts.map((part, i) => {
              if (part.type === 'text') {
                return <React.Fragment key={i}>{renderMarkdown(part.text)}</React.Fragment>;
              }
              if (part.state === 'approval-requested') {
                const approval = getToolApproval(part);
                if (!approval) return null;
                return (
                  <div key={part.toolCallId} style={{ marginTop: '8px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-secondary)' }}>
                    <p style={{ marginBottom: '8px' }}>Approve <strong>{part.toolName}</strong>?</p>
                    <pre style={{ background: 'var(--code-bg)', padding: '8px', borderRadius: '4px', overflowX: 'auto', fontSize: '11px', marginBottom: '8px' }}>{JSON.stringify(part.input, null, 2)}</pre>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn-outline" onClick={() => addToolApprovalResponse({ id: approval.id, approved: true })}>Approve</button>
                      <button className="btn-outline" onClick={() => addToolApprovalResponse({ id: approval.id, approved: false })}>Reject</button>
                    </div>
                  </div>
                );
              }
              if (part.state === 'output-available') {
                return (
                  <div key={part.toolCallId} className="tool-result">
                    {part.toolName === 'findDeals' && (() => {
                      const d = part.output as any;
                      return (
                        <div className="deal-card" onClick={() => {
                          const q = `${d.deal} ${d.store} ${d.category}`;
                          window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank');
                        }}>
                          <div className="deal-badge">{d.deal}</div>
                          <div className="deal-store">{d.store}</div>
                          <div className="deal-category">{d.category}{d.maxPrice !== 'No limit' ? ` · up to $${d.maxPrice}` : ''}</div>
                          <div className="deal-details">{d.details}</div>
                        </div>
                      );
                    })()}
                    {part.toolName === 'getProductDetails' && (() => {
                      const p = part.output as any;
                      return (
                        <div className="product-detail-card">
                          <div className="pd-name">{p.name}</div>
                          <div className="pd-meta">{p.store} · {p.price} · {p.rating}</div>
                          <div className="pd-desc">{p.description}</div>
                        </div>
                      );
                    })()}
                    {part.toolName === 'compareProducts' && (() => {
                      const c = part.output as any;
                      return (
                        <div className="compare-card">
                          <div className="compare-header">Comparison</div>
                          <div className="compare-products">{c.products?.join(' vs ')}</div>
                          <div className="compare-text">{c.comparison}</div>
                        </div>
                      );
                    })()}
                    {!['findDeals','getProductDetails','compareProducts'].includes(part.toolName) && (
                      <details>
                        <summary>{part.toolName} result</summary>
                        <pre>{JSON.stringify(part.output, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                );
              }
              return null;
            })}

            {msg.role === 'assistant' && (
              <>
                <div className="feedback-row">
                  <button className="feedback-btn" title="Good response">
                    <ThumbsUpIcon />
                  </button>
                  <button className="feedback-btn" title="Bad response">
                    <ThumbsDownIcon />
                  </button>
                  <button className="feedback-btn" title="Regenerate">
                    <RefreshIcon />
                  </button>
                  <button className="feedback-btn" title="Copy response" onClick={() => {
                    const text = msg.parts
                      .filter((p: any) => p.type === 'text')
                      .map((p: any) => p.text)
                      .join('\n');
                    navigator.clipboard.writeText(text);
                  }}>
                    <CopyIcon />
                  </button>
                  <button className="feedback-btn" title="More">
                    <MoreIcon />
                  </button>
                </div>
                <div className="disclaimer-text">
                  Gemini is AI and can make mistakes.
                </div>
              </>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {product && (
        <div id="sharing-banner">
          <div className="sharing-info">
            <img className="sharing-icon" src={`https://www.google.com/s2/favicons?domain=${safeUrl(product.url)}&sz=16`} alt="" />
            <span className="sharing-text">Sharing "{product.name || 'Unknown'}"</span>
          </div>
          <button className="sharing-close" onClick={() => handleRemoveProduct(product.url)}>
            <CloseIcon />
          </button>
        </div>
      )}

      {(status === 'streaming' || activeTool) && (
        <div id="status-indicator">
          <span className="dots">
            <span className="dot" /><span className="dot" /><span className="dot" />
          </span>
          {activeTool ? `Using ${activeTool}...` : 'Thinking...'}
        </div>
      )}

      {showPopup && (
        <div id="attach-popup" className="popup">
          {products.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              No products detected on open tabs
            </div>
          ) : (
            products.map((p, i) => (
              <div
                key={p.url}
                className={`popup-item ${i === selectedIndex ? 'active' : ''}`}
                onClick={() => { setSelectedIndex(i); setShowPopup(false); }}
              >
                <img className="popup-item-icon" src={`https://www.google.com/s2/favicons?domain=${safeUrl(p.url)}&sz=20`} alt="" />
                <div className="popup-item-info">
                  <div className="popup-item-name">{p.name || 'Unknown'}</div>
                  <div className="popup-item-store">{p.store || safeUrl(p.url)}</div>
                </div>
                <span className="popup-item-check">{i === selectedIndex ? '\u2713' : ''}</span>
              </div>
            ))
          )}
        </div>
      )}

      <div id="input-outer-container">
        <div id="input-capsule">
          <textarea
            ref={inputRef}
            id="input"
            value={inputValue}
            placeholder="Type @ to ask about a tab"
            rows={1}
            disabled={status === 'streaming'}
            onKeyDown={handleKeyDown}
            onChange={(e) => {
              setInputValue(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
          />
          <div className="input-actions-row">
            <div className="input-left-actions">
              <button 
                className="input-action-circle-btn" 
                title="Switch product" 
                onClick={() => setShowPopup(!showPopup)}
              >
                +
              </button>
            </div>
            
            <div className="input-right-actions">
              <div className="model-dropdown-wrapper">
                <select 
                  className="model-dropdown-select" 
                  value={model} 
                  onChange={handleModelChange}
                >
                  {MODELS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <span className="model-dropdown-chevron">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </div>

              <button 
                className={`submit-btn ${inputValue.trim() ? 'active' : ''}`}
                onClick={handleSubmit}
                disabled={status === 'streaming' || !inputValue.trim()}
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
