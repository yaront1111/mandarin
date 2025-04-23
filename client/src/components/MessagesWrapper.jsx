// client/src/components/MessagesWrapper.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import styles from '../styles/Messages.module.css'; // Import the enhanced styles
import { setupTouchGestures, provideTactileFeedback, enhanceScrolling, isRunningAsInstalledPwa } from '../utils/mobileGestures';

/**
 * MessagesWrapper component - Enhances the main Messages component with mobile optimizations
 */
const MessagesWrapper = ({ children }) => {
  const navigate = useNavigate();
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // Refs for DOM elements
  const containerRef = useRef(null);
  const sidebarRef = useRef(null);
  const chatAreaRef = useRef(null);
  const conversationsListRef = useRef(null);
  const refreshIndicatorRef = useRef(null);
  const messagesAreaRef = useRef(null);

  // Check if running as installed PWA
  useEffect(() => {
    // Only show install banner if not already installed
    setShowInstallBanner(!isRunningAsInstalledPwa());

    // Event listener for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Store the event so it can be triggered later
      window.deferredPrompt = e;
      // Show install banner
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Set up touch gestures for mobile
  useEffect(() => {
    // Get element references
    const container = containerRef.current;
    const sidebar = sidebarRef.current;
    const chatArea = chatAreaRef.current;
    const conversationList = conversationsListRef.current;
    const refreshIndicator = refreshIndicatorRef.current;

    if (!container || !sidebar || !chatArea) return;

    // Callbacks for gesture events
    const callbacks = {
      onSidebarShow: () => {
        sidebar.classList.remove('hide');
        provideTactileFeedback('selectConversation');
      },
      onSidebarHide: () => {
        sidebar.classList.add('hide');
        provideTactileFeedback('selectConversation');
      },
      onRefresh: async () => {
        try {
          // Trigger refresh - you would replace this with your actual refresh function
          toast.info("Refreshing conversations...");

          // This would be replaced with your actual refresh logic
          await new Promise(resolve => setTimeout(resolve, 800));

          // Success feedback
          provideTactileFeedback('send');
        } catch (err) {
          console.error("Error during refresh:", err);
          provideTactileFeedback('error');
        }
      },
      onRefreshStart: () => {
        console.log("Pull-to-refresh started");
      },
      onRefreshEnd: () => {
        console.log("Pull-to-refresh ended");
      }
    };

    // Set up touch gesture handling
    const cleanupGestures = setupTouchGestures(
      { container, sidebar, chatArea, conversationList, refreshIndicator },
      callbacks
    );

    // Set up enhanced scrolling for messages
    const cleanupScrolling = messagesAreaRef.current
      ? enhanceScrolling(messagesAreaRef.current)
      : null;

    // Cleanup on unmount
    return () => {
      if (cleanupGestures) cleanupGestures();
      if (cleanupScrolling) cleanupScrolling();
    };
  }, []);

  // Handle app installation
  const handleInstallClick = async () => {
    if (!window.deferredPrompt) return;

    const promptEvent = window.deferredPrompt;
    promptEvent.prompt();

    // Wait for user response
    const { outcome } = await promptEvent.userChoice;
    console.log(`User ${outcome === 'accepted' ? 'accepted' : 'declined'} the install prompt`);

    // Clear the saved prompt - it can't be used again
    window.deferredPrompt = null;
    setShowInstallBanner(false);
  };

  // Register refs for child components
  const registerRefs = (childRefs) => {
    if (childRefs.sidebarRef && sidebarRef.current !== childRefs.sidebarRef) {
      sidebarRef.current = childRefs.sidebarRef;
    }
    if (childRefs.chatAreaRef && chatAreaRef.current !== childRefs.chatAreaRef) {
      chatAreaRef.current = childRefs.chatAreaRef;
    }
    if (childRefs.conversationsListRef && conversationsListRef.current !== childRefs.conversationsListRef) {
      conversationsListRef.current = childRefs.conversationsListRef;
    }
    if (childRefs.messagesAreaRef && messagesAreaRef.current !== childRefs.messagesAreaRef) {
      messagesAreaRef.current = childRefs.messagesAreaRef;
    }
    if (childRefs.refreshIndicatorRef && refreshIndicatorRef.current !== childRefs.refreshIndicatorRef) {
      refreshIndicatorRef.current = childRefs.refreshIndicatorRef;
    }
  };

  return (
    <div className={styles.appWrapper} ref={containerRef}>
      {/* Clone child components and pass registerRefs function */}
      {React.Children.map(children, child =>
        React.cloneElement(child, { registerRefs })
      )}

      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div className={`${styles.appInstallBanner} ${styles.show}`}>
          <span className={styles.appInstallText}>
            Add to home screen for a better experience
          </span>
          <button className={styles.installButton} onClick={handleInstallClick}>
            Install
          </button>
        </div>
      )}
    </div>
  );
};

export default MessagesWrapper;
