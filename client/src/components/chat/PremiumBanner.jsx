// src/components/chat/PremiumBanner.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { FaCrown } from 'react-icons/fa';
import styles from '../../styles/embedded-chat.module.css';

const PremiumBanner = React.memo(({ onUpgradeClick }) => {
    return (
        <div 
            className={styles.premiumBanner}
            role="complementary"
            aria-label="Premium subscription banner"
        >
            <div className={styles.premiumInfo}>
                <FaCrown className={styles.premiumIcon} aria-hidden="true" />
                <span>Upgrade to send messages and make calls</span>
            </div>
            <button
                className={styles.upgradeBtn}
                onClick={onUpgradeClick}
                aria-label="Upgrade to premium"
                type="button"
            >
                Upgrade Now
            </button>
        </div>
    );
});

PremiumBanner.displayName = 'PremiumBanner';

PremiumBanner.propTypes = {
    onUpgradeClick: PropTypes.func.isRequired,
};

export default PremiumBanner;
