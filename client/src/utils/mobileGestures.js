/**
 * Mobile Touch Gesture Utility
 * Enhances mobile experience for the Messages component with smooth gesture handling
 */

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

  // Handle touch move events
  const handleTouchMove = (e) => {
    if (!e.touches[0]) return;

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

        if (isSidebarShowing) {
          // Swiping left to hide sidebar
          sidebar.style.transform = `translateX(${transformX}px)`;
        } else {
          // Swiping right to show sidebar
          sidebar.style.transform = `translateX(${-100 + (transformX / container.offsetWidth) * 100}%)`;
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
    // Handle swipe completion
    if (isSwiping) {
      const isSidebarShowing = !sidebar.classList.contains('hide');

      // Add transition for smooth animation
      sidebar.style.transition = `transform ${ANIMATION_DURATION}ms ease`;

      if (isSidebarShowing && currentSwipe < -SWIPE_THRESHOLD) {
        // Hide sidebar if swiped left far enough
        sidebar.style.transform = 'translateX(-100%)';
        if (onSidebarHide) onSidebarHide();
      } else if (!isSidebarShowing && currentSwipe > SWIPE_THRESHOLD) {
        // Show sidebar if swiped right far enough
        sidebar.style.transform = 'translateX(0)';
        if (onSidebarShow) onSidebarShow();
      } else {
        // Reset to original position if not swiped far enough
        sidebar.style.transform = isSidebarShowing ? 'translateX(0)' : 'translateX(-100%)';
      }

      // Clear transition after animation completes
      setTimeout(() => {
        sidebar.style.transition = '';
        sidebar.style.transform = '';

        // Update classes based on final state
        if (isSidebarShowing && currentSwipe < -SWIPE_THRESHOLD) {
          sidebar.classList.add('hide');
        } else if (!isSidebarShowing && currentSwipe > SWIPE_THRESHOLD) {
          sidebar.classList.remove('hide');
        }
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
      console.log(`User ${choiceResult.outcome === 'accepted' ? 'accepted' : 'declined'} the install prompt`);
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
