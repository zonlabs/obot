import React, { useRef, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useAgent } from 'agents/react';

const WORKER_URL = 'http://127.0.0.1:8787';

interface McpServer {
  id: string;
  name: string;
  url: string;
  state: string;
}

interface PluginsModalProps {
  agentId: string;
  onClose: () => void;
}

export const PluginsModal: React.FC<PluginsModalProps> = ({ agentId, onClose }) => {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authPending, setAuthPending] = useState<{ name: string; url: string } | null>(null);

  // Use a ref so onOpen callback always sees the latest agent stub
  const agentRef = useRef<any>(null);

  const agent = useAgent({
    agent: 'ChatAgent',
    name: agentId,
    host: WORKER_URL,
    onOpen: async () => {
      try {
        const list = await agentRef.current.stub.listPlugins() as McpServer[];
        setServers(list ?? []);
      } catch (e) {
        console.error('[PluginsModal] listPlugins failed:', e);
      }
    },
    onMcpUpdate: (mcpState: any) => {
      // Live push: SDK fires this whenever a server state changes (connecting → ready, etc.)
      const updated: McpServer[] = Object.entries(mcpState.servers ?? {}).map(
        ([id, s]: [string, any]) => ({ id, name: s.name, url: s.server_url ?? '', state: s.state })
      );
      setServers(updated);
    },
  });

  // Keep the ref in sync with the latest agent
  agentRef.current = agent;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await agent.stub.addPlugin(name.trim(), url.trim(), WORKER_URL) as any;
      if (data.success) {
        if (data.requiresAuth && data.authUrl) {
          setAuthPending({ name: name.trim(), url: url.trim() });
          window.open(data.authUrl, '_blank', 'noopener,noreferrer');
        }
        setServers(data.list ?? []);
        setName('');
        setUrl('');
      } else {
        setError(data.error || 'Failed to add MCP server');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (serverId: string) => {
    if (serverId === 'exa') return;
    try {
      const data = await agent.stub.removePlugin(serverId) as any;
      if (data.success) {
        setServers(data.list ?? []);
      }
    } catch (e) {
      console.error('[PluginsModal] removePlugin failed:', e);
    }
  };

  const getStatusColor = (state: string) => {
    switch (state) {
      case 'ready': return '#4ade80';
      case 'connecting':
      case 'connected':
      case 'discovering': return '#facc15';
      case 'authenticating': return '#60a5fa';
      case 'failed': return '#f87171';
      default: return '#6b7280';
    }
  };

  return (
    <div className="modal-overlay">
      <div className="plugins-modal" onClick={(e) => e.stopPropagation()}>
        <div className="plugins-modal-header">
          <h3>MCP Plugins</h3>
          <button className="close-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleAdd} className="plugins-form">
          <div className="input-group">
            <input
              placeholder="Plugin Name (e.g. todo)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              required
            />
            <input
              placeholder="MCP Server Endpoint URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <button type="submit" disabled={loading} className="add-btn">
            {loading ? 'Adding...' : 'Add Plugin'}
          </button>
        </form>

        {error && <div className="plugins-error">{error}</div>}

        {authPending && (
          <div className="plugins-auth-banner">
            <span>🔐 <strong>{authPending.name}</strong> requires authorization.</span>
            <span>Complete sign-in in the opened tab — status updates automatically.</span>
            <button className="auth-dismiss-btn" style={{ marginTop: '8px' }} onClick={() => setAuthPending(null)}>Dismiss</button>
          </div>
        )}

        <div className="plugins-list-container">
          <h4>Active Plugins</h4>
          <div className="plugins-list">
            {servers.map((s) => (
              <div key={s.id} className="plugin-item">
                <div className="plugin-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: getStatusColor(s.state),
                        flexShrink: 0,
                        boxShadow: s.state === 'ready' ? '0 0 4px #4ade80' : undefined,
                      }}
                    />
                    <span className="plugin-name">{s.name}</span>
                  </div>
                  <span className="plugin-url">{s.url}</span>
                </div>
                {s.id !== 'exa' ? (
                  <button
                    className="remove-btn"
                    title="Remove Plugin"
                    onClick={() => handleRemove(s.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                ) : (
                  <span className="plugin-badge">Built-in</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
