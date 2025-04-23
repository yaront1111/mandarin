# Testing Custom Hooks

This document provides guidance for testing the custom hooks in this application.

## Testing Approach

1. **Unit Tests**: Test each hook in isolation
2. **Integration Tests**: Test hooks together with components
3. **End-to-End Tests**: Test full user flows

## Testing useChatMessages Hook

### Setup

```javascript
import { renderHook, act } from '@testing-library/react-hooks';
import { useChatMessages } from './useChatMessages';

// Mock dependencies
jest.mock('./useApi', () => ({
  useApi: () => ({
    get: jest.fn().mockResolvedValue([
      { _id: 'msg1', content: 'Test message', sender: 'user1', recipient: 'user2' }
    ]),
    post: jest.fn().mockResolvedValue({ _id: 'msg2', content: 'New message' })
  })
}));

jest.mock('./useSocketConnection', () => ({
  useSocketConnection: () => ({
    connected: true,
    on: jest.fn((event, callback) => {
      // Store the callback for manual triggering in tests
      mockSocketCallbacks[event] = callback;
      return jest.fn(); // Return unregister function
    }),
    emit: jest.fn((event, data, callback) => {
      if (callback) callback({ success: true, data: { _id: 'msg3' } });
    })
  })
}));

// Mock AuthContext
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { _id: 'user1' }
  })
}));

const mockSocketCallbacks = {};
```

### Test Cases

1. **Loading Messages**

```javascript
test('should load messages on initialization', async () => {
  const { result, waitForNextUpdate } = renderHook(() => useChatMessages('user2'));
  
  // Initial state
  expect(result.current.loading).toBe(true);
  
  await waitForNextUpdate();
  
  // After loading
  expect(result.current.loading).toBe(false);
  expect(result.current.messages).toHaveLength(1);
  expect(result.current.messages[0]._id).toBe('msg1');
});
```

2. **Sending Messages**

```javascript
test('should send a message and update state', async () => {
  const { result, waitForNextUpdate } = renderHook(() => useChatMessages('user2'));
  
  await waitForNextUpdate(); // Wait for initial load
  
  await act(async () => {
    await result.current.sendMessage('Hello, world!', 'text');
  });
  
  // Check messages array was updated
  expect(result.current.messages).toHaveLength(2);
  expect(result.current.messages[1].content).toBe('Hello, world!');
});
```

3. **Receiving Messages**

```javascript
test('should handle incoming messages', async () => {
  const { result, waitForNextUpdate } = renderHook(() => useChatMessages('user2'));
  
  await waitForNextUpdate(); // Wait for initial load
  
  // Simulate incoming message
  act(() => {
    mockSocketCallbacks.messageReceived({
      _id: 'incoming1',
      content: 'Incoming message',
      sender: 'user2',
      recipient: 'user1',
      createdAt: new Date().toISOString()
    });
  });
  
  // Check messages array was updated
  expect(result.current.messages).toHaveLength(2);
  expect(result.current.messages[1].content).toBe('Incoming message');
});
```

4. **Typing Indicators**

```javascript
test('should handle typing indicators', async () => {
  const { result, waitForNextUpdate } = renderHook(() => useChatMessages('user2'));
  
  await waitForNextUpdate(); // Wait for initial load
  
  // Simulate typing event
  act(() => {
    mockSocketCallbacks.userTyping({
      sender: 'user2'
    });
  });
  
  // Check typing indicator
  expect(result.current.isTyping).toBe(true);
  
  // Wait for timeout
  jest.advanceTimersByTime(3000);
  
  // Should reset after timeout
  expect(result.current.isTyping).toBe(false);
});
```

5. **Error Handling**

```javascript
test('should handle and clear errors', async () => {
  // Modify the mock to throw an error
  require('./useApi').useApi().get.mockRejectedValueOnce(new Error('API error'));
  
  const { result, waitForNextUpdate } = renderHook(() => useChatMessages('user2'));
  
  await waitForNextUpdate();
  
  // Should have error
  expect(result.current.error).toBe('API error');
  
  // Clear error
  act(() => {
    result.current.clearError();
  });
  
  // Error should be cleared
  expect(result.current.error).toBe(null);
});
```

## Manual Testing Checklist

- [ ] Messages load when opening a chat
- [ ] Sending a message updates the UI immediately
- [ ] Messages are received in real-time
- [ ] Typing indicators show when the other user is typing
- [ ] File uploads work correctly
- [ ] Read receipts update correctly
- [ ] Errors are displayed properly
- [ ] Chat persists when switching between recipients
- [ ] Multiple chats can be open simultaneously
- [ ] Socket reconnects properly after network interruption

## Performance Notes

The `useChatMessages` hook has been optimized to:

1. Cache messages to reduce API calls
2. Implement debouncing for typing indicators
3. Use optimistic UI updates for better user experience
4. Prevent duplicated API calls with cooldowns and flags
5. Use stable references in dependencies to prevent loops

## Common Issues

1. **Infinite Loops**: Check dependency arrays in useEffect and useCallback
2. **Memory Leaks**: Ensure proper cleanup in useEffect returns
3. **Socket Duplicate Listeners**: Verify all socket listeners are properly removed
4. **Message Duplication**: Check the message comparison logic for duplicates
5. **Testing Sockets**: Use jest.useFakeTimers() for async socket operations
