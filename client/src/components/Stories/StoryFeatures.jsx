"use client"

import React from 'react';
import { FaVideo, FaImage, FaBell, FaExclamationTriangle, FaMagic, FaLightbulb } from 'react-icons/fa';
import styles from "../../styles/stories.module.css";

const StoryFeatures = () => {
  return (
    <div className={styles.storiesContainer}>
      <div className={styles.gradientBar}></div>
      
      <h1 className={styles.pageTitle}>Stories</h1>
      <p className={styles.subtitle}>Share moments, updates, and connect with others</p>
      
      <div className={styles.featuresGrid}>
        {/* Text Stories - Already Available */}
        <div className="feature-card">
          <h3>Text Stories</h3>
          <p>Share your thoughts and updates with colorful text stories that disappear after 24 hours.</p>
          <ul>
            <li>Customize backgrounds and fonts</li>
            <li>Express yourself in up to 150 characters</li>
            <li>See who viewed your stories</li>
          </ul>
          <p><strong>Status: Available now</strong></p>
        </div>
        
        {/* Video Stories - Coming Soon */}
        <div className={styles.comingSoonCard}>
          <FaVideo className={styles.comingSoonIcon} />
          <h3 className={styles.comingSoonTitle}>Video Stories</h3>
          <p className={styles.comingSoonText}>Record and share short video clips with your followers. Add captions, effects, and more.</p>
          <div className="mt-3">
            <span className="badge badge-primary">Coming Soon</span>
          </div>
        </div>
        
        {/* Image Stories - Coming Soon */}
        <div className={styles.comingSoonCard}>
          <FaImage className={styles.comingSoonIcon} />
          <h3 className={styles.comingSoonTitle}>Image Stories</h3>
          <p className={styles.comingSoonText}>Share photos and images that disappear after 24 hours. Add captions, stickers, and filters.</p>
          <div className="mt-3">
            <span className="badge badge-primary">Coming Soon</span>
          </div>
        </div>
      </div>
      
      {/* Future Features Section */}
      <div className="mt-5">
        <h2 className="text-center mb-4">More Coming Soon</h2>
        <div className={styles.featuresGrid}>
          <div className={styles.comingSoonCard}>
            <FaBell className={styles.comingSoonIcon} />
            <h3 className={styles.comingSoonTitle}>Story Notifications</h3>
            <p className={styles.comingSoonText}>Get notified when people you follow post new stories.</p>
          </div>
          
          <div className={styles.comingSoonCard}>
            <FaMagic className={styles.comingSoonIcon} />
            <h3 className={styles.comingSoonTitle}>Story Effects</h3>
            <p className={styles.comingSoonText}>Add filters, animations, and special effects to your stories.</p>
          </div>
          
          <div className={styles.comingSoonCard}>
            <FaLightbulb className={styles.comingSoonIcon} />
            <h3 className={styles.comingSoonTitle}>Highlights</h3>
            <p className={styles.comingSoonText}>Save your favorite stories to your profile permanently.</p>
          </div>
        </div>
      </div>
      
      {/* Story Tips Section */}
      <div className="mt-5 p-4 bg-light rounded-lg">
        <h3 className="d-flex align-items-center">
          <FaExclamationTriangle style={{ marginRight: '10px', color: 'var(--primary)' }} />
          Story Tips
        </h3>
        <ul className="list-unstyled">
          <li className="mb-2">• Stories are visible for 24 hours, then automatically disappear</li>
          <li className="mb-2">• You can see who has viewed your stories</li>
          <li className="mb-2">• Keep your stories appropriate for all audiences</li>
          <li className="mb-2">• You can delete your stories at any time</li>
          <li className="mb-2">• Premium members can post unlimited stories each day</li>
        </ul>
      </div>
    </div>
  );
};

export default StoryFeatures;