import React from 'react';
import { AlignLeft, Trash2 } from 'lucide-react';

interface ChatThread {
  id: string;
  title: string;
  createdAt: number;
}

interface HistoryPopupProps {
  threads: ChatThread[];
  activeThreadId: string;
  setActiveThreadId: (id: string) => void;
  setShowHistoryPopup: (show: boolean) => void;
  onDeleteThread: (id: string) => void;
}

export const HistoryPopup: React.FC<HistoryPopupProps> = ({
  threads,
  activeThreadId,
  setActiveThreadId,
  setShowHistoryPopup,
  onDeleteThread,
}) => {
  return (
    <div className="history-popup">
      <div className="history-popup-header">Recent chats</div>
      <div className="history-popup-list">
        {threads.length === 0 ? (
          <div className="history-popup-empty">No chats yet</div>
        ) : (
          threads.map((t) => {
            const isCurrent = t.id === activeThreadId;
            return (
              <div
                key={t.id}
                className={`history-popup-item ${isCurrent ? 'active' : ''}`}
                onClick={() => {
                  setActiveThreadId(t.id);
                  localStorage.setItem('shopmate_active_thread_id', t.id);
                  setShowHistoryPopup(false);
                }}
              >
                <AlignLeft size={16} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                <span className="history-popup-item-text">{t.title}</span>
                <button
                  className="history-popup-delete-btn"
                  title="Delete chat"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteThread(t.id);
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
