"use client"

import React from 'react';
import { FaVideo, FaImage, FaBell, FaExclamationTriangle, FaMagic, FaLightbulb, FaFont } from 'react-icons/fa';
import styles from "../../styles/stories.module.css";

const StoryFeatures = () => {
  return (
    <div className={styles.storiesContainer}>
      {/* Instagram-style header */}
      <div className={styles.storyFeaturesHeader}>
        <h1 className={styles.pageTitle}>Stories</h1>
        <p className={styles.subtitle}>Share moments, updates, and connect with others</p>
      </div>

      <div className={styles.featuresGrid}>
        {/* Text Stories - Already Available */}
        <div className={styles.featureCard}>
          <div className={styles.featureIconContainer}>
            <FaFont className={styles.featureIcon} />
          </div>
          <h3 className={styles.featureTitle}>Text Stories</h3>
          <p className={styles.featureDescription}>
            Share your thoughts and updates with colorful text stories that disappear after 24 hours.
          </p>
          <ul className={styles.featureList}>
            <li>Customize backgrounds and fonts</li>
            <li>Express yourself in up to 150 characters</li>
            <li>See who viewed your stories</li>
          </ul>
          <div className={styles.featureStatus}>
            <span className={styles.availableNow}>Available now</span>
          </div>
        </div>

        {/* Video Stories - Coming Soon */}
        <div className={styles.comingSoonCard}>
          <div className={styles.comingSoonIconContainer}>
            <FaVideo className={styles.comingSoonIcon} />
          </div>
          <h3 className={styles.comingSoonTitle}>Video Stories</h3>
          <p className={styles.comingSoonText}>
            Record and share short video clips with your followers. Add captions, effects, and more.
          </p>
          <div className={styles.comingSoonBadgeContainer}>
            <span className={styles.comingSoonBadge}>Coming Soon</span>
          </div>
        </div>

        {/* Image Stories - Coming Soon */}
        <div className={styles.comingSoonCard}>
          <div className={styles.comingSoonIconContainer}>
            <FaImage className={styles.comingSoonIcon} />
          </div>
          <h3 className={styles.comingSoonTitle}>Image Stories</h3>
          <p className={styles.comingSoonText}>
            Share photos and images that disappear after 24 hours. Add captions, stickers, and filters.
          </p>
          <div className={styles.comingSoonBadgeContainer}>
            <span className={styles.comingSoonBadge}>Coming Soon</span>
          </div>
        </div>
      </div>

      {/* Future Features Section */}
      <div className={styles.upcomingFeaturesSection}>
        <h2 className={styles.sectionTitle}>More Coming Soon</h2>
        <div className={styles.featuresGrid}>
          <div className={styles.comingSoonCard}>
            <div className={styles.comingSoonIconContainer}>
              <FaBell className={styles.comingSoonIcon} />
            </div>
            <h3 className={styles.comingSoonTitle}>Story Notifications</h3>
            <p className={styles.comingSoonText}>
              Get notified when people you follow post new stories.
            </p>
          </div>

          <div className={styles.comingSoonCard}>
            <div className={styles.comingSoonIconContainer}>
              <FaMagic className={styles.comingSoonIcon} />
            </div>
            <h3 className={styles.comingSoonTitle}>Story Effects</h3>
            <p className={styles.comingSoonText}>
              Add filters, animations, and special effects to your stories.
            </p>
          </div>

          <div className={styles.comingSoonCard}>
            <div className={styles.comingSoonIconContainer}>
              <FaLightbulb className={styles.comingSoonIcon} />
            </div>
            <h3 className={styles.comingSoonTitle}>Highlights</h3>
            <p className={styles.comingSoonText}>
              Save your favorite stories to your profile permanently.
            </p>
          </div>
        </div>
      </div>

      {/* Story Tips Section */}
      <div className={styles.storyTipsContainer}>
        <div className={styles.storyTipsHeader}>
          <FaExclamationTriangle className={styles.storyTipsIcon} />
          <h3 className={styles.storyTipsTitle}>Story Tips</h3>
        </div>
        <ul className={styles.storyTipsList}>
          <li className={styles.storyTipItem}>
            Stories are visible for 24 hours, then automatically disappear
          </li>
          <li className={styles.storyTipItem}>
            You can see who has viewed your stories
          </li>
          <li className={styles.storyTipItem}>
            Keep your stories appropriate for all audiences
          </li>
          <li className={styles.storyTipItem}>
            You can delete your stories at any time
          </li>
          <li className={styles.storyTipItem}>
            Premium members can post unlimited stories each day
          </li>
        </ul>
      </div>
    </div>
  );
};

export default StoryFeatures;
