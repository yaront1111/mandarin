// src/components/icebreakers/IcebreakerModal.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Modal from '../common/Modal';

/**
 * Displays a list of predefined questions and an option
 * to send a custom question as an "icebreaker."
 */
function IcebreakerModal({
  isOpen,
  onClose,
  questions,
  onSendQuestion
}) {
  const [customQuestion, setCustomQuestion] = useState('');

  const handleSend = (question) => {
    onSendQuestion(question);
    // Optionally close the modal after sending
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Icebreakers">
      <div className="icebreaker-options">
        {questions.map((q) => (
          <button
            key={q}
            type="button"
            className="icebreaker-option"
            onClick={() => handleSend(q)}
          >
            {q}
          </button>
        ))}
      </div>

      <div className="icebreaker-custom">
        <input
          type="text"
          className="icebreaker-input"
          placeholder="Or type your own question..."
          value={customQuestion}
          onChange={(e) => setCustomQuestion(e.target.value)}
        />
        <button
          className="icebreaker-send"
          type="button"
          onClick={() => {
            if (customQuestion.trim()) {
              handleSend(customQuestion);
              setCustomQuestion('');
            }
          }}
        >
          <span>📤</span>
        </button>
      </div>
    </Modal>
  );
}

IcebreakerModal.propTypes = {
  /** Controls whether the modal is visible or not */
  isOpen: PropTypes.bool.isRequired,
  /** Callback to close the modal */
  onClose: PropTypes.func.isRequired,
  /** Array of preset icebreaker questions */
  questions: PropTypes.arrayOf(PropTypes.string),
  /** Handler when a question (preset or custom) is chosen */
  onSendQuestion: PropTypes.func,
};

IcebreakerModal.defaultProps = {
  questions: [
    "What's your favorite way to unwind after a long day?",
    "If you could only keep one kink, what would it be?",
    "What's one fantasy you've always wanted to try?",
    "What's your ideal date night look like?",
  ],
  onSendQuestion: () => {},
};

export default IcebreakerModal;
