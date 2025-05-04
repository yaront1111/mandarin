/**
 * Mobile Touch Gesture Utility
 * Enhances mobile experience for the Messages component with smooth gesture handling
 */
import logger from './logger';

const log = logger.create('mobileGestures');

// Configuration
const SWIPE_THRESHOLD = 80; // Minimum distance to trigger swipe action
const PULL_RESISTANCE = 0.4; // Lower number = more resistance to pull
const MAX_PULL_DISTANCE = 80; // Maximum pull distance allowed
const ANIMATION_DURATION = 300; // Animation duration in ms

/**
 * Sets up touch gesture handling for the Messages UI
 * @param {Object} elements - DOM elements to apply gestures to
 * @param {Function} callbacks - Callback functions for various events
 */
export const setupTouchGestures = (elements, callbacks) => {
  // Elements
  const {
    container,
    sidebar,
    chatArea,
    conversationList,
    refreshIndicator
  } = elements;

  // Callbacks
  const {
    onSidebarShow,
    onSidebarHide,
    onRefresh,
    onRefreshStart,
    onRefreshEnd
  } = callbacks;

  // State variables
  let touchStartX = 0;
  let touchStartY = 0;
  let isSwiping = false;
  let isPulling = false;
  let pullDistance = 0;
  let currentSwipe = 0;

  // Check if we're at the top of the list for pull-to-refresh
  const isAtTop = () => {
    return conversationList && conversationList.scrollTop <= 1;
  };

  // Handle touch start events
  const handleTouchStart = (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;

    // Reset state
    isSwiping = false;
    isPulling = false;
    currentSwipe = 0;
    pullDistance = 0;
  };

  // Check if virtual keyboard is likely open (used to prevent gesture conflicts)
  const isVirtualKeyboardOpen = () => {
    // For iOS, use a heuristic of window inner height vs window outer height
    if (window.visualViewport) {
      return window.visualViewport.height < window.innerHeight * 0.8;
    }
    // Fallback for other browsers
    return document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
  };

  // Handle touch move events
  const handleTouchMove = (e) => {
    if (!e.touches[0]) return;
    
    // Skip gesture handling if keyboard is likely open
    if (isVirtualKeyboardOpen()) {
      return;
    }

    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const deltaX = touchX - touchStartX;
    const deltaY = touchY - touchStartY;

    // Determine if this is a horizontal or vertical gesture
    if (!isSwiping && !isPulling) {
      // If absolute horizontal movement is greater than vertical, it's a swipe
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        isSwiping = true;
      }
      // If downward vertical movement and at the top, it's a pull-to-refresh
      else if (deltaY > 10 && isAtTop()) {
        isPulling = true;
        if (onRefreshStart) onRefreshStart();
      }
    }

    // Handle horizontal swiping
    if (isSwiping) {
      currentSwipe = deltaX;
      e.preventDefault(); // Prevent scrolling during swipe

      // Get the current UI state (sidebar showing or chat area showing)
      const isSidebarShowing = !sidebar.classList.contains('hide');

      if ((isSidebarShowing && deltaX < 0) || (!isSidebarShowing && deltaX > 0)) {
        // Apply resistance effect to make swiping feel more natural
        const resistance = 0.5;
        const transformX = deltaX * resistance;

        // Only apply transform during active swipe - don't override CSS classes
        // Use a data attribute to track that we're in a gesture - this prevents conflicts
        sidebar.dataset.swiping = 'true';
        
        if (isSidebarShowing) {
          // Swiping left to hide sidebar (limit to negative values only)
          if (transformX < 0) {
            sidebar.style.transform = `translateX(${transformX}px)`;
          }
        } else {
          // Swiping right to show sidebar (ensure we start from -100%)
          const percentValue = Math.min(0, -100 + (transformX / container.offsetWidth) * 100);
          sidebar.style.transform = `translateX(${percentValue}%)`;
        }
      }
    }

    // Handle vertical pull-to-refresh
    if (isPulling && !isSwiping) {
      e.preventDefault(); // Prevent normal scrolling

      // Calculate pull distance with increased resistance as user pulls further
      pullDistance = Math.min(deltaY * PULL_RESISTANCE, MAX_PULL_DISTANCE);

      // Update the refresh indicator
      if (refreshIndicator) {
        refreshIndicator.style.transform = `translateY(${pullDistance}px)`;

        // Update indicator text
        if (pullDistance > SWIPE_THRESHOLD) {
          refreshIndicator.textContent = 'Release to refresh';
        } else {
          refreshIndicator.textContent = 'Pull down to refresh';
        }
      }
    }
  };

  // Handle touch end events
  const handleTouchEnd = (e) => {
    // Clear the swiping data attribute to avoid style conflicts
    if (sidebar && sidebar.dataset.swiping) {
      delete sidebar.dataset.swiping;
    }
    // Handle swipe completion
    if (isSwiping) {
      const isSidebarShowing = !sidebar.classList.contains('hide');

      // We'll use CSS classes instead of direct style manipulation
      // as this plays better with React's state management
      
      // Determine what action to take based on swipe distance
      if (isSidebarShowing && currentSwipe < -SWIPE_THRESHOLD) {
        // Don't manipulate style directly, use callback to update state
        if (onSidebarHide) {
          // Add a transition class temporarily for animation
          sidebar.classList.add('animating');
          onSidebarHide();
        }
      } else if (!isSidebarShowing && currentSwipe > SWIPE_THRESHOLD) {
        if (onSidebarShow) {
          // Add a transition class temporarily for animation
          sidebar.classList.add('animating');
          onSidebarShow();
        }
      } else {
        // If not passing threshold, reset any inline styles but don't change state
        sidebar.style.transform = '';
      }

      // Clean up animation class after transition completes
      setTimeout(() => {
        sidebar.classList.remove('animating');
        // Clear any inline styles that might interfere with the CSS classes
        sidebar.style.transition = '';
        sidebar.style.transform = '';
      }, ANIMATION_DURATION);
    }

    // Handle pull-to-refresh completion
    if (isPulling) {
      if (refreshIndicator) {
        refreshIndicator.style.transition = `transform ${ANIMATION_DURATION}ms ease`;

        if (pullDistance > SWIPE_THRESHOLD) {
          // Trigger refresh
          refreshIndicator.style.transform = 'translateY(40px)';
          if (onRefresh) onRefresh();

          // Add success indicator
          refreshIndicator.classList.add('refreshSuccess');

          // Reset after a delay
          setTimeout(() => {
            refreshIndicator.style.transform = 'translateY(0)';
            refreshIndicator.classList.remove('refreshSuccess');
            if (onRefreshEnd) onRefreshEnd();
          }, 1000);
        } else {
          // Not pulled far enough, just reset
          refreshIndicator.style.transform = 'translateY(0)';
          setTimeout(() => {
            if (onRefreshEnd) onRefreshEnd();
          }, ANIMATION_DURATION);
        }

        // Clear transition after animation completes
        setTimeout(() => {
          refreshIndicator.style.transition = '';
        }, ANIMATION_DURATION);
      }
    }
  };

  // Check if device supports touch events
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!isTouchDevice) return;

  // Add event listeners
  if (container) {
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Return cleanup function
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }

  return null;
};

