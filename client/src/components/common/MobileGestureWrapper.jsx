import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useIsMobile, useMobileDetect } from '../../hooks';
import { enhanceScrolling, provideTactileFeedback } from '../../utils/mobileGestures';
import logger from '../../utils/logger';

const log = logger.create('MobileGestureWrapper');

/**
 * A wrapper component that adds mobile optimizations to any component
 * - Enhanced scrolling
 * - Swipe gestures
 * - Tactile feedback
 * - Properly handles mobile viewports
 */
const MobileGestureWrapper = ({
  children,
  className = '',
  enableSwipe = false,
  onSwipeLeft = null,
  onSwipeRight = null,
  swipeThreshold = 50,
  enablePullToRefresh = false,
  onRefresh = null,
  id = null
}) => {
  // Mobile detection
  const isMobile = useIsMobile();
  const { isTouch } = useMobileDetect();
  
  // Refs
  const containerRef = useRef(null);
  const refreshIndicatorRef = useRef(null);
  
  // Setup scroll enhancements
  useEffect(() => {
    let cleanupScrolling = null;
    if (isTouch && containerRef.current) {
      cleanupScrolling = enhanceScrolling(containerRef.current);
      log.debug('Mobile scroll enhancements applied');
    }
    
    return () => {
      if (cleanupScrolling) cleanupScrolling();
    };
  }, [isTouch]);
  
  // Setup swipe gestures
  useEffect(() => {
    if (!isTouch || !containerRef.current || !enableSwipe) return;
    
    let touchStartX = 0;
    let touchEndX = 0;
    let touchStartY = 0;
    let touchEndY = 0;
    
    const handleTouchStart = (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    };
    
    const handleTouchEnd = (e) => {
      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;
      handleSwipe();
    };
    
    const handleSwipe = () => {
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      
      // Ensure the swipe is horizontal (more X movement than Y)
      if (Math.abs(deltaX) < Math.abs(deltaY)) return;
      
      if (deltaX > swipeThreshold) {
        // Right swipe
        if (onSwipeRight) {
          if (isTouch) provideTactileFeedback('selectConversation');
          onSwipeRight();
        }
      } else if (deltaX < -swipeThreshold) {
        // Left swipe
        if (onSwipeLeft) {
          if (isTouch) provideTactileFeedback('selectConversation');
          onSwipeLeft();
        }
      }
    };
    
    const element = containerRef.current;
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isTouch, enableSwipe, onSwipeLeft, onSwipeRight, swipeThreshold]);
  
  // Setup pull-to-refresh
  useEffect(() => {
    if (!isTouch || !containerRef.current || !enablePullToRefresh || !onRefresh) return;
    
    let touchStartY = 0;
    let pullDistance = 0;
    let isPulling = false;
    
    const handleTouchStart = (e) => {
      // Only enable pull-to-refresh when at the top of the container
      if (containerRef.current.scrollTop <= 1) {
        touchStartY = e.touches[0].clientY;
        isPulling = true;
      }
    };
    
    const handleTouchMove = (e) => {
      if (!isPulling) return;
      
      const touchY = e.touches[0].clientY;
      const deltaY = touchY - touchStartY;
      
      // Only allow pulling down (positive deltaY)
      if (deltaY > 0) {
        pullDistance = Math.min(deltaY * 0.4, 80); // Apply resistance
        
        // Update the refresh indicator if it exists
        if (refreshIndicatorRef.current) {
          refreshIndicatorRef.current.style.transform = `translateY(${pullDistance}px)`;
          refreshIndicatorRef.current.textContent = pullDistance > 70 ? 'Release to refresh' : 'Pull to refresh';
        }
        
        // Prevent normal scrolling
        e.preventDefault();
      }
    };
    
    const handleTouchEnd = () => {
      if (!isPulling) return;
      
      if (pullDistance > 70 && onRefresh) {
        // Trigger refresh
        if (refreshIndicatorRef.current) {
          refreshIndicatorRef.current.textContent = 'Refreshing...';
        }
        
        if (isTouch) provideTactileFeedback('send');
        onRefresh();
      }
      
      // Reset
      if (refreshIndicatorRef.current) {
        refreshIndicatorRef.current.style.transition = 'transform 0.3s ease';
        refreshIndicatorRef.current.style.transform = 'translateY(0)';
        
        setTimeout(() => {
          if (refreshIndicatorRef.current) {
            refreshIndicatorRef.current.style.transition = '';
          }
        }, 300);
      }
      
      isPulling = false;
      pullDistance = 0;
    };
    
    const element = containerRef.current;
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isTouch, enablePullToRefresh, onRefresh]);
  
  return (
    <div 
      ref={containerRef}
      id={id}
      className={`mobile-gesture-wrapper ${isMobile ? 'mobile-optimized' : ''} ${className}`}
    >
      {enablePullToRefresh && (
        <div className="pull-to-refresh-indicator" ref={refreshIndicatorRef}>
          Pull to refresh
        </div>
      )}
      {children}
    </div>
  );
};

MobileGestureWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  enableSwipe: PropTypes.bool,
  onSwipeLeft: PropTypes.func,
  onSwipeRight: PropTypes.func,
  swipeThreshold: PropTypes.number,
  enablePullToRefresh: PropTypes.bool,
  onRefresh: PropTypes.func,
  id: PropTypes.string
};

export default MobileGestureWrapper;