import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAgent } from 'agents/react';
import { useAgentChat } from '@cloudflare/ai-chat/react';
import { SquarePen, MoreVertical, ExternalLink, X, User } from 'lucide-react';

import { HistoryPopup } from './components/HistoryPopup';
import { WelcomeScreen } from './components/WelcomeScreen';
import { MessageItem } from './components/MessageItem';
import { ChatInput } from './components/ChatInput';
import { LoadingIndicator } from './components/LoadingIndicator';
import { useThreads } from './utils/useThreads';

// ── Constants ──────────────────────────────────────────────────────────────
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

const MODELS_DATA = [
  { value: '@cf/meta/llama-4-scout-17b-16e-instruct',  label: 'Llama 4 Scout',  desc: 'Meta MoE Instruct Generalist (17B active)',   icon: 'meta.svg' },
  { value: '@cf/meta/llama-3.1-8b-instruct-fp8-fast',  label: 'Llama 3.1 8B',   desc: 'Meta Fast Text Instruct (FP8 quantized)',     icon: 'meta.svg' },
  { value: '@cf/google/gemma-4-26b-a4b-it',            label: 'Gemma 4 26B',    desc: 'Google MoE Multimodal (4B active)',           icon: 'google.svg' },
  { value: '@cf/openai/gpt-oss-120b',                  label: 'GPT-OSS 120B',   desc: 'Open-source frontier text model',             icon: 'openai.svg' },
  { value: '@cf/qwen/qwen3-30b-a3b-fp8',               label: 'Qwen 3 30B',     desc: 'Alibaba Multilingual MoE (3B active)',        icon: 'qwen.svg' },
  { value: '@cf/moonshotai/kimi-k2.6',                 label: 'Kimi K2.6',      desc: 'Moonshot AI Long Context & Vision',           icon: 'moonshotai.svg' },
  { value: '@cf/zai-org/glm-4.7-flash',                label: 'GLM 4.7 Flash',  desc: 'Zhipu AI Fast Bilingual Assistant',           icon: 'zai.svg' },
  { value: '@cf/zai-org/glm-5.2',                      label: 'GLM 5.2',        desc: 'Zhipu AI High Performance Reasoning',         icon: 'zai.svg' },
];

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  // ── Product / tab state ──
  const [products, setProducts]       = useState<any[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [activeTabUrl, setActiveTabUrl] = useState<string>('');
  const [user, setUser]               = useState<any>(null);

  // ── Model state ──
  const [model, setModel] = useState(() => {
    const saved = localStorage.getItem('shopmate_model');
    return saved && VALID_MODELS.includes(saved) ? saved : DEFAULT_MODEL;
  });

  // ── Popup visibility ──
  const [showPopup,        setShowPopup]        = useState(false);
  const [showModelPopup,   setShowModelPopup]   = useState(false);
  const [showHistoryPopup, setShowHistoryPopup] = useState(false);

  // ── Input state ──
  const [inputValue, setInputValue] = useState('');
  const inputRef          = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef    = useRef<HTMLDivElement>(null);
  const attachPopupRef    = useRef<HTMLDivElement>(null);
  const modelDropdownRef  = useRef<HTMLDivElement>(null);
  const historyRef        = useRef<HTMLDivElement>(null);

  // ── Thread management (via KV-backed hook) ──
  const {
    threads,
    activeThreadId,
    setActiveThreadId,
    activeThreadTitle,
    updateActiveThreadTitle,
    handleNewChat: _handleNewChat,
    handleDeleteThread,
  } = useThreads();


  // ── Agent & chat ──
  const agent = useAgent({
    agent: 'ChatAgent',
    name: activeThreadId,
    host: WORKER_URL,
    // Suppress the identity-change warning — we intentionally switch instances
    onIdentityChange: () => { /* expected when switching chat threads */ },
  });

  const selectedProducts = useMemo(
    () => products.filter(p => selectedUrls.includes(p.url)),
    [products, selectedUrls],
  );

  const { messages, sendMessage, addToolApprovalResponse, status, clearHistory } = useAgentChat({
    agent,
    body: { model, canvas: selectedProducts },
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

  // ── Derived model metadata ──
  const handleNewChat = () => _handleNewChat(messages.length > 0);

  const selectedModelLabel = useMemo(() => {
    const found = MODELS_DATA.find(m => m.value === model);
    return found ? found.label : model.split('/').pop()!;
  }, [model]);

  const selectedModelIcon = useMemo(() => {
    const found = MODELS_DATA.find(m => m.value === model);
    return found ? found.icon : '';
  }, [model]);

  // ── Effects ──
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    const fetchCanvas = () => {
      chrome.runtime.sendMessage({ type: 'canvas:get' }, (response) => {
        const p = response?.canvas || [];
        setProducts(p);
        setSelectedUrls(prev =>
          prev.length === 0
            ? p.map((x: any) => x.url)
            : prev.filter((u: string) => p.some((x: any) => x.url === u))
        );
      });
    };

    fetchCanvas();

    chrome.runtime.sendMessage({ type: 'auth:status' }, (response) => {
      if (response?.user) setUser(response.user);
    });

    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url) setActiveTabUrl(tabs[0].url);
      });
    }

    const handleMessage = (message: any) => {
      if (message.type === 'canvas:updated' || message.type === 'product:detected') {
        fetchCanvas();
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => { chrome.runtime.onMessage.removeListener(handleMessage); };
  }, []);

  // Close popups on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showPopup && attachPopupRef.current && !attachPopupRef.current.contains(event.target as Node)) {
        const plusBtn    = document.querySelector('.input-action-circle-btn');
        const chevronBtn = document.querySelector('.sharing-chevron');
        if (!plusBtn?.contains(event.target as Node) && !chevronBtn?.contains(event.target as Node)) {
          setShowPopup(false);
        }
      }
      if (showModelPopup && modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setShowModelPopup(false);
      }
      if (showHistoryPopup && historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setShowHistoryPopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => { document.removeEventListener('mousedown', handleClickOutside); };
  }, [showPopup, showModelPopup, showHistoryPopup]);

  // ── Handlers ──
  const handleSignIn  = () => chrome.runtime.sendMessage({ type: 'auth:signin' },  (r) => { if (r?.user) setUser(r.user); });
  const handleSignOut = () => chrome.runtime.sendMessage({ type: 'auth:signout' }, () => setUser(null));

  const handleRemoveProduct = (url: string) => {
    chrome.runtime.sendMessage({ type: 'canvas:remove', url }, () => {
      chrome.runtime.sendMessage({ type: 'canvas:get' }, (response) => {
        const p = response?.canvas || [];
        setProducts(p);
        setSelectedUrls(prev => prev.filter(u => u !== url && p.some((x: any) => x.url === u)));
      });
    });
  };

  const toggleUrl = (url: string) =>
    setSelectedUrls(prev => prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]);

  const handleSelectModel = (val: string) => {
    setModel(val);
    localStorage.setItem('shopmate_model', val);
    setShowModelPopup(false);
  };


  const handleSubmit = () => {
    if (inputValue.trim()) {
      sendMessage({ text: inputValue });
      updateActiveThreadTitle(inputValue);
      setInputValue('');
      if (inputRef.current) inputRef.current.style.height = 'auto';
    }
  };

  const handleSuggestionClick = (text: string) => {
    setInputValue(text);
    updateActiveThreadTitle(text);
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  const isStreaming = status === 'streaming';

  return (
    <>
      {/* ── Header ── */}
      <header id="header">
        <div className="header-title-container" style={{ flex: 1, minWidth: 0 }}>
          <span
            className="brand"
            title={activeThreadTitle === 'New Chat' ? 'Shop Mate' : activeThreadTitle}
            style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {activeThreadTitle === 'New Chat' ? 'Shop Mate' : activeThreadTitle}
          </span>
          <button className="header-icon-btn" title="New Chat" onClick={handleNewChat}>
            <SquarePen size={18} />
          </button>
        </div>

        <div className="header-actions">
          {/* Auth button */}
          {user ? (
            <button
              className="header-icon-btn profile-btn"
              title={`Signed in as ${user.name || user.email}. Click to sign out.`}
              onClick={handleSignOut}
              style={{ padding: 0 }}
            >
              <img src={user.picture} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'block' }} />
            </button>
          ) : (
            <button className="header-icon-btn sign-in-icon-btn" title="Sign in with Google" onClick={handleSignIn}>
              <User size={18} />
            </button>
          )}

          {/* History popup */}
          <div style={{ position: 'relative' }} ref={historyRef}>
            <button
              className={`header-icon-btn ${showHistoryPopup ? 'active' : ''}`}
              title="Recent chats"
              onClick={() => setShowHistoryPopup(!showHistoryPopup)}
            >
              <MoreVertical size={18} />
            </button>
            {showHistoryPopup && (
              <HistoryPopup
                threads={threads}
                activeThreadId={activeThreadId}
                setActiveThreadId={setActiveThreadId}
                setShowHistoryPopup={setShowHistoryPopup}
                onDeleteThread={handleDeleteThread}
              />
            )}
          </div>

          <button className="header-icon-btn" title="Open in new tab">
            <ExternalLink size={18} />
          </button>
          <button className="header-icon-btn" title="Close" onClick={() => window.close()}>
            <X size={18} />
          </button>
        </div>
      </header>

      {/* ── Message area ── */}
      <div id="messages">
        {messages.length === 0 ? (
          <WelcomeScreen onSuggestionClick={handleSuggestionClick} />
        ) : (
          messages.map((msg, idx) => (
            <MessageItem
              key={msg.id}
              msg={msg}
              isLast={idx === messages.length - 1}
              isStreaming={isStreaming}
              addToolApprovalResponse={addToolApprovalResponse}
            />
          ))
        )}

        {/* ── Thinking / tool indicator — inside scroll area, after last message ── */}
        {(isStreaming || activeTool) && (
          <LoadingIndicator toolName={activeTool} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Chat Input ── */}
      <ChatInput
        inputValue={inputValue}
        setInputValue={setInputValue}
        inputRef={inputRef}
        isStreaming={isStreaming}
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        showPopup={showPopup}
        setShowPopup={setShowPopup}
        attachPopupRef={attachPopupRef}
        products={products}
        selectedUrls={selectedUrls}
        selectedProducts={selectedProducts}
        activeTabUrl={activeTabUrl}
        onToggleUrl={toggleUrl}
        showModelPopup={showModelPopup}
        setShowModelPopup={setShowModelPopup}
        modelDropdownRef={modelDropdownRef}
        model={model}
        modelsData={MODELS_DATA}
        selectedModelLabel={selectedModelLabel}
        selectedModelIcon={selectedModelIcon}
        onSelectModel={handleSelectModel}
      />
    </>
  );
}
