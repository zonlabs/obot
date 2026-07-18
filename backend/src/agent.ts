import { AIChatAgent, OnChatMessageOptions, createToolsFromClientSchemas } from "@cloudflare/ai-chat";
import { createWorkersAI } from "workers-ai-provider";
import { streamText, convertToModelMessages, pruneMessages, createUIMessageStreamResponse, toUIMessageStream, GenerateTextOnEndCallback, isStepCount } from "ai";
import { Env } from "./db/schema";


const DEFAULT_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
const EXA_MCP_URL = "https://mcp.exa.ai/mcp?tools=web_search_exa,web_search_advanced_exa,web_fetch_exa";

function buildSystemPrompt(): string {
  return "You are Obot, a concise assistant that helps the user with whatever they need. " +
         "You have access to the following client-side tools:\n" +
         "- getActiveTabs: gets the URL, title, and type (active, selected, active & selected) of the user's currently active tabs and explicitly attached tabs.\n" +
         "- getTabContent: reads the visible text content from any tab by URL.\n\n" +
         "Guidelines:\n" +
         "1. If the user asks about the page/tab they are currently on or looking at, use getActiveTabs first to discover the active URLs, then use getTabContent with the relevant URL to read its content.";
}

export class ChatAgent extends AIChatAgent<Env> {
  async onStart() {
    await this.addMcpServer("exa", EXA_MCP_URL);
  }

  async onChatMessage(
    _onFinish: GenerateTextOnEndCallback,
    _options?: OnChatMessageOptions
  ) {
    const workersai = createWorkersAI({ binding: this.env.AI });
    const modelName = (_options?.body?.model as string) || DEFAULT_MODEL;

    const isFirstTurn = this.messages.length <= 2;
    const userMessage = isFirstTurn
      ? this.messages
          .filter(m => m.role === 'user')
          .flatMap(m => m.parts.filter((p): p is { type: 'text'; text: string } => p.type === 'text'))
          .map(p => p.text)
          .join('')
          .trim()
      : '';

    try {
      const result = streamText({
        model: workersai(modelName),
        system: buildSystemPrompt(),
        messages: pruneMessages({
          messages: await convertToModelMessages(this.messages),
          toolCalls: "before-last-2-messages",
        }),
        tools: (_options?.clientTools?.length ? createToolsFromClientSchemas(_options.clientTools) : {}),
        maxOutputTokens: 1024,
        temperature: 0.3,
        stopWhen: isStepCount(10),
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
    } catch (err) {
      const msg = `Error with model "${modelName}": ${err instanceof Error ? err.message : String(err)}`;
      console.error('[ChatAgent]', msg);
      return new Response(msg, { status: 500 });
    }
  }
}
