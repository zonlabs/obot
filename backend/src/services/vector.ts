import { Env } from '../db/schema';
import { generateEmbedding } from './ai';

export async function indexProduct(
  env: Env,
  productKey: string,
  name: string,
  store: string,
  description: string
): Promise<void> {
  const embedding = await generateEmbedding(env.AI, `${name} ${store} ${description}`);
  const metadata = { productKey, name, store };
  await env.VECTORIZE.upsert([{ id: productKey, values: embedding, metadata }]);
}

export async function findMatchingProducts(
  env: Env,
  query: string,
  limit: number = 5
): Promise<Array<{ productKey: string; name: string; store: string; score: number }>> {
  const embedding = await generateEmbedding(env.AI, query);
  const result = await env.VECTORIZE.query(embedding, { topK: limit });
  return result.matches.map(m => ({
    productKey: m.metadata!.productKey as string,
    name: m.metadata!.name as string,
    store: m.metadata!.store as string,
    score: m.score!
  }));
}
