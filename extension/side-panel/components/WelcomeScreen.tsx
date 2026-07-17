import React from 'react';

interface WelcomeScreenProps {
  onSuggestionClick: (text: string) => void;
  user?: { name?: string } | null;
  activeTabUrl?: string;
  activeTabTitle?: string;
  llmSuggestions?: string[];
  suggestionsLoading?: boolean;
}

function getContextLabel(url: string, title: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host) return host;
  } catch {}
  return title || 'Current tab';
}

const SkeletonChip: React.FC = () => (
  <div
    className="suggestion-chip skeleton-glow"
    style={{ minHeight: '68px', border: 'none', cursor: 'default' }}
  />
);

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onSuggestionClick,
  user,
  activeTabUrl = '',
  activeTabTitle = '',
  llmSuggestions = [],
  suggestionsLoading = false,
}) => {
  const firstName = user?.name?.split(' ')[0] ?? null;

  const contextLabel = activeTabUrl && !activeTabUrl.startsWith('chrome://')
    ? getContextLabel(activeTabUrl, activeTabTitle)
    : null;

  return (
    <div className="welcome-container">
      <h1 className="welcome-greeting">Hello{firstName ? `, ${firstName}` : ''},</h1>
      <h2 className="welcome-question">How can I help you today?</h2>

      {contextLabel && (
        <p className="welcome-context-label">
          {suggestionsLoading
            ? 'Personalising suggestions\u2026'
            : `Based on \u00b7 ${contextLabel}`}
        </p>
      )}

      <div className="suggestion-chips">
        {suggestionsLoading
          ? [0, 1, 2, 3].map(i => <SkeletonChip key={i} />)
          : llmSuggestions.map((text) => (
              <button
                key={text}
                className="suggestion-chip"
                onClick={() => onSuggestionClick(text)}
              >
                <span className="suggestion-chip-text">{text}</span>
              </button>
            ))}
      </div>
    </div>
  );
};
