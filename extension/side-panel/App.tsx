import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react';
import { useAgent } from 'agents/react';
import { useAgentChat } from '@cloudflare/ai-chat/react';
import { SquarePen, MoreVertical, ExternalLink, X, User } from 'lucide-react';

import { HistoryPopup } from './components/HistoryPopup';
import { WelcomeScreen } from './components/WelcomeScreen';
import { MessageItem } from './components/MessageItem';
import { ChatInput } from './components/ChatInput';
import { LoadingIndicator } from './components/LoadingIndicator';
import { useThreads } from './utils/useThreads';

// ── Constants ──
const WORKER_URL = 'http://127.0.0.1:8787';

// Models ordered from basic → advanced
const VALID_MODELS = [
  // ── Basic (1B-3B, fast & cheap) ──
  '@cf/meta/llama-3.2-1b-instruct',
  '@cf/google/gemma-2b-it-lora',
  '@cf/meta/llama-3.2-3b-instruct',
  // ── Intermediate (3B-8B) ──
  '@cf/qwen/qwen3-30b-a3b-fp8',
  '@cf/zai-org/glm-4.7-flash',
  '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
  // ── Advanced (17B-120B) ──
  '@cf/meta/llama-4-scout-17b-16e-instruct',
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/zai-org/glm-5.2',
  '@cf/moonshotai/kimi-k2.6',
  '@cf/openai/gpt-oss-120b',
];
const DEFAULT_MODEL = '@cf/meta/llama-3.2-3b-instruct';

type ModelTier = 'basic' | 'intermediate' | 'advanced';

interface ModelEntry {
  value: string;
  label: string;
  desc: string;
  icon: string;
  tier: ModelTier;
}

const MODELS_DATA: ModelEntry[] = [
  // ── Basic ──
  { value: '@cf/meta/llama-3.2-1b-instruct',       label: 'Llama 3.2 1B',   desc: 'Meta Tiny Text Instruct (fastest, cheapest)',   icon: 'meta.svg',   tier: 'basic' },
  { value: '@cf/google/gemma-2b-it-lora',           label: 'Gemma 2B LoRA',  desc: 'Google Lightweight LoRA Adapter (2B)',          icon: 'google.svg', tier: 'basic' },
  { value: '@cf/meta/llama-3.2-3b-instruct',       label: 'Llama 3.2 3B',   desc: 'Meta Small Text Instruct (balanced)',           icon: 'meta.svg',   tier: 'basic' },
  // ── Intermediate ──
  { value: '@cf/qwen/qwen3-30b-a3b-fp8',            label: 'Qwen 3 30B',    desc: 'Alibaba Multilingual MoE (3B active)',          icon: 'qwen.svg',   tier: 'intermediate' },
  { value: '@cf/zai-org/glm-4.7-flash',             label: 'GLM 4.7 Flash', desc: 'Zhipu AI Fast Bilingual Assistant',              icon: 'zai.svg',    tier: 'intermediate' },
  { value: '@cf/meta/llama-3.1-8b-instruct-fp8-fast', label: 'Llama 3.1 8B', desc: 'Meta Fast Text Instruct (FP8 quantized)',       icon: 'meta.svg',   tier: 'intermediate' },
  // ── Advanced ──
  { value: '@cf/meta/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout', desc: 'Meta MoE Instruct Generalist (17B active)',    icon: 'meta.svg',   tier: 'advanced' },
  { value: '@cf/google/gemma-4-26b-a4b-it',          label: 'Gemma 4 26B',   desc: 'Google MoE Multimodal (4B active)',             icon: 'google.svg', tier: 'advanced' },
  { value: '@cf/zai-org/glm-5.2',                   label: 'GLM 5.2',       desc: 'Zhipu AI High Performance Reasoning',           icon: 'zai.svg',    tier: 'advanced' },
  { value: '@cf/moonshotai/kimi-k2.6',              label: 'Kimi K2.6',     desc: 'Moonshot AI Long Context & Vision',             icon: 'moonshotai.svg', tier: 'advanced' },
  { value: '@cf/openai/gpt-oss-120b',               label: 'GPT-OSS 120B',  desc: 'Open-source frontier text model',               icon: 'openai.svg', tier: 'advanced' },
];

// ── ChatView sub-component: keyed by activeThreadId so it remounts cleanly ──

