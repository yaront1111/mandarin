# Testing Security Features

## 1. Testing Secure Logout

### Test Cases:
1. **Normal Logout**
   - Login to the application
   - Click logout button
   - Verify:
     - All localStorage is cleared
     - All sessionStorage is cleared
     - User is redirected to login page
     - Cannot access protected pages

2. **Multi-Tab Logout**
   - Open app in 2+ browser tabs
   - Login in all tabs
   - Logout from one tab
   - Verify all tabs are logged out

3. **Cache Clearing**
   - Login and use the app
   - Create some cached data (photos, messages)
   - Logout
   - Login with different user
   - Verify no data from previous user is visible

## 2. Testing Inactivity Timer

### Test Cases:
1. **Basic Inactivity**
   - Login to the application
   - Do not interact for 10 minutes
   - Verify automatic logout occurs

2. **Activity Reset**
   - Login to the application
   - Wait 9 minutes
   - Move mouse or type
   - Verify timer resets
   - Wait another 10 minutes
   - Verify logout occurs

3. **Tab Switching**
   - Login to the application
   - Switch to another browser tab
   - Wait 10+ minutes
   - Return to app tab
   - Verify automatic logout

4. **Browser Close/Reopen**
   - Login to the application
   - Close browser tab
   - Wait 10+ minutes
   - Reopen the application
   - Verify automatic logout

5. **Multiple Tabs**
   - Open app in 2 tabs
   - Login in both
   - Be active in one tab
   - Verify both tabs stay logged in
   - Stop activity for 10 minutes
   - Verify both tabs logout

## 3. Visual Countdown (Optional)

To test the countdown timer, add this to any component:
```jsx
import { InactivityCountdown } from '../components/InactivityCountdown';

// In your component render
<InactivityCountdown />
```

### Test Cases:
1. Verify countdown appears when < 5 minutes remain
2. Verify warning style when < 2 minutes remain
3. Verify countdown updates every second

## Console Commands for Testing

You can use these commands in the browser console to verify functionality:

```javascript
// Check if localStorage is cleared
console.log('LocalStorage items:', Object.keys(localStorage));

// Check if sessionStorage is cleared
console.log('SessionStorage items:', Object.keys(sessionStorage));

// Check authentication status
console.log('Is authenticated:', !!localStorage.getItem('token'));

// Simulate inactivity (for testing)
// Note: This won't work due to security, use actual waiting instead

// Check BroadcastChannel support
console.log('BroadcastChannel supported:', 'BroadcastChannel' in window);
```

## Important Notes:
1. The inactivity timer is exactly 10 minutes (600,000ms)
2. Activity includes: mouse movement, clicks, keyboard input, scrolling, touch events
3. The timer pauses when the tab is hidden but tracks the hidden duration
4. All cache clearing happens synchronously before redirect