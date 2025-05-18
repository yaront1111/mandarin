# Photo Permissions Bug Fix Plan

## Issue Summary
When photo permissions are revoked, the UI still shows the green "unlocked" icon even after page refresh. The root causes are:

1. **No real-time socket notifications** when permissions are revoked
2. **LocalStorage caching** that isn't properly cleared 
3. **No direct sync** between UserProfileModal and Messages components
4. **Server doesn't emit events** for permission changes

## Fix Implementation

### 1. Add Socket Notification for Permission Revocation

In `/server/routes/userRoutes.js`, add socket emission after successful revocation:

```javascript
// Add after successful revocation (line ~1470)
// Send socket notification to the affected user
const io = req.app.get('io');
if (io) {
  // Get the recipient's socket connections
  const recipientSockets = userConnections.get(userId);
  if (recipientSockets && recipientSockets.size > 0) {
    recipientSockets.forEach(socketId => {
      io.to(socketId).emit('photoAccessRevoked', {
        ownerId: req.user._id,
        revokedBy: req.user.nickname,
        timestamp: new Date()
      });
    });
  }
}
```

### 2. Handle Socket Event in Client

In `/client/src/pages/Messages.jsx`, add socket listener:

```javascript
// Add in useEffect for socket events (around line 970)
const unsubscribePhotoRevoked = socketService.on("photoAccessRevoked", (data) => {
  const { ownerId } = data;
  
  // Update conversation state if it matches
  setActiveConversation(prev => {
    if (prev?.user?._id === ownerId) {
      return {
        ...prev,
        user: { ...prev.user, photoAccess: false }
      };
    }
    return prev;
  });
  
  // Update conversations list
  setConversations(prev => prev.map(conv => {
    if (conv.user?._id === ownerId) {
      return {
        ...conv,
        user: { ...conv.user, photoAccess: false }
      };
    }
    return conv;
  }));
  
  // Clear localStorage permission status
  try {
    const storedPermissions = localStorage.getItem('photo-permissions-status') || '{}';
    const permissions = JSON.parse(storedPermissions);
    delete permissions[ownerId];
    localStorage.setItem('photo-permissions-status', JSON.stringify(permissions));
  } catch (error) {
    console.error('Failed to clear localStorage permission:', error);
  }
  
  // Add system message
  const systemMessage = {
    _id: generateUniqueId(),
    content: `${data.revokedBy} has revoked your access to their private photos`,
    type: "system",
    createdAt: new Date().toISOString(),
    sender: "system",
    systemType: "photoRevoked"
  };
  
  setMessages(prev => [...prev, systemMessage]);
});

// Clean up
return () => {
  if (unsubscribePhotoRevoked) unsubscribePhotoRevoked();
};
```

### 3. Update UserProfileModal Socket Handler

In `/client/src/components/UserProfileModal.jsx`, add similar handler:

```javascript
// Add new socket listener for revocation (around line 573)
const handlePhotoAccessRevoked = (data) => {
  if (data.ownerId === userId) {
    // Update local state
    setUserPhotoAccess({
      status: "none",
      isLoading: false,
      source: 'socket'
    });
    
    // Clear localStorage
    try {
      const storedPermissions = localStorage.getItem('photo-permissions-status') || '{}';
      const permissions = JSON.parse(storedPermissions);
      delete permissions[userId];
      localStorage.setItem('photo-permissions-status', JSON.stringify(permissions));
    } catch (error) {
      log.error("Failed to clear permission status in localStorage:", error);
    }
    
    // Force refresh of photos
    const timestamp = Date.now();
    clearCache();
    setImageKey(timestamp);
    window.dispatchEvent(new CustomEvent('avatar:refresh', {
      detail: { timestamp }
    }));
    
    // Show notification
    toast.info(`${data.revokedBy} has revoked your access to their private photos`, {
      position: "top-center",
      autoClose: 5000,
      icon: "🔒"
    });
  }
};

const unsubscribeRevoked = socketService.on('photoAccessRevoked', handlePhotoAccessRevoked);
```

### 4. Fix Photo Display Logic

The client already correctly uses `hasPermission` flag from server response. Make sure server always includes this flag in user data response.

### 5. Add Server-Side Notification

Update `/server/utils/photoPermissions.js` to accept io instance:

```javascript
export async function revokePhotoAccess(ownerId, userId, io = null) {
  // ... existing code ...
  
  // After successful revocation
  if (io && permissions.length > 0) {
    // Send notification to affected user
    const grantee = await User.findById(userId);
    const owner = await User.findById(ownerId);
    
    if (grantee && owner) {
      // Create a notification record
      await sendNotification(io, {
        recipient: grantee._id,
        sender: owner._id,
        type: "photoRevoked",
        title: `${owner.nickname} revoked photo access`,
        content: "You no longer have access to their private photos",
        data: { ownerId: owner._id }
      });
    }
  }
  
  return {
    // ... existing return
  };
}
```

### 6. Clear Cache on Logout

Add cleanup in logout flow to prevent stale permission data:

```javascript
// In logout handler
localStorage.removeItem('photo-permissions-status');
```

## Testing Plan

1. User A grants photo access to User B
2. Verify User B can see private photos (no lock icon)
3. User A revokes access
4. Verify User B immediately sees:
   - Lock icon returns
   - System message about revocation
   - Photos become private again
   - Toast notification
5. Refresh page and verify state persists
6. Check localStorage is cleared