interface ChatViewProps {
  activeThreadId: string;
  activeThreadTitle: string;
  updateActiveThreadTitle: (title: string) => void;
  handleNewChat: () => void;
  handleDeleteThread: (id: string) => void;
  ensureThreadEntry: () => void;
  threads: { id: string; title: string; createdAt: number }[];
  setActiveThreadId: (id: string) => void;
  model: string;
  selectedProducts: any[];
  user: any;
  products: any[];
  selectedUrls: string[];
  activeTabUrl: string;
  activeTabTitle: string;
  activeTabSuggestions: string[];
  suggestionsLoading: boolean;
  showPopup: boolean;
  setShowPopup: (v: boolean) => void;
  showModelPopup: boolean;
  setShowModelPopup: (v: boolean) => void;
  showHistoryPopup: boolean;
  setShowHistoryPopup: (v: boolean) => void;
  inputValue: string;
  setInputValue: (v: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  attachPopupRef: React.RefObject<HTMLDivElement | null>;
  modelDropdownRef: React.RefObject<HTMLDivElement | null>;
  historyRef: React.RefObject<HTMLDivElement | null>;
  selectedModelLabel: string;
  selectedModelIcon: string;
  onToggleUrl: (url: string) => void;
  onSelectModel: (val: string) => void;
  onRemoveProduct: (url: string) => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

function ChatView(props: ChatViewProps) {
  const {
    activeThreadId,
    activeThreadTitle,
    updateActiveThreadTitle,
    handleNewChat: _handleThreadNewChat,
    handleDeleteThread,
    ensureThreadEntry,
    threads,
    setActiveThreadId,
    model,
    selectedProducts,
    user,
    products,
    selectedUrls,
    activeTabUrl,
    activeTabTitle,
    activeTabSuggestions,
    suggestionsLoading,
    showPopup,
    setShowPopup,
    showModelPopup,
    setShowModelPopup,
    showHistoryPopup,
    setShowHistoryPopup,
    inputValue,
    setInputValue,
    inputRef,
    attachPopupRef,
    modelDropdownRef,
    historyRef,
    selectedModelLabel,
    selectedModelIcon,
    onToggleUrl,
    onSelectModel,
    onRemoveProduct,
    onSignIn,
    onSignOut,
  } = props;

  // ── Agent & chat — clean remount per threadId ──
  const agent = useAgent({
    agent: 'ChatAgent',
    name: activeThreadId,
    host: WORKER_URL,
    onIdentityChange: () => {},
  });

  const { messages, sendMessage, addToolApprovalResponse, status, clearHistory, stop, setMessages } = useAgentChat({
    agent,
    body: { model, canvas: selectedProducts },
  });

  const [pendingEdit, setPendingEdit] = useState<{ text: string } | null>(null);

  // ── Trigger edited message submission after state update ──
  useEffect(() => {
    if (pendingEdit) {
      sendMessage({ text: pendingEdit.text });
      setPendingEdit(null);
    }
  }, [messages, pendingEdit, sendMessage]);

  // ── Agent message listener (title broadcasts) ──
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chat:title') {
          updateActiveThreadTitle(data.title);
        }
      } catch {}
    }
    agent.addEventListener('message', handleMessage);
    return () => agent.removeEventListener('message', handleMessage);
  }, [agent, updateActiveThreadTitle]);

  // ── Active tool detection ──
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

  // ── Find the index of the latest assistant message ──
  const latestAssistantIdx = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        return i;
      }
    }
    return -1;
  }, [messages]);

  // ── Handlers ──
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleNewChat = useCallback(() => {
    if (messages.length === 0) return;
    _handleThreadNewChat();
  }, [messages, _handleThreadNewChat]);

  const handleSubmit = useCallback(() => {
    if (inputValue.trim()) {
      ensureThreadEntry();
      sendMessage({ text: inputValue });
      setInputValue('');
      if (inputRef.current) inputRef.current.style.height = 'auto';
    }
  }, [inputValue, ensureThreadEntry, sendMessage, setInputValue, inputRef]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleSuggestionClick = useCallback((text: string) => {
    setInputValue(text);
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [setInputValue, inputRef]);

  const handleEditMessage = useCallback((messageId: string, newText: string) => {
    const idx = messages.findIndex(m => m.id === messageId);
    if (idx === -1) return;
    
    setPendingEdit({ text: newText });
    setMessages(messages.slice(0, idx));
  }, [messages, setMessages]);

  const handleRegenerateMessage = useCallback((messageId: string) => {
    const idx = messages.findIndex(m => m.id === messageId);
    if (idx === -1) return;
    
    const userMsgIdx = idx - 1;
    if (userMsgIdx < 0) return;
    
    const userMsg = messages[userMsgIdx];
    if (userMsg.role !== 'user') return;
    
    const userText = userMsg.parts.find((p: any) => p.type === 'text')?.text || '';
    if (!userText) return;
    
    setPendingEdit({ text: userText });
    setMessages(messages.slice(0, userMsgIdx));
  }, [messages, setMessages]);

  // ── Scroll to bottom on new messages ──
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // ── Render ──
  const isStreaming = status === 'streaming';

  return (
    <>
      {/* ── Header ── */}
      <header id="header">
        <div className="header-title-container" style={{ flex: 1, minWidth: 0 }}>
          <span
            className="brand"
            title={activeThreadTitle || 'Obot'}
            style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {activeThreadTitle || 'Obot'}
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
              onClick={onSignOut}
              style={{ padding: 0 }}
            >
              <img src={user.picture} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'block' }} />
            </button>
          ) : (
            <button className="header-icon-btn sign-in-icon-btn" title="Sign in with Google" onClick={onSignIn}>
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
          <WelcomeScreen
            user={user}
            onSuggestionClick={handleSuggestionClick}
            activeTabUrl={activeTabUrl}
            activeTabTitle={activeTabTitle}
            llmSuggestions={activeTabSuggestions}
            suggestionsLoading={suggestionsLoading}
          />
        ) : (
          messages.map((msg, idx) => (
            <MessageItem
              key={msg.id}
              msg={msg}
              isLast={idx === messages.length - 1}
              isStreaming={isStreaming}
              addToolApprovalResponse={addToolApprovalResponse}
              onRegenerate={handleRegenerateMessage}
              onEditMessage={handleEditMessage}
              isLatestAssistant={idx === latestAssistantIdx}
            />
          ))
        )}

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
        onStop={stop}
        showPopup={showPopup}
        setShowPopup={setShowPopup}
        attachPopupRef={attachPopupRef}
        products={products}
        selectedUrls={selectedUrls}
        selectedProducts={selectedProducts}
        activeTabUrl={activeTabUrl}
        onToggleUrl={onToggleUrl}
        showModelPopup={showModelPopup}
        setShowModelPopup={setShowModelPopup}
        modelDropdownRef={modelDropdownRef}
        model={model}
        modelsData={MODELS_DATA}
        selectedModelLabel={selectedModelLabel}
        selectedModelIcon={selectedModelIcon}
        onSelectModel={onSelectModel}
      />
    </>
  );
}

