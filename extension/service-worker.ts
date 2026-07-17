import { ProductData, CanvasState, ChatRequest, ChatResponse } from './shared/types';

const WORKER_URL = 'https://shop-assistant-api.himanshu-mehta-sde.workers.dev';

let canvas: CanvasState = { tabs: {}, activeTabId: null };

async function saveCanvas(): Promise<void> {
  await chrome.storage.session.set({ canvas });
}

async function loadCanvas(): Promise<void> {
  const stored = await chrome.storage.session.get('canvas');
  if (stored.canvas) canvas = stored.canvas as CanvasState;
}

// Restore canvas from session storage on startup
const ready = loadCanvas().then(() => { updateBadge(); console.log('[SW] Canvas restored from storage:', Object.keys(canvas.tabs).length, 'tabs'); });

// Track active tab
chrome.tabs.onActivated.addListener((activeInfo) => {
  canvas.activeTabId = activeInfo.tabId;
});

// Remove product data when tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  delete canvas.tabs[tabId];
  saveCanvas();
  updateBadge();
});

// Listen for product data from content script
chrome.runtime.onMessage.addListener((
  message: any,
  sender: chrome.runtime.MessageSender
) => {
  if (message.type === 'product:detected' && sender.tab?.id) {
    const tabId = sender.tab.id;
    console.log('[SW] Received product:detected from tab', tabId, message.data?.name);
    ready.then(() => {
      canvas.tabs[tabId] = message.data as ProductData;
      saveCanvas();
      updateBadge();
      console.log('[SW] Canvas now has', Object.keys(canvas.tabs).length, 'products');
      logPriceHistory(message.data as ProductData).catch(() => {});
    });
  }
});

// Open side panel on toolbar icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id! });
});

// Handle messages from side panel
chrome.runtime.onMessage.addListener((
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
) => {
  ready.then(() => {
    if (message.type === 'chat:send') {
      handleChat(message.prompt).then(sendResponse);
    } else if (message.type === 'canvas:get') {
      sendResponse({ canvas: Object.values(canvas.tabs) });
      console.log('[SW] canvas:get returned', Object.values(canvas.tabs).length, 'products');
    } else if (message.type === 'canvas:remove') {
      const url = message.url as string;
      for (const [tid, p] of Object.entries(canvas.tabs)) {
        if (p.url === url) { delete canvas.tabs[Number(tid)]; break; }
      }
      saveCanvas();
      updateBadge();
      console.log('[SW] canvas:remove — canvas now has', Object.keys(canvas.tabs).length, 'products');
      sendResponse({ success: true });
    } else if (message.type === 'config:get') {
      sendResponse({ workerUrl: WORKER_URL });
    } else if (message.type === 'auth:signin') {
      handleSignIn().then(sendResponse);
    } else if (message.type === 'auth:signout') {
      handleSignOut().then(sendResponse);
    } else if (message.type === 'auth:status') {
      checkAuthStatus().then(sendResponse);
    }
  });
  return true;
});

async function handleSignIn(): Promise<{ user: any } | { error: string }> {
  try {
    const { token } = await chrome.identity.getAuthToken({ interactive: true });
    if (!token) return { error: 'Sign-in failed' };
    const res = await fetch(`${WORKER_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      await chrome.identity.removeCachedAuthToken({ token });
      const err = await res.json();
      return { error: err.error || 'Sign-in failed' };
    }

    const data = await res.json();
    await chrome.storage.local.set({ sessionId: data.sessionId, user: data.user });
    return { user: data.user };
  } catch (err) {
    return { error: 'Sign-in cancelled or failed' };
  }
}

async function handleSignOut(): Promise<{ success: boolean }> {
  const { sessionId } = await chrome.storage.local.get('sessionId');
  if (sessionId) {
    await fetch(`${WORKER_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    }).catch(() => {});
  }
  await chrome.storage.local.remove(['sessionId', 'user']);
  // Revoke the Chrome identity token
  const authResult = await new Promise<{ token?: string }>((resolve) => {
    chrome.identity.getAuthToken({ interactive: false }, (t) => resolve({ token: t.token }));
  });
  if (authResult.token) {
    await chrome.identity.removeCachedAuthToken({ token: authResult.token });
  }
  return { success: true };
}

async function checkAuthStatus(): Promise<{ user: any }> {
  const { user } = await chrome.storage.local.get('user');
  return { user: user || null };
}

async function handleChat(prompt: string): Promise<ChatResponse> {
  const sessionId = await getOrCreateSessionId();
  const products = Object.values(canvas.tabs);

  const request: ChatRequest = { prompt, canvas: products, sessionId };

  try {
    const res = await fetch(`${WORKER_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      return { message: 'Sorry, I had trouble answering that. Please try again.', structured: null };
    }

    return await res.json();
  } catch {
    return { message: 'Network error. Make sure you\'re connected to the internet.', structured: null };
  }
}

async function getOrCreateSessionId(): Promise<string> {
  const { sessionId } = await chrome.storage.local.get('sessionId');
  if (sessionId) return sessionId as string;

  const newId = crypto.randomUUID();
  await chrome.storage.local.set({ sessionId: newId });
  return newId;
}

function updateBadge(): void {
  const count = Object.keys(canvas.tabs).length;
  if (count > 0) {
    chrome.action.setBadgeText({ text: String(count) });
    chrome.action.setBadgeBackgroundColor({ color: '#E53935' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

async function logPriceHistory(product: ProductData): Promise<void> {
  await fetch(`${WORKER_URL}/api/price-history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: product.name,
      store: product.store,
      url: product.url,
      price: product.price,
      currency: product.currency,
    }),
  });
}
