import React, { useState } from 'react';
import { Wrench, RotateCw, Copy, MoreVertical, ChevronDown, ChevronUp, Pencil, Check } from 'lucide-react';
import { getToolApproval } from '@cloudflare/ai-chat/react';
import { renderMarkdown } from '../utils/markdown';

/**
 * Strips MCP-injected ID prefixes (e.g. "tool_ZD5_lTox_") from tool names
 * and formats the remainder as Title Case.
 * e.g. "tool_ZD5_lTox_web_search_exa" → "Web Search Exa"
 */
function formatToolName(raw: string): string {
  if (!raw || typeof raw !== 'string') return 'Unknown Tool';
  
  // Strip common prefixes
  let cleaned = raw;
  if (cleaned.startsWith('tool_')) {
    cleaned = cleaned.slice(5);
  }
  
  // Clean up any remaining hash-like prefixes
  const parts = cleaned.split('_');
  let start = 0;
  while (start < parts.length - 1) {
    const seg = parts[start];
    // Hash segments are short (≤5 chars) and contain at least one uppercase letter
    if (seg.length <= 5 && /[A-Z]/.test(seg)) {
      start++;
    } else {
      break;
    }
  }
  cleaned = parts.slice(start).join('_');

  // Handle camelCase
  if (!cleaned.includes('_')) {
    cleaned = cleaned.replace(/([A-Z])/g, ' $1').trim();
  } else {
    // Handle snake_case
    cleaned = cleaned
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  // Capitalize the very first letter just in case
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

interface ToolCallAccordionProps {
  part: any;
  allParts?: any[];
  allMessages?: any[];
}

const ToolCallAccordion: React.FC<ToolCallAccordionProps> = ({ part, allParts, allMessages }) => {
  const [isOpen, setIsOpen] = useState(false);

  const getToolNameFromPart = (p: any) => {
    if (!p) return '';
    if (p.toolName) return p.toolName;
    if (p.type && p.type.startsWith('tool-')) return p.type.slice(5);
    return '';
  };

  let toolName = getToolNameFromPart(part);
  
  if (!toolName && allParts) {
    const found = allParts.find((p: any) => p.toolCallId === part.toolCallId && getToolNameFromPart(p));
    if (found) {
      toolName = getToolNameFromPart(found);
    }
  }

  if (!toolName && allMessages) {
    for (const m of allMessages) {
      if (m.parts) {
        const found = m.parts.find((p: any) => p.toolCallId === part.toolCallId && getToolNameFromPart(p));
        if (found) {
          toolName = getToolNameFromPart(found);
          break;
        }
      }
    }
  }

  let statusText = 'Completed';
  let statusClass = 'completed';

  if (part.state === 'output-available') {
    statusText = 'Completed';
    statusClass = 'completed';
  } else if (part.state === 'output-error') {
    statusText = 'Failed';
    statusClass = 'failed';
  } else if (part.state === 'approval-requested') {
    statusText = 'Waiting approval';
    statusClass = 'waiting';
  } else if (part.state === 'input-streaming') {
    statusText = 'Executing...';
    statusClass = 'executing';
  } else {
    statusText = 'Executing...';
    statusClass = 'executing';
  }

  const argsString = JSON.stringify(part.input || part.args || {}, null, 2);
  const resultString = part.output !== undefined 
    ? (typeof part.output === 'object' ? JSON.stringify(part.output, null, 2) : String(part.output))
    : '';

  const renderResult = () => {
    if (part.state === 'output-error') {
      return (
        <pre className="tool-call-code" style={{ color: '#ff6b6b', borderColor: 'rgba(255, 107, 107, 0.2)' }}>
          {resultString || 'Error executing tool.'}
        </pre>
      );
    }

    return (
      <pre className="tool-call-code">
        {resultString}
      </pre>
    );
  };

  return (
    <div className="tool-call-accordion">
      <div className="tool-call-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="tool-call-header-left">
          <div className="tool-call-icon">
            <Wrench size={13} />
          </div>
          <div className="tool-call-title-container">
            <span className="tool-call-name">{formatToolName(toolName)}</span>
            <span className={`tool-call-status ${statusClass}`}>{statusText}</span>
          </div>
        </div>
        <div className="tool-call-chevron">
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {isOpen && (
        <div className="tool-call-content">
          <div>
            <div className="tool-call-section-title">Arguments</div>
            <pre className="tool-call-code">{argsString}</pre>
          </div>
          {resultString && (
            <div>
              <div className="tool-call-section-title">Result</div>
              {renderResult()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface MessageItemProps {
  msg: any;
  isLast: boolean;
  isStreaming: boolean;
  addToolApprovalResponse: (response: { id: string; approved: boolean }) => void;
  onRegenerate: (messageId: string) => void;
  onEditMessage: (messageId: string, newText: string) => void;
  isLatestAssistant?: boolean;
  allMessages?: any[];
}

export const MessageItem: React.FC<MessageItemProps> = ({
  msg,
  isLast,
  isStreaming,
  addToolApprovalResponse,
  onRegenerate,
  onEditMessage,
  isLatestAssistant,
  allMessages,
 }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = msg.parts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('\n');
    
    const fallbackCopy = (t: string) => {
      const textArea = document.createElement("textarea");
      textArea.value = t;
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Fallback: unable to copy', err);
      }
      document.body.removeChild(textArea);
    };

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  };
  const hasText = msg.parts.some((p: any) => p.type === 'text' && p.text?.trim());
  const showFeedback =
    msg.role === 'assistant' && hasText && !(isLast && isStreaming);

  const originalText = msg.parts.find((p: any) => p.type === 'text')?.text || '';
  const isChanged = editText !== originalText;

  if (isEditing) {
    return (
      <div 
        style={{ 
          width: '100%', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px',
          alignSelf: 'stretch',
          background: 'transparent',
          border: 'none',
          padding: '0',
          margin: '8px 0',
        }}
      >
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          style={{
            width: '100%',
            minHeight: '48px',
            background: 'transparent',
            border: '1px solid var(--border-color, #3c4043)',
            borderRadius: '24px',
            outline: 'none',
            resize: 'none',
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
            fontSize: '14px',
            lineHeight: '1.5',
            padding: '12px 20px',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center', paddingRight: '8px' }}>
          <button
            onClick={() => setIsEditing(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '6px 12px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (editText.trim() && isChanged) {
                onEditMessage(msg.id, editText.trim());
                setIsEditing(false);
              }
            }}
            disabled={!isChanged || !editText.trim()}
            style={{
              background: isChanged && editText.trim() ? 'var(--red, #ea4335)' : '#2a2b2d',
              color: isChanged && editText.trim() ? '#ffffff' : '#8e8e8e',
              border: 'none',
              padding: '8px 20px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isChanged && editText.trim() ? 'pointer' : 'default',
            }}
          >
            Update
          </button>
        </div>
      </div>
    );
  }

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
                    Tool: {formatToolName(part.toolName || (part.type?.startsWith('tool-') ? part.type.slice(5) : ''))}
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
                    <span style={{ fontFamily: 'monospace', color: 'var(--error-text, #f2b8b5)' }}>
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

        /* ── tool call accordion ── */
        if (part.toolCallId && part.state !== 'approval-requested') {
          return <ToolCallAccordion key={part.toolCallId} part={part} allParts={msg.parts} allMessages={allMessages} />;
        }

        return null;
      })}

      {/* Feedback row — only for finished assistant messages */}
      {showFeedback && (
        <div className="feedback-row">
          {isLatestAssistant && (
            <button className="feedback-btn" title="Regenerate" onClick={() => onRegenerate(msg.id)}>
              <RotateCw size={14} />
            </button>
          )}
          <button
            className="feedback-btn"
            title="Copy response"
            onClick={handleCopy}
          >
            {copied ? <Check size={14} color="#81c784" /> : <Copy size={14} />}
          </button>
          <button className="feedback-btn" title="More">
            <MoreVertical size={16} />
          </button>
        </div>
      )}

      {/* Edit button row — only for user messages */}
      {msg.role === 'user' && !isEditing && (
        <div className="user-action-row">
          <button
            className="feedback-btn"
            title="Edit prompt"
            onClick={() => {
              setIsEditing(true);
              setEditText(msg.parts.find((p: any) => p.type === 'text')?.text || '');
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              borderRadius: '50%',
            }}
          >
            <Pencil size={12} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
      )}
    </div>
  );
};
