import React from 'react';

interface LoadingIndicatorProps {
  toolName?: string | null;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ toolName }) => {
  return (
    <div className="loading-indicator">
      <div className="loading-wave">
        <span className="loading-bar" />
        <span className="loading-bar" />
        <span className="loading-bar" />
        <span className="loading-bar" />
        <span className="loading-bar" />
      </div>
      {toolName && (
        <span className="loading-tool-badge">
          {toolName.replace(/([A-Z])/g, ' $1').trim()}
        </span>
      )}
    </div>
  );
};
