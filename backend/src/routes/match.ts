import { Hono } from 'hono';
import { Env, generateProductKey } from '../db/schema';
import { indexProduct, findMatchingProducts } from '../services/vector';

const app = new Hono<{ Bindings: Env }>();

app.post('/match-products', async (c) => {
  const { products } = await c.req.json();

  if (!Array.isArray(products) || products.length < 2) {
    return c.json({ matches: [] });
  }

  // Index all products
  for (const p of products) {
    const key = generateProductKey(p.name, p.store);
    await indexProduct(c.env, key, p.name, p.store, p.description || p.name);
  }

  // Check for matches using the first product as query
  const query = products[0].name;
  const matches = await findMatchingProducts(c.env, query, products.length);

  return c.json({ matches });
});

export default app;
