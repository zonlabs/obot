import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { routeAgentRequest } from 'agents';
import { Env } from './db/schema';
import { ChatAgent } from './agent';
import chatRoute from './routes/chat';
// import extractRoute from './routes/extract';
// import priceHistoryRoute from './routes/price-history';
// import couponsRoute from './routes/coupons';
// import matchRoute from './routes/match';
import authRoute from './routes/auth';
import threadsRoute from './routes/threads';
import suggestionsRoute from './routes/suggestions';

export { ChatAgent };

const app = new Hono<{ Bindings: Env }>();

app.use('/*', cors({
  origin: ['chrome-extension://*'],
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

app.route('/api', chatRoute);
// app.route('/api', extractRoute);
// app.route('/api', priceHistoryRoute);
// app.route('/api', couponsRoute);
// app.route('/api', matchRoute);
app.route('/api', authRoute);
app.route('/api', threadsRoute);
app.route('/api', suggestionsRoute);

app.get('/api/health', (c) => c.json({ status: 'ok' }));

// OAuth success redirect — shown after completing MCP server authorization
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Authorization Complete</title>
  <style>
    body { margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh;
           font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #0f0f11; color: #e2e8f0; }
    .card { text-align: center; padding: 40px; background: #1a1a1e; border-radius: 16px;
            border: 1px solid #2a2a30; max-width: 360px; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { margin: 0 0 8px; font-size: 20px; font-weight: 600; }
    p { margin: 0; font-size: 14px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Authorization Complete</h1>
    <p>You can close this tab and return to the Obot extension. Click <strong>Refresh status</strong> in the Plugins modal to confirm the connection.</p>
  </div>
  <script>
    // Auto-close after 3s if opened as a popup
    if (window.opener) setTimeout(() => window.close(), 3000);
  </script>
</body>
</html>`);
});

function corsify(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) {
      if (agentResponse.status !== 101) {
        return corsify(agentResponse);
      }
      return agentResponse;
    }
    return app.fetch(request, env);
  },
};
