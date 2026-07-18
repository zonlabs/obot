import { AITool } from '@cloudflare/ai-chat/react';

export const clientTools: Record<string, AITool<any, any>> = {
  getTabContent: {
    description: 'Get the visible text content of a selected tab by its URL. Use this to read product details, reviews, or any page info from tabs the user has shared.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The full URL of the tab to read' },
      },
      required: ['url'],
    },
    execute: async (input: unknown) => {
      console.log('[getTabContent] execute called with input:', input);
      const { url } = input as { url: string };
      console.log('[getTabContent] url:', url);
      
      const cleanUrl = (u: string) => {
        try {
          const parsed = new URL(u);
          let pathname = parsed.pathname;
          if (pathname.endsWith('/')) {
            pathname = pathname.slice(0, -1);
          }
          return `${parsed.protocol}//${parsed.host}${pathname}`;
        } catch {
          return u.toLowerCase().replace(/\/$/, '');
        }
      };

      try {
        const tabs = await chrome.tabs.query({});
        console.log('[getTabContent] tabs found:', tabs.length, 'looking for:', url);
        
        const targetClean = cleanUrl(url);
        let tab = tabs.find(t => t.url && cleanUrl(t.url) === targetClean);
        if (!tab && url) {
          tab = tabs.find(t => t.url && (t.url.includes(url) || url.includes(t.url)));
        }

        console.log('[getTabContent] matched tab:', tab?.id, tab?.url);
        if (!tab?.id) {
          return 'Tab not found';
        }

        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            return (document.body?.innerText || '')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 4000);
          }
        });

        if (results && results[0]) {
          const text = results[0].result;
          console.log('[getTabContent] executeScript result len:', text?.length || 0);
          return text || 'No content available';
        }
        return 'No content available';
      } catch (e) {
        console.error('[getTabContent] Error:', e);
        return `Error: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  },
  getActiveTab: {
    description: "Get the URL and title of the user's currently active tab.",
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      console.log('[getActiveTab] execute called');
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log('[getActiveTab] active tabs found:', tabs.length);
        if (tabs[0]?.url) {
          console.log('[getActiveTab] active tab:', tabs[0].url, tabs[0].title);
          return {
            url: tabs[0].url,
            title: tabs[0].title || '',
          };
        }
        return 'No active tab found';
      } catch (e) {
        console.error('[getActiveTab] Error:', e);
        return `Error: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  },
};
