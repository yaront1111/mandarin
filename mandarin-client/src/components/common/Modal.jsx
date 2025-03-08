// src/components/common/Modal.jsx
import React from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';

/**
 * Generic Modal component rendered via React Portal.
 *
 * isOpen: controls visibility
 * onClose: function to close the modal
 * title: optional heading displayed in modal
 * children: content inside the modal (can be forms, text, etc.)
 *
 * Usage:
 * <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Modal Title">
 *   <p>My modal body content</p>
 * </Modal>
 */
function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  // Stop click from closing modal if user clicks inside .modal
  const handleModalClick = (e) => e.stopPropagation();

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal" onClick={handleModalClick}>
        {/* Header */}
        <div className="modal-header">
          {title && <h3 className="modal-title">{title}</h3>}
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body Content */}
        <div className="p-2">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

Modal.propTypes = {
  /** Controls whether the modal is visible or not */
  isOpen: PropTypes.bool.isRequired,
  /** Callback to close the modal */
  onClose: PropTypes.func.isRequired,
  /** Optional title to display in the header */
  title: PropTypes.string,
  /** Modal contents (JSX) */
  children: PropTypes.node.isRequired,
};

Modal.defaultProps = {
  title: '',
};

export default Modal;
