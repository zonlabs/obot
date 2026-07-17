import React from 'react';
import { Wrench, RotateCw, Copy, MoreVertical } from 'lucide-react';
import { getToolApproval } from '@cloudflare/ai-chat/react';
import { renderMarkdown } from '../utils/markdown';

interface MessageItemProps {
  msg: any;
  isLast: boolean;
  isStreaming: boolean;
  addToolApprovalResponse: (response: { id: string; approved: boolean }) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  msg,
  isLast,
  isStreaming,
  addToolApprovalResponse,
}) => {
  const hasText = msg.parts.some((p: any) => p.type === 'text' && p.text?.trim());
  const showFeedback =
    msg.role === 'assistant' && hasText && !(isLast && isStreaming);

  return (
    <div className={`message ${msg.role}`}>
      {msg.parts.map((part: any, i: number) => {
        /* ── plain text ── */
        if (part.type === 'text') {
          return (
            <React.Fragment key={i}>
              {renderMarkdown(part.text)}
            </React.Fragment>
          );
        }

        /* ── human-in-the-loop approval card ── */
        if (part.state === 'approval-requested') {
          const approval = getToolApproval(part);
          if (!approval) return null;
          return (
            <div
              key={part.toolCallId}
              style={{
                marginTop: '12px',
                padding: '16px',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                background: 'var(--bg-secondary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(234, 67, 53, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Wrench size={14} color="var(--red)" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Action Required
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Tool: {part.toolName}
                  </span>
                </div>
              </div>

              {/* Parameters */}
              <div
                style={{
                  background: '#131314',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: '6px',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                  }}
                >
                  Parameters
                </div>
                {Object.entries(part.input || {}).map(([key, val]) => (
                  <div
                    key={key}
                    style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}
                  >
                    <span style={{ fontFamily: 'monospace', color: 'var(--accent-blue)' }}>
                      {key}:
                    </span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                      {String(val)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button
                  style={{
                    background: 'transparent',
                    border: '1px solid #444749',
                    color: '#ff6b6b',
                    padding: '6px 14px',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'background-color 0.15s',
                  }}
                  onClick={() => addToolApprovalResponse({ id: approval.id, approved: false })}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 107, 107, 0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Reject
                </button>
                <button
                  style={{
                    background: 'var(--red)',
                    border: 'none',
                    color: '#ffffff',
                    padding: '6px 14px',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'background-color 0.15s',
                  }}
                  onClick={() => addToolApprovalResponse({ id: approval.id, approved: true })}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#d3362a')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--red)')}
                >
                  Approve
                </button>
              </div>
            </div>
          );
        }

        /* ── tool output cards ── */
        if (part.state === 'output-available') {
          return (
            <div key={part.toolCallId} className="tool-result">
              {part.toolName === 'findDeals' && (() => {
                const d = part.output as any;
                return (
                  <div
                    className="deal-card"
                    onClick={() => {
                      const q = `${d.deal} ${d.store} ${d.category}`;
                      window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank');
                    }}
                  >
                    <div className="deal-badge">{d.deal}</div>
                    <div className="deal-store">{d.store}</div>
                    <div className="deal-category">
                      {d.category}{d.maxPrice !== 'No limit' ? ` · up to $${d.maxPrice}` : ''}
                    </div>
                    <div className="deal-details">{d.details}</div>
                  </div>
                );
              })()}
              {part.toolName === 'getProductDetails' && (() => {
                const p = part.output as any;
                return (
                  <div className="product-detail-card">
                    <div className="pd-name">{p.name}</div>
                    <div className="pd-meta">{p.store} · {p.price} · {p.rating}</div>
                    <div className="pd-desc">{p.description}</div>
                  </div>
                );
              })()}
              {part.toolName === 'compareProducts' && (() => {
                const c = part.output as any;
                return (
                  <div className="compare-card">
                    <div className="compare-header">Comparison</div>
                    <div className="compare-products">{c.products?.join(' vs ')}</div>
                    <div className="compare-text">{c.comparison}</div>
                  </div>
                );
              })()}
              {!['findDeals', 'getProductDetails', 'compareProducts'].includes(part.toolName) && (
                <details>
                  <summary>{part.toolName} result</summary>
                  <pre>{JSON.stringify(part.output, null, 2)}</pre>
                </details>
              )}
            </div>
          );
        }

        return null;
      })}

      {/* Feedback row — only for finished assistant messages */}
      {showFeedback && (
        <div className="feedback-row">
          <button className="feedback-btn" title="Regenerate">
            <RotateCw size={14} />
          </button>
          <button
            className="feedback-btn"
            title="Copy response"
            onClick={() => {
              const text = msg.parts
                .filter((p: any) => p.type === 'text')
                .map((p: any) => p.text)
                .join('\n');
              navigator.clipboard.writeText(text);
            }}
          >
            <Copy size={14} />
          </button>
          <button className="feedback-btn" title="More">
            <MoreVertical size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
