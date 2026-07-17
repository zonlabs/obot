import { Hono } from 'hono';
import { Env } from '../db/schema';

const app = new Hono<{ Bindings: Env }>();

app.post('/title', async (c) => {
  try {
    const { messages } = await c.req.json();
    const firstMessage = messages?.[0]?.content?.trim();
    if (!firstMessage) {
      return c.json({ title: 'New Chat' });
    }

    const result: any = await c.env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'Generate a concise title (max 6 words) for a shopping assistant chat based on the user\'s first message. Reply with ONLY the title — no quotes, no punctuation, no explanation.',
        },
        {
          role: 'user',
          content: firstMessage,
        },
      ],
      max_tokens: 15,
      temperature: 0.3,
    });

    const title = (result.response?.trim() || 'New Chat').replace(/^["']|["']$/g, '');
    return c.json({ title: title || 'New Chat' });
  } catch (err) {
    console.error('Title generation error:', err);
    return c.json({ title: 'New Chat' });
  }
});

export default app;
