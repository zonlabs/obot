import { AIChatAgent, OnChatMessageOptions, createToolsFromClientSchemas } from "@cloudflare/ai-chat";
import { callable } from "agents";
import { createWorkersAI } from "workers-ai-provider";
import { streamText, convertToModelMessages, pruneMessages, createUIMessageStreamResponse, toUIMessageStream, GenerateTextOnEndCallback, isStepCount, UIMessage } from "ai";
import { Env } from "./db/schema";

const DEFAULT_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
const EXA_MCP_URL = "https://mcp.exa.ai/mcp?tools=web_search_exa,web_search_advanced_exa,web_fetch_exa";

function buildSystemPrompt(): string {
  return "You are Obot, a helpful assistant embedded in the user's browser. " +
    "Tools available: getActiveTabs (list open tabs), getTabContent (read page content by URL, supports offset pagination — next offset = current offset + returned length). " +
    "Always call getTabContent on the active tab URL when the user asks about what's on their screen. Never guess page content from its URL.";
}

export class ChatAgent extends AIChatAgent<Env> {
  async onStart() {
    // Register the built-in exa server only on the stable plugins DO instance.
    if (this.name?.includes("plugins")) {
      await this.addMcpServer("exa", EXA_MCP_URL, { id: "ExavMbPd" });
    }
  }

  @callable()
  getMcpState() {
    return this.getMcpServers();
  }

  @callable()
  async addPlugin(name: string, url: string): Promise<{
    success: boolean;
    requiresAuth: boolean;
    authUrl?: string;
    error?: string;
  }> {
    try {
      const result = await this.addMcpServer(name, url);
      if (result.state === 'authenticating') {
        return { success: true, requiresAuth: true, authUrl: result.authUrl };
      }
      return { success: true, requiresAuth: false };
    } catch (err) {
      return { success: false, requiresAuth: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  @callable()
  async removePlugin(serverId: string): Promise<{ success: boolean; error?: string }> {
    if (serverId === 'exa') return { success: false, error: 'Cannot remove built-in exa server' };
    try {
      await this.removeMcpServer(serverId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
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
      const clientTools = _options?.clientTools?.length ? createToolsFromClientSchemas(_options.clientTools) : {};

      const pluginsAgentId = _options?.body?.pluginsAgentId as string | undefined;

      if (pluginsAgentId) {
        try {
          const stub = this.env.ChatAgent.get(this.env.ChatAgent.idFromName(pluginsAgentId)) as any;
          const state: any = await stub.getMcpState();
          for (const [, server] of Object.entries<{ name: string; server_url: string }>(state.servers)) {
            await this.addMcpServer(server.name, server.server_url);
          }
        } catch (err) {
          console.error("[ChatAgent] Failed to fetch and connect remote plugins:", err);
        }
      }

      const mcpTools = await this.mcp.getAITools();

      const result = streamText({
        model: workersai(modelName),
        system: buildSystemPrompt(),
        messages: pruneMessages({
          messages: await convertToModelMessages(this.messages),
          toolCalls: "before-last-2-messages",
        }),
        tools: {
          ...clientTools,
          ...mcpTools,
        },
        maxOutputTokens: 1024,
        temperature: 0.3,
        stopWhen: isStepCount(10),
        onFinish: async (event) => {
          _onFinish?.(event);

          if (userMessage) {
            try {
              const res: any = await this.env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
                messages: [
                  { role: 'system', content: 'Generate a concise title (max 6 words) for a chat based on the user\'s first message. Reply with ONLY the title — no quotes, no punctuation, no explanation.' },
                  { role: 'user', content: userMessage },
                ],
                max_tokens: 15,
                temperature: 0.3,
              });
              const title = (res.response?.trim() || 'New Chat').replace(/^[\"']|[\"']$/g, '') || 'New Chat';
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

  override async persistMessages(
    messages: UIMessage[],
    excludeBroadcastIds?: string[],
    options?: { _deleteStaleRows?: boolean }
  ): Promise<void> {
    const clientIds = new Set(messages.map(m => m.id));
    const staleIds = this.messages
      .map(m => m.id)
      .filter(id => !clientIds.has(id));

    if (staleIds.length > 0) {
      for (const id of staleIds) {
        this.sql`DELETE FROM cf_ai_chat_agent_messages WHERE id = ${id}`;
        (this as any)._persistedMessageCache?.delete(id);
      }
    }

    await super.persistMessages(messages, excludeBroadcastIds, options);
  }
}