const ChatSkeleton = () => {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      background: 'var(--bg-primary, #131314)', 
      padding: '16px', 
      boxSizing: 'border-box' 
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: '40px',
        marginBottom: '20px',
        width: '100%'
      }}>
        <div className="skeleton-glow" style={{ width: '80px', height: '14px', borderRadius: '7px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="skeleton-glow" style={{ width: '80px', height: '14px', borderRadius: '7px' }} />
          <X size={16} style={{ color: 'var(--text-muted, #8e8e8e)', opacity: 0.6 }} />
        </div>
      </div>
      
      {/* Content Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '100%',
        overflow: 'hidden'
      }}>
        {/* Large Top Card */}
        <div className="skeleton-glow" style={{
          flex: '0 0 55%',
          borderRadius: '16px',
          width: '100%'
        }} />
        
        {/* Smaller Bottom Card */}
        <div className="skeleton-glow" style={{
          flex: '0 0 25%',
          borderRadius: '16px',
          width: '100%'
        }} />
      </div>
    </div>
  );
};

// ── Main App ──
export default function App() {
  // ── Tab state ──
  const [tabs, setTabs]               = useState<any[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [activeTabUrl, setActiveTabUrl]         = useState<string>('');
  const [activeTabTitle, setActiveTabTitle]     = useState<string>('');
  const [activeTabSuggestions, setActiveTabSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading]     = useState(false);
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
    ensureThreadEntry,
  } = useThreads();

  // ── Derived ──
  const selectedProducts = useMemo(
    () => tabs.filter(t => selectedUrls.includes(t.url)).map(t => t.product).filter(Boolean),
    [tabs, selectedUrls],
  );

  const selectedModelLabel = useMemo(() => {
    const found = MODELS_DATA.find(m => m.value === model);
    return found ? found.label : model.split('/').pop()!;
  }, [model]);

  const selectedModelIcon = useMemo(() => {
    const found = MODELS_DATA.find(m => m.value === model);
    return found ? found.icon : '';
  }, [model]);

  // ── Effects ──
  useEffect(() => {
    const fetchTabs = () => {
      chrome.runtime.sendMessage({ type: 'canvas:get' }, (response) => {
        const t = response?.tabs || [];
        setTabs(t);
        setSelectedUrls(prev =>
          prev.length === 0
            ? t.map((x: any) => x.url)
            : prev.filter((u: string) => t.some((x: any) => x.url === u))
        );
      });
    };

    fetchTabs();

    chrome.runtime.sendMessage({ type: 'auth:status' }, (response) => {
      if (response?.user) setUser(response.user);
    });

    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabUrl   = tabs[0]?.url   || '';
        const tabTitle = tabs[0]?.title || '';
        if (tabs[0]?.url)   setActiveTabUrl(tabUrl);
        if (tabs[0]?.title) setActiveTabTitle(tabTitle);

        // Generate LLM suggestions for the active tab
        if (tabUrl && !tabUrl.startsWith('chrome://')) {
          console.log('[Obot][suggestions] active tab:', tabUrl, '| title:', tabTitle);
          setSuggestionsLoading(true);
          setActiveTabSuggestions([]);

          // Extract a short page text via the content script (best-effort).
          // If the content script isn't injected into this tab, lastError is set
          // and we simply fall back to an empty pageText.
          const runSuggestions = (pageText: string) => {
            console.log('[Obot][suggestions] posting to /api/suggestions, pageText len:', pageText.length);
            fetch(`${WORKER_URL}/api/suggestions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: tabUrl, title: tabTitle, pageText }),
            })
              .then((r) => {
                console.log('[Obot][suggestions] response status:', r.status);
                return r.json();
              })
              .then((data: any) => {
                console.log('[Obot][suggestions] response data:', JSON.stringify(data));
                console.log('[Obot][suggestions] DEBUG:', JSON.stringify(data?.debug));
                if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
                  console.log('[Obot][suggestions] setting', data.suggestions.length, 'suggestions');
                  setActiveTabSuggestions(data.suggestions);
                } else {
                  console.log('[Obot][suggestions] no suggestions in response');
                }
              })
              .catch((e) => { console.log('[Obot][suggestions] fetch error:', e); })
              .finally(() => setSuggestionsLoading(false));
          };

          if (typeof chrome !== 'undefined' && chrome.tabs?.sendMessage) {
            chrome.tabs.sendMessage(
              tabs[0]!.id!,
              { type: 'pageText:get' },
              (response) => {
                const pageText = chrome.runtime.lastError ? '' : (response?.text || '');
                console.log('[Obot][suggestions] pageText from content script len:', pageText.length, '| lastError:', chrome.runtime.lastError?.message || 'none');
                runSuggestions(pageText);
              }
            );
          } else {
            runSuggestions('');
          }
        }
      });
    }

    const handleMessage = (message: any) => {
      if (message.type === 'canvas:updated' || message.type === 'product:detected') {
        fetchTabs();
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

  // ── Render ──
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatView
        key={activeThreadId}
        activeThreadId={activeThreadId}
        activeThreadTitle={activeThreadTitle}
        updateActiveThreadTitle={updateActiveThreadTitle}
        handleNewChat={_handleNewChat}
        handleDeleteThread={handleDeleteThread}
        ensureThreadEntry={ensureThreadEntry}
        threads={threads}
        setActiveThreadId={setActiveThreadId}
        model={model}
        selectedProducts={selectedProducts}
        user={user}
        products={tabs}
        selectedUrls={selectedUrls}
        activeTabUrl={activeTabUrl}
        activeTabTitle={activeTabTitle}
        activeTabSuggestions={activeTabSuggestions}
        suggestionsLoading={suggestionsLoading}
        showPopup={showPopup}
        setShowPopup={setShowPopup}
        showModelPopup={showModelPopup}
        setShowModelPopup={setShowModelPopup}
        showHistoryPopup={showHistoryPopup}
        setShowHistoryPopup={setShowHistoryPopup}
        inputValue={inputValue}
        setInputValue={setInputValue}
        inputRef={inputRef}
        attachPopupRef={attachPopupRef}
        modelDropdownRef={modelDropdownRef}
        historyRef={historyRef}
        selectedModelLabel={selectedModelLabel}
        selectedModelIcon={selectedModelIcon}
        onToggleUrl={toggleUrl}
        onSelectModel={handleSelectModel}
        onRemoveProduct={handleRemoveProduct}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />
    </Suspense>
  );
}
