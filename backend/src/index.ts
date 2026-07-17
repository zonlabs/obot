import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { routeAgentRequest } from 'agents';
import { Env } from './db/schema';
import { ChatAgent } from './agent';
import chatRoute from './routes/chat';
import extractRoute from './routes/extract';
import priceHistoryRoute from './routes/price-history';
import couponsRoute from './routes/coupons';
import matchRoute from './routes/match';
import authRoute from './routes/auth';
import threadsRoute from './routes/threads';
import titleRoute from './routes/title';

export { ChatAgent };

const app = new Hono<{ Bindings: Env }>();

app.use('/*', cors({
  origin: ['chrome-extension://*'],
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

app.route('/api', chatRoute);
app.route('/api', extractRoute);
app.route('/api', priceHistoryRoute);
app.route('/api', couponsRoute);
app.route('/api', matchRoute);
app.route('/api', authRoute);
app.route('/api', threadsRoute);
app.route('/api', titleRoute);

app.get('/api/health', (c) => c.json({ status: 'ok' }));

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
