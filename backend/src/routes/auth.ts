import { Hono } from 'hono';
import { Env } from '../db/schema';

const app = new Hono<{ Bindings: Env }>();

app.post('/auth/google', async (c) => {
  try {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const { token } = body;
    if (!token) {
      return c.json({ error: 'Missing token' }, 400);
    }

    // Verify token with Google userinfo endpoint
    const verifyRes = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!verifyRes.ok) {
      const errText = await verifyRes.text().catch(() => '');
      console.error('Google token verification failed', verifyRes.status, errText.slice(0, 500));
      return c.json({
        error: `Google sign-in failed`,
        detail: { status: verifyRes.status, body: errText.slice(0, 200) }
      }, 401);
    }

    const googleUser: any = await verifyRes.json();
    if (!googleUser.email) {
      return c.json({ error: 'Email not available from Google' }, 401);
    }

    const name = googleUser.name || googleUser.email.split('@')[0];
    const picture = googleUser.picture || null;

    // Upsert user
    const existing: any = await c.env.DB.prepare(
      'SELECT id, email, name, picture, plan FROM users WHERE email = ?'
    ).bind(googleUser.email).first();

    let userId: string;
    if (existing) {
      userId = existing.id;
      // Update name/picture on each sign-in
      await c.env.DB.prepare(
        'UPDATE users SET name = ?, picture = ? WHERE id = ?'
      ).bind(name, picture, userId).run();
    } else {
      userId = crypto.randomUUID();
      await c.env.DB.prepare(
        'INSERT INTO users (id, email, name, picture, plan) VALUES (?, ?, ?, ?, ?)'
      ).bind(userId, googleUser.email, name, picture, 'free').run();
    }

    // Create session
    const sessionId = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO sessions (id, user_id) VALUES (?, ?)'
    ).bind(sessionId, userId).run();

    return c.json({
      sessionId,
      user: { id: userId, email: googleUser.email, name, picture, plan: 'free' }
    });
  } catch (err) {
    console.error('Auth error:', err);
    return c.json({ error: `Internal error: ${(err as Error).message}` }, 500);
  }
});

app.post('/auth/logout', async (c) => {
  const { sessionId } = await c.req.json();
  if (!sessionId) return c.json({ error: 'Missing sessionId' }, 400);

  await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
  return c.json({ success: true });
});

app.get('/auth/me', async (c) => {
  const sessionId = c.req.header('x-session-id');
  if (!sessionId) return c.json({ user: null });

  const session = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.plan FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ?`
  ).bind(sessionId).first<{ id: string; email: string; plan: string }>();

  return c.json({ user: session || null });
});

export default app;
