# Custom React Hooks

This directory contains custom React hooks that encapsulate reusable logic for the Mandarin application.

## Available Hooks

### useApi

A hook for making standardized API calls with error handling, loading states, and request cancellation.

```jsx
const { get, post, put, delete, upload, loading, error } = useApi();

// Example usage
useEffect(() => {
  get('/users/profile').then(data => {
    setUserData(data);
  });
}, []);
```

### useChatMessages

A hook for managing chat messages with a specific recipient, handling loading, sending, and real-time updates.

```jsx
const { 
  messages,           // Array of message objects
  loading,            // Boolean loading state
  error,              // Error message if any
  isTyping,           // Boolean indicating if recipient is typing
  sendMessage,        // Function to send a text message
  sendTypingIndicator, // Function to send typing indicator
  markMessagesAsRead, // Function to mark messages as read
  loadMessages,       // Function to manually load messages
  clearError,         // Function to clear any error
  sendFileMessage     // Function to send a file message
} = useChatMessages(recipientId);

// Sending a text message
sendMessage("Hello, how are you?", "text");

// Sending a file
sendFileMessage(fileObject, (progress) => {
  console.log(`Upload progress: ${progress}%`);
});
```

### useSocketConnection

A hook for managing socket connections with automatic reconnection and event handling.

```jsx
const { connected, on, emit } = useSocketConnection({
  userId: 'user123',
  token: 'jwt-token'
});

// Listen for events
useEffect(() => {
  const removeListener = on('notification', handleNotification);
  return () => removeListener();
}, [on]);

// Emit events
const sendEvent = () => {
  emit('userAction', { type: 'click', data: {} });
};
```

### useSettings

A hook for managing and persisting user settings.

```jsx
const { 
  settings, 
  updateSetting, 
  saveSettings,
  loading 
} = useSettings();

// Update a setting
updateSetting('darkMode', true);

// Save all settings to the server
saveSettings();
```

### useMounted

A hook to safely handle asynchronous operations in components that might unmount.

```jsx
const { isMounted } = useMounted();

const fetchData = async () => {
  const data = await api.get('/data');
  
  // Only update state if component is still mounted
  if (isMounted()) {
    setData(data);
  }
};
```

### useDebounce

A hook to debounce rapidly changing values.

```jsx
const debouncedSearchTerm = useDebounce(searchTerm, 500);

useEffect(() => {
  // This will only run 500ms after the user stops typing
  searchUsers(debouncedSearchTerm);
}, [debouncedSearchTerm]);
```

### useClickOutside

A hook to detect clicks outside of a specified element.

```jsx
const dropdownRef = useClickOutside(() => {
  setIsOpen(false);
});

return (
  <div ref={dropdownRef} className="dropdown">
    {/* Dropdown content */}
  </div>
);
```

### useLocalStorage

A hook to persist state in localStorage with automatic JSON parsing.

```jsx
const [preferences, setPreferences] = useLocalStorage('user-preferences', {
  theme: 'light',
  notifications: true
});

// Update preferences
setPreferences({ ...preferences, theme: 'dark' });
```

## Best Practices

1. Use these hooks to avoid code duplication across components
2. Ensure proper cleanup in useEffect return functions
3. Be mindful of dependency arrays to prevent infinite loops
4. Prefer using these hooks over direct API calls or socket interactions