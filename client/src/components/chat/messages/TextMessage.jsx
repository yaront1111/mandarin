import React from 'react';

/**
 * TextMessage component - Renders a text message
 * 
 * @param {Object} props - Component props
 * @param {Object} props.message - Message object with content to display
 * @returns {React.ReactElement} The text message component
 */
const TextMessage = ({ message }) => {
  // Function to make links clickable
  const renderTextWithLinks = (text) => {
    if (!text) return '';
    
    // Regex for URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    // Split text by URLs
    const parts = text.split(urlRegex);
    
    // Map parts with link styling for URLs
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a 
            key={i} 
            href={part} 
            target="_blank" 
            rel="noopener noreferrer"
            className="message-link"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };
  
  return (
    <div className="text-message">
      {renderTextWithLinks(message.content)}
      
      {/* Add styling */}
      <style jsx>{`
        .text-message {
          font-size: 0.95rem;
          line-height: 1.4;
          white-space: pre-wrap;
        }
        
        :global(.message-link) {
          color: var(--primary);
          text-decoration: underline;
          word-break: break-all;
        }
        
        :global(.message-link:hover) {
          text-decoration: none;
        }
        
        /* Dark mode */
        .dark :global(.message-link) {
          color: var(--primary-light);
        }
      `}</style>
    </div>
  );
};

export default TextMessage;