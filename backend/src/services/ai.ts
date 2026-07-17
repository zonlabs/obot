import { Env } from '../db/schema';

const CHAT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8-fast';
const EMBED_MODEL = '@cf/baai/bge-base-en-v1.5';

export async function generateChatResponse(
  ai: Ai,
  prompt: string,
  productContext: string
): Promise<string> {
  const systemPrompt = `You are a shopping assistant. Help the user compare products, find deals, and make purchase decisions. Use the product data provided to give specific, accurate answers about prices, specs, and value. Be concise and direct. Current product context:\n${productContext}`;

  const result = await ai.run(CHAT_MODEL, {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    max_tokens: 1024,
    temperature: 0.3
  });

  return (result as any).response;
}

export async function generateEmbedding(
  ai: Ai,
  text: string
): Promise<number[]> {
  const result = await ai.run(EMBED_MODEL, { text: [text] });
  return (result as any).data[0].embedding;
}
