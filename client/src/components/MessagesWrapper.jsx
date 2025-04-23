// client/src/components/MessagesWrapper.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import styles from '../styles/Messages.module.css'; // Import the enhanced styles
import { setupTouchGestures, provideTactileFeedback, enhanceScrolling, isRunningAsInstalledPwa } from '../utils/mobileGestures'; // Assuming these utils exist

/**
 * MessagesWrapper component - Enhances the main Messages component with mobile optimizations
 */
const MessagesWrapper = ({ children }) => {
  const navigate = useNavigate();
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // Refs for DOM elements potentially needed by gesture utils
  const containerRef = useRef(null); // Main wrapper ref
  const sidebarRef = useRef(null);   // Ref for the sidebar element
  const chatAreaRef = useRef(null);  // Ref for the chat area element
  const conversationsListRef = useRef(null); // Ref for the scrollable conversation list
  const refreshIndicatorRef = useRef(null);  // Ref for the pull-to-refresh indicator
  const messagesAreaRef = useRef(null); // Ref for the scrollable messages area

  // Check if running as installed PWA and handle install prompt
  useEffect(() => {
    // Check only if window exists (client-side)
    if (typeof window !== 'undefined') {
        // Only show install banner if not already installed
        setShowInstallBanner(!isRunningAsInstalledPwa());

        // Event listener for the beforeinstallprompt event
        const handleBeforeInstallPrompt = (e) => {
          // Prevent the mini-infobar from appearing on mobile
          e.preventDefault();
          // Store the event so it can be triggered later
          window.deferredPrompt = e;
          // Show install banner only if not already installed
          if (!isRunningAsInstalledPwa()) {
             setShowInstallBanner(true);
          }
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
          window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }
  }, []);

  // Set up touch gestures for mobile - Needs refs to be populated by child
  useEffect(() => {
    // Ensure refs are populated and utils exist before setting up gestures
    const container = containerRef.current;
    const sidebar = sidebarRef.current;
    const chatArea = chatAreaRef.current;
    const conversationList = conversationsListRef.current;
    const refreshIndicator = refreshIndicatorRef.current;

    // Only setup if essential elements are present and utils are loaded
    if (!container || !sidebar || !chatArea || typeof setupTouchGestures !== 'function') {
        // console.warn("MessagesWrapper: Refs not ready or utils missing for gesture setup.");
        return;
    }

    // Callbacks for gesture events
    const callbacks = {
      onSidebarShow: () => {
         if (sidebar) sidebar.classList.remove(styles.hide); // Use styles module
         if (typeof provideTactileFeedback === 'function') provideTactileFeedback('selectConversation');
      },
      onSidebarHide: () => {
         if (sidebar) sidebar.classList.add(styles.hide); // Use styles module
         if (typeof provideTactileFeedback === 'function') provideTactileFeedback('selectConversation');
      },
      onRefresh: async () => {
        try {
          // Trigger refresh - replace with your actual refresh function from context or props if needed
          console.log("Attempting to refresh conversations via wrapper...");
          toast.info("Refreshing conversations...");

          // Placeholder for actual refresh logic (e.g., re-fetching conversations)
          // Example: await props.refreshConversations?.();
          await new Promise(resolve => setTimeout(resolve, 800)); // Simulate delay

          // Success feedback
          if (typeof provideTactileFeedback === 'function') provideTactileFeedback('send');
        } catch (err) {
          console.error("Error during refresh:", err);
          if (typeof provideTactileFeedback === 'function') provideTactileFeedback('error');
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

    // Set up enhanced scrolling for messages area if available
    let cleanupScrolling = null;
    if (messagesAreaRef.current && typeof enhanceScrolling === 'function') {
        cleanupScrolling = enhanceScrolling(messagesAreaRef.current);
    }

    // Cleanup on unmount or when refs change significantly
    return () => {
      if (cleanupGestures) cleanupGestures();
      if (cleanupScrolling) cleanupScrolling();
    };
    // Add refs to dependency array so effect re-runs if they change after initial render
  }, [sidebarRef.current, chatAreaRef.current, conversationsListRef.current, refreshIndicatorRef.current, messagesAreaRef.current]);


  // Handle app installation click
  const handleInstallClick = async () => {
    if (typeof window === 'undefined' || !window.deferredPrompt) return;

    const promptEvent = window.deferredPrompt;
    try {
        await promptEvent.prompt();
        // Wait for user response (optional)
        const { outcome } = await promptEvent.userChoice;
        console.log(`User ${outcome === 'accepted' ? 'accepted' : 'declined'} the install prompt`);
    } catch (error) {
        console.error("Error prompting PWA install:", error);
        toast.error("Could not show install prompt.");
    }


    // Clear the saved prompt - it can't be used again
    window.deferredPrompt = null;
    setShowInstallBanner(false); // Hide banner after prompt
  };

  // Callback function for child components to register their refs with the wrapper
  // Using useCallback to stabilize the function reference
  const registerRefs = React.useCallback((childRefs) => {
    // console.log("Registering refs from child:", childRefs); // Debugging
    if (childRefs.sidebarRef) {
      sidebarRef.current = childRefs.sidebarRef.current; // Assign the actual DOM node
    }
    if (childRefs.chatAreaRef) {
      chatAreaRef.current = childRefs.chatAreaRef.current;
    }
    if (childRefs.conversationsListRef) {
      conversationsListRef.current = childRefs.conversationsListRef.current;
    }
    if (childRefs.messagesAreaRef) {
      messagesAreaRef.current = childRefs.messagesAreaRef.current;
    }
    if (childRefs.refreshIndicatorRef) {
      refreshIndicatorRef.current = childRefs.refreshIndicatorRef.current;
    }
     // Trigger a re-run of the useEffect that depends on these refs changing
     // Note: Directly updating refs usually doesn't trigger re-renders,
     // but the gesture setup effect depends on the .current values.
     // If setup needs to re-run *immediately* after refs are set,
     // you might need a state variable to force it, but often the effect
     // dependency array handles it if the refs stabilize after the child mounts.
  }, []); // No dependencies, function identity is stable


  return (
    <div className={styles.appWrapper} ref={containerRef}>
      {/* Clone child components and pass registerRefs function */}
      {React.Children.map(children, child => {
         // --- FIX STARTS HERE ---
         // Check if the child is a valid React element before cloning
         if (React.isValidElement(child)) {
           // If it's valid, clone it and pass the registerRefs prop
           return React.cloneElement(child, { registerRefs });
         }
         // If it's not valid (e.g., null, undefined, string, number), return it as is
         return child;
         // --- FIX ENDS HERE ---
       })}
    </div>
  );
};

export default MessagesWrapper;
