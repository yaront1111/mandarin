// src/components/chat/CallBanners.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { FaVideo, FaTimes, FaPhoneSlash } from 'react-icons/fa';
import { classNames } from './chatUtils.jsx';
import defaultStyles from '../../styles/Messages.module.css';

const CallBanners = React.memo(({
    incomingCall = null,
    isCallActive,
    recipientNickname = 'user',
    onAcceptCall,
    onDeclineCall,
    onEndCall,
    useSmallButtons = false,
    customStyles = null
}) => {
    // Use custom styles if provided, otherwise use default styles
    const styles = customStyles || defaultStyles;
    const declineButtonClass = useSmallButtons ? styles.declineCallBtnSmall : styles.declineCallBtn;
    const acceptButtonClass = useSmallButtons ? styles.acceptCallBtnSmall : styles.acceptCallBtn;

    return (
        <>
            {incomingCall && !isCallActive && (
                <div className={styles.incomingCallBanner} role="alert" aria-live="assertive">
                    <div className={styles.incomingCallInfo}>
                        <FaVideo className={classNames(styles.callIcon, styles.pulse)} />
                        <span>{incomingCall.callerName || 'Someone'} is calling you</span>
                    </div>
                    <div className={styles.incomingCallActions}>
                        <button 
                            className={declineButtonClass} 
                            onClick={onDeclineCall} 
                            aria-label="Decline call" 
                            title="Decline Call"
                        >
                            <FaTimes /> {!useSmallButtons && 'Decline'}
                        </button>
                        <button 
                            className={acceptButtonClass} 
                            onClick={onAcceptCall} 
                            aria-label="Accept call" 
                            title="Accept Call"
                        >
                            <FaVideo /> {!useSmallButtons && 'Accept'}
                        </button>
                    </div>
                </div>
            )}

            {isCallActive && (
                <div className={styles.activeCallBanner} role="status">
                    <div className={styles.activeCallInfo}>
                        <FaVideo className={styles.callIcon} />
                        <span>Call with {recipientNickname}</span>
                    </div>
                    <button 
                        className={styles.endCallBtn} 
                        onClick={onEndCall} 
                        aria-label="End call" 
                        title="End Call"
                    >
                        <FaPhoneSlash /> End Call
                    </button>
                </div>
            )}
        </>
    );
});

CallBanners.displayName = 'CallBanners';

CallBanners.propTypes = {
    incomingCall: PropTypes.shape({
        callId: PropTypes.string.isRequired,
        callerName: PropTypes.string,
        callerId: PropTypes.string.isRequired,
    }),
    isCallActive: PropTypes.bool.isRequired,
    recipientNickname: PropTypes.string,
    onAcceptCall: PropTypes.func.isRequired,
    onDeclineCall: PropTypes.func.isRequired,
    onEndCall: PropTypes.func.isRequired,
    useSmallButtons: PropTypes.bool,
    customStyles: PropTypes.object,
};

export default CallBanners;
