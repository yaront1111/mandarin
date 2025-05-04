// src/components/chat/ChatStatusIndicators.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { FaExclamationCircle, FaEnvelope } from 'react-icons/fa';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import defaultStyles from '../../styles/Messages.module.css';
import { classNames } from './chatUtils.jsx';

export const LoadingIndicator = React.memo(({ 
    showTimeoutMessage, 
    handleRetry, 
    handleReconnect,
    customStyles = null
}) => {
    // Use custom styles if provided, otherwise use default styles
    const styles = customStyles || defaultStyles;
    
    return (
    <div className={styles.loadingMessages} role="status" aria-live="polite">
        <LoadingSpinner 
            size="medium" 
            text={showTimeoutMessage ? "Taking longer than expected..." : "Loading messages..."} 
            centered 
        />
        {showTimeoutMessage && (
            <div className={styles.loadingActions}>
                <button 
                    className={styles.retryButton} 
                    onClick={handleRetry} 
                    aria-label="Retry loading messages"
                    type="button"
                >
                    Retry Load
                </button>
                <button 
                    className={styles.reconnectButton} 
                    onClick={handleReconnect} 
                    aria-label="Force reconnect"
                    type="button"
                >
                    Reconnect
                </button>
            </div>
        )}
    </div>
    );
});

LoadingIndicator.displayName = 'LoadingIndicator';

LoadingIndicator.propTypes = {
    showTimeoutMessage: PropTypes.bool.isRequired,
    handleRetry: PropTypes.func.isRequired,
    handleReconnect: PropTypes.func.isRequired,
    customStyles: PropTypes.object,
};

export const ErrorMessage = React.memo(({
    error = "An unknown error occurred.",
    handleRetry,
    handleForceInit,
    showInitButton = false,
    customStyles = null
}) => {
    // Use custom styles if provided, otherwise use default styles
    const styles = customStyles || defaultStyles;
    
    return (
    <div className={styles.messageErrorDisplay} role="alert">
        <FaExclamationCircle className={styles.errorIconLarge} aria-hidden="true" />
        <p>{error}</p>
        <div className={styles.errorActions}>
            <button 
                onClick={handleRetry} 
                className={styles.retryButton} 
                aria-label="Retry loading messages"
                type="button"
            >
                Retry Loading
            </button>
            {showInitButton && (
                <button 
                    onClick={handleForceInit} 
                    className={styles.initButton} 
                    aria-label="Force initialization"
                    type="button"
                >
                    Force Init
                </button>
            )}
        </div>
    </div>
    );
});

ErrorMessage.displayName = 'ErrorMessage';

ErrorMessage.propTypes = {
    error: PropTypes.string,
    handleRetry: PropTypes.func.isRequired,
    handleForceInit: PropTypes.func.isRequired,
    showInitButton: PropTypes.bool,
    customStyles: PropTypes.object,
};

export const ConnectionIssueMessage = React.memo(({ 
    handleReconnect, 
    isInitializing,
    customStyles = null
}) => {
    // Use custom styles if provided, otherwise use default styles
    const styles = customStyles || defaultStyles;
    
    return (
    <div className={styles.loadingMessages} role="status" aria-live="polite">
        <LoadingSpinner 
            size="medium" 
            text={isInitializing ? "Initializing chat..." : "Trying to reconnect..."} 
            centered 
        />
        <div className={styles.errorActions}>
            <button 
                onClick={handleReconnect} 
                className={styles.retryButton} 
                aria-label="Force reconnection"
                type="button"
            >
                Reconnect Now
            </button>
        </div>
    </div>
    );
});

ConnectionIssueMessage.displayName = 'ConnectionIssueMessage';

ConnectionIssueMessage.propTypes = {
    handleReconnect: PropTypes.func.isRequired,
    isInitializing: PropTypes.bool.isRequired,
    customStyles: PropTypes.object,
};

export const NoMessagesPlaceholder = React.memo(({
    text = "No messages yet.",
    hint = null,
    customStyles = null
}) => {
    // Use custom styles if provided, otherwise use default styles
    const styles = customStyles || defaultStyles;
    
    return (
    <div className={styles.noMessages} role="status">
        <div className={styles.noMessagesContent}>
            <FaEnvelope size={40} aria-hidden="true" />
            <p>{text}</p>
            {hint && <p className={styles.hint}>{hint}</p>}
        </div>
    </div>
    );
});

NoMessagesPlaceholder.displayName = 'NoMessagesPlaceholder';

NoMessagesPlaceholder.propTypes = {
    text: PropTypes.string,
    hint: PropTypes.string,
    customStyles: PropTypes.object,
};

export default {
    LoadingIndicator,
    ErrorMessage,
    ConnectionIssueMessage,
    NoMessagesPlaceholder
};