/**
 * Adds vibration feedback for various chat actions
 * @param {string} action - The action being performed
 */
export const provideTactileFeedback = (action) => {
  // Check if device supports vibration
  if (!('vibrate' in navigator)) return;

  switch (action) {
    case 'send':
      navigator.vibrate(20);
      break;
    case 'sendFile':
      navigator.vibrate(40);
      break;
    case 'wink':
      navigator.vibrate([20, 30, 20]);
      break;
    case 'selectConversation':
      navigator.vibrate(20);
      break;
    case 'callStart':
      navigator.vibrate([50, 100, 50]);
      break;
    case 'callEnd':
      navigator.vibrate(100);
      break;
    case 'error':
      navigator.vibrate([100, 50, 100]);
      break;
    default:
      navigator.vibrate(15);
  }
};

/**
 * Enhances scrolling behavior for the messages container
 * @param {HTMLElement} container - The messages container element
 */
export const enhanceScrolling = (container) => {
  if (!container) return null;

  const scrollHandler = () => {
    // Add momentum scrolling on iOS
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      container.style.WebkitOverflowScrolling = 'touch';
    }

    // Mark as scrolling for animation purposes
    container.classList.add('scrolling');

    // Remove the class after scrolling stops
    clearTimeout(container.scrollTimeout);
    container.scrollTimeout = setTimeout(() => {
      container.classList.remove('scrolling');
    }, 200);
  };

  container.addEventListener('scroll', scrollHandler, { passive: true });

  // Return cleanup function
  return () => {
    container.removeEventListener('scroll', scrollHandler);
  };
};

/**
 * Checks if the app is being used in standalone mode (installed PWA)
 * @returns {boolean} True if running as installed PWA
 */
export const isRunningAsInstalledPwa = () => {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone || // for iOS
         document.referrer.includes('android-app://');
};

/**
 * Shows installation prompt for PWA
 * @param {Function} onPromptShown - Callback for when prompt is shown
 */
export const promptForInstallation = (onPromptShown) => {
  // Check if already installed
  if (isRunningAsInstalledPwa()) return false;

  // Check if we have a stored install prompt
  if (window.deferredPrompt) {
    // Show prompt
    window.deferredPrompt.prompt();

    // Wait for user response
    window.deferredPrompt.userChoice.then((choiceResult) => {
      log.info(`User ${choiceResult.outcome === 'accepted' ? 'accepted' : 'declined'} the install prompt`);
      window.deferredPrompt = null;
    });

    if (onPromptShown) onPromptShown();
    return true;
  }

  return false;
};

export default {
  setupTouchGestures,
  provideTactileFeedback,
  enhanceScrolling,
  isRunningAsInstalledPwa,
  promptForInstallation
};
