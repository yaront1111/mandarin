import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import { FaTimes } from 'react-icons/fa';
import { useClickOutside } from '../../hooks';

/**
 * Reusable modal component
 */
const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'medium',
  closeOnClickOutside = true,
  closeOnEsc = true,
  showCloseButton = true,
  className = '',
  contentClassName = '',
  headerClassName = '',
  bodyClassName = '',
  footerClassName = '',
  modalRoot = document.body
}) => {
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);
  
  // Close when clicking outside
  const closeModalRef = useClickOutside(() => {
    if (closeOnClickOutside && isOpen) {
      onClose();
    }
  });
  
  // Set up keyboard listeners
  useEffect(() => {
    if (!isOpen) return;
    
    // Save previous focus and focus first focusable element in modal
    previousFocusRef.current = document.activeElement;
    
    const handleKeyDown = (e) => {
      // Close on ESC
      if (closeOnEsc && e.key === 'Escape') {
        onClose();
      }
      
      // Trap focus within modal
      if (e.key === 'Tab') {
        const focusableElements = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) || [];
        
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        // Shift + Tab
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } 
        // Tab
        else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    // Prevent scrolling on body
    document.body.style.overflow = 'hidden';
    
    // Focus first focusable element
    setTimeout(() => {
      const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements?.[0]) {
        focusableElements[0].focus();
      }
    }, 0);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      
      // Restore body scrolling and focus
      document.body.style.overflow = '';
      
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, closeOnEsc, onClose, closeOnClickOutside]);
  
  // Size classes
  const sizeClasses = {
    small: 'modal-sm',
    medium: 'modal-md',
    large: 'modal-lg',
    xlarge: 'modal-xl',
    fullscreen: 'modal-fullscreen'
  };
  
  if (!isOpen) return null;
  
  const modalContent = (
    <div className={`modal-overlay ${isOpen ? 'open' : ''}`} onClick={closeOnClickOutside ? onClose : undefined}>
      <div 
        className={`modal ${sizeClasses[size] || ''} ${className}`}
        ref={(el) => {
          modalRef.current = el;
          if (closeModalRef) {
            closeModalRef.current = el;
          }
        }}
        onClick={(e) => e.stopPropagation()} 
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
      >
        {title && (
          <div className={`modal-header ${headerClassName}`}>
            <h2 className="modal-title" id="modal-title">{title}</h2>
            {showCloseButton && (
              <button 
                className="modal-close"
                onClick={onClose}
                aria-label="Close modal"
              >
                <FaTimes />
              </button>
            )}
          </div>
        )}
        
        <div className={`modal-body ${bodyClassName}`}>
          {children}
        </div>
        
        {footer && (
          <div className={`modal-footer ${footerClassName}`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
  
  return createPortal(modalContent, modalRoot);
};

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.node,
  children: PropTypes.node.isRequired,
  footer: PropTypes.node,
  size: PropTypes.oneOf(['small', 'medium', 'large', 'xlarge', 'fullscreen']),
  closeOnClickOutside: PropTypes.bool,
  closeOnEsc: PropTypes.bool,
  showCloseButton: PropTypes.bool,
  className: PropTypes.string,
  contentClassName: PropTypes.string,
  headerClassName: PropTypes.string,
  bodyClassName: PropTypes.string,
  footerClassName: PropTypes.string,
  modalRoot: PropTypes.object
};

export default Modal;