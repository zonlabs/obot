import { AIChatAgent, OnChatMessageOptions } from "@cloudflare/ai-chat";
import { createWorkersAI } from "workers-ai-provider";
import { streamText, convertToModelMessages, pruneMessages, createUIMessageStreamResponse, toUIMessageStream, GenerateTextOnEndCallback } from "ai";
import { Env } from "./db/schema";
import { shoppingTools } from "./tools";

const DEFAULT_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

function buildSystemPrompt(canvas: any[]): string {
  if (!canvas || canvas.length === 0) {
    return "You are a concise shopping assistant. Help the user compare products, find deals, and make purchase decisions. Be direct.";
  }
  const ctx = canvas.map((p: any, i: number) =>
    `[Product ${i + 1}] ${p.name || "Unknown"}${p.store ? " at " + p.store : ""}${p.price ? " \u2014 " + (p.currency || "$") + p.price : ""}`
  ).join("\n");
  return "You are a concise shopping assistant. Help the user compare products, find deals, and make purchase decisions. Use the product data below to give specific, accurate answers. Be direct.\n\n" + ctx;
}

export class ChatAgent extends AIChatAgent<Env> {
  async onChatMessage(
    _onFinish: GenerateTextOnEndCallback,
    _options?: OnChatMessageOptions
  ) {
    const workersai = createWorkersAI({ binding: this.env.AI });
    const modelName = (_options?.body?.model as string) || DEFAULT_MODEL;
    const canvas = _options?.body?.canvas as any[] | undefined;

    const isFirstTurn = this.messages.length <= 2;
    const userMessage = isFirstTurn
      ? this.messages
          .filter(m => m.role === 'user')
          .flatMap(m => m.parts.filter((p): p is { type: 'text'; text: string } => p.type === 'text'))
          .map(p => p.text)
          .join('')
          .trim()
      : '';

    const result = streamText({
      model: workersai(modelName),
      system: buildSystemPrompt(canvas || []),
      messages: pruneMessages({
        messages: await convertToModelMessages(this.messages),
        toolCalls: "before-last-2-messages",
      }),
      tools: shoppingTools,
      onFinish: async (event) => {
        _onFinish?.(event);

        if (userMessage) {
          try {
            const res: any = await this.env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
              messages: [
                { role: 'system', content: 'Generate a concise title (max 6 words) for a shopping assistant chat based on the user\'s first message. Reply with ONLY the title — no quotes, no punctuation, no explanation.' },
                { role: 'user', content: userMessage },
              ],
              max_tokens: 15,
              temperature: 0.3,
            });
            const title = (res.response?.trim() || 'New Chat').replace(/^["']|["']$/g, '') || 'New Chat';
            this.broadcast(JSON.stringify({ type: 'chat:title', title }));
          } catch {
            // Title generation failed — keep default "New Chat"
          }
        }
      },
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  }
}
