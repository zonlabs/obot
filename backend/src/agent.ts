import { AIChatAgent, ChatMessage } from "@cloudflare/ai-chat";
import { createWorkersAI } from "workers-ai-provider";
import { streamText, convertToModelMessages, pruneMessages, createUIMessageStreamResponse, toUIMessageStream } from "ai";
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
    _onFinish?: (event: { message: ChatMessage }) => void,
    options?: { body?: Record<string, unknown> }
  ) {
    const workersai = createWorkersAI({ binding: this.env.AI });
    const modelName = (options?.body?.model as string) || DEFAULT_MODEL;
    const canvas = options?.body?.canvas as any[] | undefined;

    const result = streamText({
      model: workersai(modelName),
      system: buildSystemPrompt(canvas || []),
      messages: pruneMessages({
        messages: await convertToModelMessages(this.messages),
        toolCalls: "before-last-2-messages",
      }),
      tools: shoppingTools,
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  }
}
