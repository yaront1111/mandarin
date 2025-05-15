# Socket Implementation Migration Guide

This guide outlines the steps to migrate from the current socket implementation to the enhanced version.

## Overview of Changes

The enhanced socket implementation provides several improvements:

- Better reliability with exponential backoff reconnection
- Message queuing for offline recipients
- Improved connection monitoring and diagnostics
- More efficient caching and deduplication
- Consolidated client architecture with clear responsibilities
- Enhanced call handling with retry logic

## Migration Steps

### Server-Side Migration

1. **Add enhanced modules to your project**

   All enhanced server modules are in `/server/socket/enhanced/` directory:
   - `index.js` - Main socket initialization
   - `backoff.js` - Exponential backoff implementation
   - `monitoring.js` - Connection monitoring
   - `messaging.js` - Enhanced messaging with queuing
   - `callService.js` - Enhanced call handling

2. **Update server.js to use enhanced socket**

   Replace:
   ```js
   import initSocketServer from "./socket/index.js";
   
   // ... 
   
   const io = initSocketServer(server);
   ```

   With:
   ```js
   import initEnhancedSocketServer from "./socket/enhanced/index.js";
   
   // ...
   
   const io = await initEnhancedSocketServer(server);
   ```

3. **Update environment variables (optional)**

   The enhanced implementation supports additional configuration options that can be set in your environment:
   
   ```
   # Socket performance tuning
   SOCKET_PING_INTERVAL=15000
   SOCKET_PING_TIMEOUT=30000
   SOCKET_CONNECT_TIMEOUT=30000
   
   # Rate limiting
   SOCKET_RATE_LIMIT_MAX=100
   SOCKET_RATE_LIMIT_WINDOW_MS=900000
   
   # Connection monitoring
   SOCKET_CLEANUP_INTERVAL_MS=300000
   INACTIVITY_THRESHOLD_MS=600000
   ```

### Client-Side Migration

1. **Add enhanced client modules**

   Enhanced client modules are in `/client/src/services/enhanced/` and `/client/src/context/enhanced/`:
   - `socketClient.js` - Enhanced socket client
   - `chatService.js` - Enhanced chat service
   - `UnifiedChatContext.jsx` - Unified chat context

2. **Update imports in your application**

   Replace all imports of the old services with the enhanced versions:

   ```js
   // Replace:
   import socketClient from "./services/socketClient";
   import socketService from "./services/socketService";
   import chatService from "./services/ChatService";

   // With:
   import socketClient from "./services/enhanced/socketClient";
   import chatService from "./services/enhanced/chatService";
   ```

3. **Replace context providers**

   Replace both `ChatProvider` and `ChatConnectionProvider` with the unified provider:

   ```jsx
   // Replace:
   import { ChatProvider } from "./context/ChatContext";
   import { ChatConnectionProvider } from "./context/ChatConnectionContext";

   // App.jsx
   <ChatConnectionProvider>
     <ChatProvider>
       {/* App components */}
     </ChatProvider>
   </ChatConnectionProvider>

   // With:
   import { UnifiedChatProvider } from "./context/enhanced/UnifiedChatContext";

   // App.jsx
   <UnifiedChatProvider>
     {/* App components */}
   </UnifiedChatProvider>
   ```

4. **Update hooks usage**

   Replace the hook imports:

   ```js
   // Replace:
   import { useChat } from "./context/ChatContext";
   import { useChatConnection } from "./context/ChatConnectionContext";

   // With:
   import { useUnifiedChat } from "./context/enhanced/UnifiedChatContext";
   ```

5. **Component changes**

   The `useUnifiedChat` hook provides the same interface as the existing hooks, with a few enhancements:

   ```js
   // Before:
   const { messages, sendMessage } = useChat();
   const { connected } = useChatConnection();

   // After:
   const { 
     messages, 
     sendMessage, 
     isConnected, // renamed from 'connected'
     connecting,  // new
     getDiagnostics // new
   } = useUnifiedChat();
   ```

## Gradual Migration

If you prefer a more gradual approach, you can implement a hybrid solution:

1. Start by implementing the server-side improvements first
2. Keep the old client services but modify them to work with the enhanced server
3. Migrate components one by one to the new context
4. Once all components are migrated, remove the old implementations

## Testing the Migration

1. **Connection Testing**:
   - Verify that sockets connect properly
   - Test reconnection by temporarily disabling the network
   - Ensure connection status is properly reflected in the UI

2. **Messaging Testing**:
   - Send messages between users
   - Check offline message delivery
   - Verify message status updates

3. **Call Testing**:
   - Test audio/video calls
   - Check call retry mechanism
   - Verify call status updates

## Diagnostics

The enhanced implementation includes better diagnostics capabilities:

1. **Server-side diagnostics logs**:
   - Connection monitoring logs every 5 minutes
   - Socket health check results
   - Queue statistics

2. **Client-side diagnostics**:
   - Use `getDiagnostics()` from `useUnifiedChat()`
   - Check console logs for connection status
   - Use the browser's Network tab to inspect socket connections

## Rollback Plan

If issues arise during migration:

1. Replace imports with the original versions
2. Switch back to the original context providers
3. Revert server code to use the original socket initialization

## Benefits After Migration

- More reliable reconnection
- Better handling of network issues
- Reduced duplicate messages
- Improved performance with more efficient caching
- Better cross-tab synchronization
- More comprehensive diagnostics and monitoring