// src/components/chat/PremiumBanner.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { FaCrown } from 'react-icons/fa';
import defaultStyles from '../../styles/Messages.module.css';

const PremiumBanner = React.memo(({ onUpgradeClick, customStyles = null }) => {
    // Use custom styles if provided, otherwise use default styles
    const styles = customStyles || defaultStyles;
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
    customStyles: PropTypes.object,
};

export default PremiumBanner;
