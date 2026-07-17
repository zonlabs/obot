import React from 'react';

interface WelcomeScreenProps {
  onSuggestionClick: (text: string) => void;
}

const SUGGESTIONS = [
  'Compare with Samsung A56 5G features',
  'List key hardware specifications',
  'Address reported gaming heating issues',
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSuggestionClick }) => {
  return (
    <div className="welcome-container">
      <h1 className="welcome-greeting">Hello,</h1>
      <h2 className="welcome-question">How can I help you today?</h2>
      <div className="suggestion-chips">
        {SUGGESTIONS.map((text) => (
          <button
            key={text}
            className="suggestion-chip"
            onClick={() => onSuggestionClick(text)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
};
