// client/src/components/MessagesWrapper.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';// Import the enhanced styles
import { setupTouchGestures, provideTactileFeedback, enhanceScrolling, isRunningAsInstalledPwa } from '../utils/mobileGestures'; // Assuming these utils exist
import logger from "../utils/logger";
import styles from "../styles/Messages.module.css";

const log = logger.create("MessagesWrapper");

/**
 * MessagesWrapper component - Enhances the main Messages component with mobile optimizations
 */
const MessagesWrapper = ({ children }) => {
  // Helper function to setup gestures with the given refs
  const setupGesturesWithRefs = (container, sidebar, chatArea, conversationList, refreshIndicator) => {
    if (!container || !sidebar || !chatArea || typeof setupTouchGestures !== 'function') {
      log.warn("setupGesturesWithRefs: Missing required elements or utilities");
      return null;
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
          log.info("Attempting to refresh conversations via wrapper...");
          toast.info("Refreshing conversations...");

          // Placeholder for actual refresh logic (e.g., re-fetching conversations)
          // Example: await props.refreshConversations?.();
          await new Promise(resolve => setTimeout(resolve, 800)); // Simulate delay

          // Success feedback
          if (typeof provideTactileFeedback === 'function') provideTactileFeedback('send');
        } catch (err) {
          log.error("Error during refresh:", err);
          if (typeof provideTactileFeedback === 'function') provideTactileFeedback('error');
        }
      },
      onRefreshStart: () => {
        log.info("Pull-to-refresh started");
      },
      onRefreshEnd: () => {
        log.info("Pull-to-refresh ended");
      }
    };
    
    // Set up touch gesture handling
    return setupTouchGestures(
      { container, sidebar, chatArea, conversationList, refreshIndicator },
      callbacks
    );
  };
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
    if (!container || typeof setupTouchGestures !== 'function') {
        return;
    }
    
    // Log whether we have found all required elements
    log.debug("MessagesWrapper: Setting up gestures with refs:", {
      sidebarFound: !!sidebar,
      chatAreaFound: !!chatArea,
      conversationListFound: !!conversationList,
      refreshIndicatorFound: !!refreshIndicator
    });
    
    // If important refs are missing, try again in a short timeout
    // This can help if the DOM is still being populated
    if (!sidebar || !chatArea) {
      const retryTimerId = setTimeout(() => {
        log.debug("MessagesWrapper: Retrying gesture setup after delay");
        // Update ref pointers
        const updatedSidebar = sidebarRef.current;
        const updatedChatArea = chatAreaRef.current;
        
        if (updatedSidebar && updatedChatArea) {
          log.info("MessagesWrapper: Refs now available, setting up gestures");
          // Setup gestures with updated refs
          setupGesturesWithRefs(containerRef.current, updatedSidebar, updatedChatArea, 
                               conversationsListRef.current, refreshIndicatorRef.current);
        }
      }, 200);
      
      return () => clearTimeout(retryTimerId);
    }

    // Use our helper function to set up gestures
    const cleanupGestures = setupGesturesWithRefs(
      container, sidebar, chatArea, conversationList, refreshIndicator
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
        log.info(`User ${outcome === 'accepted' ? 'accepted' : 'declined'} the install prompt`);
    } catch (error) {
        log.error("Error prompting PWA install:", error);
        toast.error("Could not show install prompt.");
    }


    // Clear the saved prompt - it can't be used again
    window.deferredPrompt = null;
    setShowInstallBanner(false); // Hide banner after prompt
  };

  // Callback function for child components to register their refs with the wrapper
  // Using useCallback to stabilize the function reference
  const registerRefs = React.useCallback((childRefs) => {
    // log.info("Registering refs from child:", childRefs); // Debugging
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
               if (React.isValidElement(child)) {
                 // Check if the element's type is a string (e.g., 'div', 'span') which indicates a DOM element
                 if (typeof child.type === 'string') {
                   // It's a DOM element, return it without the custom prop
                   return child;
                 } else {
                   // It's likely a custom React component (function or class), so pass the prop
                   return React.cloneElement(child, { registerRefs });
                 }
               }
               // Return non-element children (null, undefined, strings, etc.) as is
               return child;
             })}
    </div>
  );
};

export default MessagesWrapper;
