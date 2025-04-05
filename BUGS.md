star# Mandarin App Bug Report

This document catalogs bugs and issues found in the Mandarin application, organized by severity and category.

## Critical Bugs

### 1. State Management & Race Conditions

1. **Story Creation Race Condition** - `Dashboard.jsx` (lines 262-270) & `StoryCreator.jsx` (lines 82-97)
   - Issue: Tries to access `response.success` which might be undefined/null
   - Fix: Enhance response validation to handle multiple response formats

2. **UserProfileModal Profile Loading Issues** - `UserProfileModal.jsx` (lines 165-210)
   - Issue: Missing dependency `userId` in `useEffect` with explicit exclusion of `getUser`
   - Fix: Restructure effect to correctly handle dependencies

3. **Socket Connection Management** - `hooks/useSocketConnection.js` (lines 101-133)
   - Issue: Race condition where socket might be connected between check and connection attempt
   - Fix: Use atomic operations or locks for connection state

### 2. Memory Leaks

1. **VideoCall Component** - `VideoCall.jsx` (lines 1640-1648)
   - Issue: `isMountedRef.current = true` set in useEffect, but not reset to false on cleanup
   - Fix: Add `return () => { isMountedRef.current = false; }` to cleanup

2. **Chat Hooks** - `hooks/useChat.js` (lines 49-155)
   - Issue: Multiple timeouts and intervals not properly cleared in cleanup
   - Fix: Store all timeout IDs and clear them in cleanup function

3. **Chat Connection Context** - `context/ChatConnectionContext.jsx` (lines 284-299)
   - Issue: Missing cleanup for `checkConnectionInterval` if component unmounts early
   - Fix: Ensure interval is cleared in all code paths

### 3. State Updates After Unmount

1. **Embedded Chat Component** - `components/EmbeddedChat.jsx` (lines 140-204)
   - Issue: Timeout modifies state after possible unmount
   - Fix: Use mounted ref to check component state before updates

2. **User Profile Modal** - `components/UserProfileModal.jsx` (lines 325-490)
   - Issue: Multiple ref tracking can get out of sync
   - Fix: Consolidate state tracking and ensure cleanup

### 4. Missing Key Props

1. **StoriesCarousel Component** - `components/Stories/StoriesCarousel.jsx` (line 197-209)
   - Issue: Uses `Math.random()` as fallback key
   - Fix: Ensure stable, unique keys for all list items

2. **NotificationsComponent** - `components/NotificationsComponent.jsx` (line 590-596)
   - Issue: Similar random key issue
   - Fix: Use index with stable prefix if IDs aren't available

## Significant Issues

### 1. Property Access Without Checks

1. **UserCard Component** - `UserCard.jsx` (lines 509-517)
   - Issue: No null/undefined checks before accessing array values
   - Fix: Add optional chaining and default values `tags.lookingFor?.[0]?.toLowerCase() || ''`

2. **StoryCreator Component** - `StoryCreator.jsx` (lines 82-97)
   - Issue: Inadequate response validation
   - Fix: Use optional chaining for nested properties

### 2. Performance Issues

1. **Embedded Chat Message Handling** - `EmbeddedChat.jsx` (lines 327-349)
   - Issue: Inefficient message deduplication with O(n²) complexity
   - Fix: Use Map or Set for message tracking

2. **UserContext Double Dispatches** - `UserContext.jsx` (lines 443-466)
   - Issue: Multiple sequential dispatches for same update
   - Fix: Consolidate into single state update

3. **Video Stats Calculation** - `VideoCall.jsx` (lines 1421-1493)
   - Issue: Heavy computation in render thread
   - Fix: Move to web worker or debounce updates

### 3. API and Socket Management

1. **WebRTC Connection Handling** - `VideoCall.jsx` (lines 987-1009)
   - Issue: Race condition in offer creation
   - Fix: Add proper state synchronization

2. **API Response Handling** - `storiesService.jsx` (lines 152-200)
   - Issue: Inconsistent API response format handling
   - Fix: Standardize response processing

## Other Issues

### 1. CSS and Layout Issues

1. **Modal RTL Support** - `Modal.jsx` (lines 125-137)
   - Issue: Uses inline styles for RTL
   - Fix: Move to CSS files with classes

2. **Dashboard Layout** - `Dashboard.jsx` (line 577-634)
   - Issue: Inconsistent responsive design
   - Fix: Use CSS media queries for responsive layouts

### 2. Accessibility Issues

1. **Stories Carousel** - `StoriesCarousel.jsx` (line 197-209)
   - Issue: Missing accessibility attributes
   - Fix: Add aria-label and roles

2. **UserCard Actions** - `UserCard.jsx` (lines 240-242)
   - Issue: Button state not communicated to screen readers
   - Fix: Add aria-pressed attribute

### 3. Error Handling

1. **Chat Connection** - `hooks/useChatConnection.js` (lines 86-96)
   - Issue: No error handling for socket operations
   - Fix: Add try/catch blocks

2. **Video Call Signaling** - `VideoCall.jsx` (lines 1165-1212)
   - Issue: Missing error handling for WebRTC failures
   - Fix: Add proper error handling for negotiation

## Context-Specific Issues

### UserContext

1. **Profile Updates** - (lines 413-437)
   - Issue: Complex manual merging of data
   - Fix: Normalize data structure or improve API responses

### ChatConnectionContext

1. **Event Handler Cleanup** - (lines 253-259)
   - Issue: Event handlers not properly cleaned up
   - Fix: Refactor to ensure cleanup runs in all cases

### NotificationContext

1. **Duplicate Source of Truth** - (throughout)
   - Issue: Data duplicated between context and service
   - Fix: Single source of truth design pattern

### StoriesContext

1. **Story Deduplication** - (lines 118-133)
   - Issue: Complex deduplication logic
   - Fix: Improve API to avoid duplicates or use more efficient client-side handling

### LanguageContext

1. **DOM Manipulation** - (lines 67-69, 79-81)
   - Issue: Direct DOM queries and manipulation
   - Fix: Use React refs and state for DOM updates

## Recommendations for Systematic Fixing

1. **Start with Memory Leaks**: These can cause cascading issues and app slowdowns
2. **Fix Race Conditions**: Focus on data fetching and state updates
3. **Address Property Access**: Prevent runtime errors with proper null checks
4. **Improve Performance Issues**: Optimize rendering and data handling
5. **Fix UI and Accessibility**: Improve user experience and accessibility compliance

When fixing issues, consider maintaining the following:
1. A consistent pattern for async operations
2. Standardized error handling
3. Clear component lifecycle management
4. Proper state initialization and updates

**Note**: Authentication-related code was intentionally excluded from this analysis as requested.
