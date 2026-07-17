# Plan: React Side Panel + Cloudflare Agents Framework

## Global Constraints

- `agents` package: latest (for `routeAgentRequest`, `useAgent` from `agents/react`)
- `@cloudflare/ai-chat`: latest (for `AIChatAgent`, `useAgentChat` from `@cloudflare/ai-chat/react`)
- React 19, esbuild for bundling
- Keep Hono for non-chat routes (auth, extract, coupons, match, price-history, health)
- Keep service worker for canvas management, auth relay, product detection
- Keep existing side panel theme (red/white/black, same HTML structure)
- MV3 manifest
- Workers AI model: configurable via `localStorage`, default `@cf/meta/llama-3.1-8b-instruct-fp8-fast`
- All existing functionality must continue working

## Tasks

### Task 1: Backend — Add Cloudflare Agents Framework

**Files:**
- `shop-assistant/backend/package.json` — add `agents`, `@cloudflare/ai-chat` deps
- `shop-assistant/backend/wrangler.jsonc` — add Durable Objects binding + migration
- `shop-assistant/backend/src/agent.ts` — NEW: `ChatAgent` class extending `AIChatAgent`
- `shop-assistant/backend/src/index.ts` — update to try `routeAgentRequest` first, fall back to Hono

**ChatAgent spec:**
- Accepts `model` query param on WebSocket connect, stores in `this.state.model`
- In `onChatMessage()`:
  - Creates `workersai` from Workers AI binding
  - Calls `streamText` with the stored model (default `@cf/meta/llama-3.1-8b-instruct-fp8-fast`)
  - Builds system prompt from canvas-like context (or use a general shopping assistant prompt)
  - Has 3 server-side tools:
    1. `getProductDetails(name: string, store?: string)` — returns product info (mock/simulated for now)
    2. `compareProducts(products: string[])` — compares products across attributes (mock)
    3. `findDeals(category?: string, maxPrice?: number)` — finds deals (mock)
  - Uses `pruneMessages` + `convertToModelMessages` for message history
  - Returns `result.toUIMessageStreamResponse()`
- Agent name: `ChatAgent` (DO class name)
- DO binding name: `ChatAgent`

**Wrangler changes:**
- Add `durable_objects.bindings: [{ name: "ChatAgent", class_name: "ChatAgent" }]`
- Add `migrations: [{ tag: "v1", new_sqlite_classes: ["ChatAgent"] }]`

**Index.ts changes:**
```ts
import { routeAgentRequest } from "agents";

// Before Hono
const agentResponse = await routeAgentRequest(request, env);
if (agentResponse) return agentResponse;
// Fall back to Hono
```

**Does NOT change:**
- Other Hono routes
- D1/Vectorize/KV configuration
- Compatibility date/flags

### Task 2: Extension — Build System + React Side Panel

**Files:**
- `shop-assistant/extension/package.json` — NEW with deps + build script
- `shop-assistant/extension/side-panel/main.tsx` — NEW: React entry
- `shop-assistant/extension/side-panel/App.tsx` — NEW: Chat component with `useAgent`/`useAgentChat`
- `shop-assistant/extension/side-panel/index.html` — minor update (JS src path)
- `shop-assistant/extension/side-panel/style.css` — no changes

**Build system:**
- esbuild bundles `side-panel/main.tsx` → `side-panel/dist/app.js`
- JSX automatic runtime, tsconfig for JSX
- Build command: `npx esbuild side-panel/main.tsx --bundle --outfile=side-panel/dist/app.js --loader:.tsx=tsx --define:process.env.NODE_ENV=\"production\"`

**React App spec:**
- `main.tsx`: imports React, renders `<App />` into `#root`
- `App.tsx`:
  - Fetches `WORKER_URL` from `chrome.runtime.sendMessage({ type: 'config:get' })` on mount
  - Calls `useAgent({ agent: "ChatAgent", baseUrl: WORKER_URL })` with the worker URL
  - Calls `useAgentChat({ agent, onToolCall })` for chat state
  - Renders:
    - Header (brand + tab count badge) — same as current HTML
    - Canvas bar (shopping across N products) — from `chrome.runtime.sendMessage({ type: 'canvas:get' })`
    - Account bar (sign in / profile) — same as current
    - Error banner — same
    - Messages list — renders each message's parts (text, tool calls, approvals)
    - Product chips — same as current
    - Model selector — same select, persisted in localStorage
    - Input area — textarea + send
  - `onToolCall`: handles any client-side tools (none for now, but hook is ready)

**Wiring existing features:**
- Canvas updates: listen for `chrome.storage.onChanged` or poll via `chrome.runtime.sendMessage`
- Auth: same `chrome.runtime.sendMessage({ type: 'auth:*' })` calls
- Model selector: `localStorage.getItem('shopmate_model')` passed as WebSocket query param

**index.html changes:**
- Add `<div id="root"></div>` before messages div (or replace messages div positioning)
- Change script src from `app.js` to `dist/app.js`

### Task 3: Service Worker & Manifest — Minor Updates

**Files:**
- `shop-assistant/extension/service-worker.ts` — no functional changes needed; verify `config:get` works
- `shop-assistant/extension/manifest.json` — update `side_panel.default_path` if needed; no structural changes

**Actually, task 3 may not need a separate subagent. The service worker already handles `config:get` which returns `WORKER_URL`. The React app uses this to connect the agent. No functional changes needed.**

So effectively 2 independent tasks (Task 1 and Task 2), plus a final review.
