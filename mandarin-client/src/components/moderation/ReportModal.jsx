// src/components/moderation/ReportModal.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Modal from '../common/Modal';

/**
 * Modal to let users report another user.
 * Lists some common reasons, plus a text area for details.
 */
function ReportModal({
  isOpen,
  onClose,
  onSubmitReport,
  userName,
  reasons
}) {
  const [selectedReason, setSelectedReason] = useState('');
  const [details, setDetails] = useState('');

  const handleSubmit = () => {
    if (!selectedReason) return;

    onSubmitReport({
      reason: selectedReason,
      details,
    });
    // Clear fields & close modal
    setSelectedReason('');
    setDetails('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Report ${userName || 'User'}`}
    >
      <div className="report-options">
        {reasons.map((reason) => (
          <button
            key={reason}
            type="button"
            className="report-option"
            onClick={() => setSelectedReason(reason)}
          >
            <span className="report-icon">⚠️</span>
            {reason}
          </button>
        ))}
      </div>

      <textarea
        className="report-details"
        placeholder="Provide additional details (optional)"
        value={details}
        onChange={(e) => setDetails(e.target.value)}
      />

      <button
        type="button"
        className="btn btn-danger w-full"
        onClick={handleSubmit}
      >
        Submit Report
      </button>
    </Modal>
  );
}

ReportModal.propTypes = {
  /** Controls modal visibility */
  isOpen: PropTypes.bool.isRequired,
  /** Callback to close modal */
  onClose: PropTypes.func.isRequired,
  /** Callback with the final report submission data */
  onSubmitReport: PropTypes.func.isRequired,
  /** Name of the user being reported (optional) */
  userName: PropTypes.string,
  /** Array of possible reasons to display */
  reasons: PropTypes.arrayOf(PropTypes.string),
};

ReportModal.defaultProps = {
  userName: '',
  reasons: [
    'Fake profile/catfishing',
    'Inappropriate content',
    'Harassment or abusive behavior',
    'Non-consensual behavior',
  ],
};

export default ReportModal;
