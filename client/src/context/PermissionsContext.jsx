// client/src/context/PermissionsContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import socketService from '../services/socketService';
import permissionClient from '../services/PermissionClient';
import { useApi } from '../hooks/useApi';
import logger from '../utils/logger';

const log = logger.create('PermissionsContext');

// Create the context
const PermissionsContext = createContext(null);

/**
 * Provider component for photo permissions state management
 */
export const PermissionsProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const api = useApi();

  // State for storing permission statuses
  const [photoPermissions, setPhotoPermissions] = useState({});
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Track if we've loaded permissions yet
  const permissionsLoadedRef = useRef(false);

  // Track if we already warned about missing endpoints
  const warnedAboutMissingEndpointsRef = useRef({
    permissions: false,
    pending: false
  });
  
  // Function to check if a user can view another user's private photos
  const canViewUserPrivatePhotos = useCallback((userId) => {
    if (!userId) return false;
    return !!photoPermissions[userId];
  }, [photoPermissions]);
  
  // Load permissions from the server on initial mount
  useEffect(() => {
    if (!isAuthenticated || !user || permissionsLoadedRef.current) return;

    // Check localStorage for previously known missing endpoints first (before making any API calls)
    try {
      const storedMissingEndpoints = localStorage.getItem('photo_permissions_endpoints_missing');
      if (storedMissingEndpoints) {
        const parsed = JSON.parse(storedMissingEndpoints);
        if (parsed && typeof parsed === 'object') {
          // Update the ref with stored values
          warnedAboutMissingEndpointsRef.current = {
            ...warnedAboutMissingEndpointsRef.current,
            ...parsed
          };

          // If we already know permissions endpoint is missing, skip the API call and load from localStorage right away
          if (warnedAboutMissingEndpointsRef.current.permissions) {
            log.debug('Skipping photo permissions API call - known missing endpoint from localStorage');
            loadFromLocalStorage();
            permissionsLoadedRef.current = true;
            return;
          }
        }
      }
    } catch (storageError) {
      // Ignore localStorage errors
      log.debug('Failed to load missing endpoints info from localStorage');
    }

    const loadFromLocalStorage = () => {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const savedPermissions = localStorage.getItem('photo-permissions');
          if (savedPermissions) {
            const parsedPermissions = JSON.parse(savedPermissions);
            if (parsedPermissions && typeof parsedPermissions === 'object') {
              setPhotoPermissions(parsedPermissions);
              log.debug(`Loaded ${Object.keys(parsedPermissions).length} photo permissions from localStorage`);
            }
          }
        } catch (storageError) {
          log.error('Failed to load photo permissions from localStorage:', storageError);
        }
      }
    };

    const loadPhotoPermissions = async () => {
      setIsLoading(true);
      try {
        log.debug('Loading photo permissions...');

        // Try to load permissions but gracefully handle API route not implemented
        try {
          // Skip if we already know the endpoint doesn't exist
          if (warnedAboutMissingEndpointsRef.current.permissions) {
            log.debug('Skipping photo permissions API call - endpoint previously not found');
            throw new Error('Endpoint not available');
          }

          // Add a specific timeout to avoid long waits for endpoints we know might be missing
          const response = await api.get('/users/photo-permissions', {}, {
            timeout: 5000 // 5 second timeout
          });

          if (response.success && response.permissions) {
            // Convert array to a map for easier lookup
            const permissionsMap = {};
            response.permissions.forEach(perm => {
              permissionsMap[perm.userId] = perm.status;
            });

            setPhotoPermissions(permissionsMap);
            log.debug(`Loaded ${Object.keys(permissionsMap).length} photo permissions`);
          }
        } catch (apiError) {
          // If the endpoint isn't implemented (status 400 or 404)
          if (!warnedAboutMissingEndpointsRef.current.permissions) {
            log.warn('Photo permissions endpoint not implemented, using fallback to localStorage');
            warnedAboutMissingEndpointsRef.current.permissions = true;

            // Store in localStorage that this endpoint is missing
            try {
              localStorage.setItem('photo_permissions_endpoints_missing',
                JSON.stringify(warnedAboutMissingEndpointsRef.current));
            } catch (storageError) {
              // Ignore localStorage errors
              log.debug('Failed to save missing endpoints info to localStorage');
            }
          }

          // Load from localStorage as fallback
          loadFromLocalStorage();
        }

        permissionsLoadedRef.current = true;
      } catch (error) {
        log.error('Failed to load photo permissions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPhotoPermissions();
  }, [isAuthenticated, user, api]);

  // Load pending permission requests - only once and with clear warnings
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Skip if we already know the endpoint doesn't exist
    if (warnedAboutMissingEndpointsRef.current.pending) {
      log.debug('Skipping photo permissions/pending API call - endpoint previously not found');
      return;
    }

    const loadPendingRequests = async () => {
      try {
        log.debug('Loading pending photo permission requests...');

        try {
          // Add a specific timeout to avoid long waits for endpoints we know might be missing
          const response = await api.get('/users/photo-permissions/pending', {}, {
            timeout: 5000  // 5 second timeout
          });

          if (response.success && response.requests) {
            setPendingRequests(response.requests);
            log.debug(`Loaded ${response.requests.length} pending requests`);
          }
        } catch (apiError) {
          // Mark the endpoint as not implemented on first failure
          if (!warnedAboutMissingEndpointsRef.current.pending) {
            log.warn('Pending photo permissions endpoint not implemented - will not retry');
            warnedAboutMissingEndpointsRef.current.pending = true;

            // Store in localStorage that this endpoint is missing
            // This will help avoid unnecessary requests in future sessions
            try {
              localStorage.setItem('photo_permissions_endpoints_missing',
                JSON.stringify(warnedAboutMissingEndpointsRef.current));
            } catch (storageError) {
              // Ignore localStorage errors
              log.debug('Failed to save missing endpoints info to localStorage');
            }
          }
          // No fallback needed here since empty array is default state
        }
      } catch (error) {
        log.error('Failed to load pending requests:', error);
      }
    };

    // Check localStorage for previously known missing endpoints
    try {
      const storedMissingEndpoints = localStorage.getItem('photo_permissions_endpoints_missing');
      if (storedMissingEndpoints) {
        const parsed = JSON.parse(storedMissingEndpoints);
        if (parsed && typeof parsed === 'object') {
          // Update the ref with stored values
          warnedAboutMissingEndpointsRef.current = {
            ...warnedAboutMissingEndpointsRef.current,
            ...parsed
          };

          // If we already know this endpoint is missing, don't try to call it
          if (warnedAboutMissingEndpointsRef.current.pending) {
            log.debug('Skipping photo permissions/pending API call - known missing endpoint from localStorage');
            return;
          }
        }
      }
    } catch (storageError) {
      // Ignore localStorage errors
      log.debug('Failed to load missing endpoints info from localStorage');
    }

    loadPendingRequests();
  }, [isAuthenticated, user, api]);
  
  // Listen for socket events to update permissions in real-time
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    
    // Handle when someone approves our request
    const handlePermissionGranted = (data) => {
      log.debug('Photo permission granted:', data);
      if (data.userId) {
        setPhotoPermissions(prev => ({
          ...prev,
          [data.userId]: 'approved'
        }));
        
        // Show a notification to the user
        if (window.Notification && Notification.permission === 'granted') {
          new Notification('Photo Access Granted', {
            body: 'You now have access to view private photos'
          });
        }
      }
    };
    
    // Handle a new incoming request
    const handleNewRequest = (data) => {
      log.debug('New photo permission request received:', data);
      if (data && data.request) {
        setPendingRequests(prev => [data.request, ...prev]);
      }
    };
    
    // Set up event listeners
    const unsubscribeGranted = socketService.on('photoPermissionGranted', handlePermissionGranted);
    const unsubscribeRequest = socketService.on('photoPermissionRequested', handleNewRequest);
    
    // Clean up event listeners
    return () => {
      unsubscribeGranted();
      unsubscribeRequest();
    };
  }, [isAuthenticated, user]);
  
  // Save permissions to localStorage as fallback
  const savePermissionsToLocalStorage = useCallback((permissions) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('photo-permissions', JSON.stringify(permissions));
        log.debug('Saved photo permissions to localStorage');
      } catch (error) {
        log.error('Failed to save permissions to localStorage:', error);
      }
    }
  }, []);

  // Function to request permission to view a user's private photos
  const requestPhotoPermission = useCallback(async (userId) => {
    if (!userId || !isAuthenticated) {
      log.warn('Cannot request permission: missing userId or not authenticated');
      return { success: false, error: 'Invalid request' };
    }

    try {
      log.debug(`Requesting permission to view private photos for user ${userId}`);

      try {
        // For the photoId, we can use 'all' to request access to all photos
        const result = await permissionClient.requestPhotoPermission(userId, 'all');

        if (result.success) {
          // Update local state optimistically - will be 'pending' until approved
          setPhotoPermissions(prev => {
            const newPermissions = {
              ...prev,
              [userId]: 'pending'
            };

            // Save to localStorage as fallback
            savePermissionsToLocalStorage(newPermissions);

            return newPermissions;
          });
          return { success: true };
        } else {
          return { success: false, error: result.error || 'Request failed' };
        }
      } catch (socketError) {
        log.warn('Socket-based permission request failed, using local fallback:', socketError);

        // Fallback to local state only when socket fails
        setPhotoPermissions(prev => {
          const newPermissions = {
            ...prev,
            [userId]: 'pending'
          };

          // Save to localStorage as fallback
          savePermissionsToLocalStorage(newPermissions);

          return newPermissions;
        });

        return { success: true, message: 'Used local fallback' };
      }
    } catch (error) {
      log.error('Failed to request photo permission:', error);
      return { success: false, error: error.message || 'Request failed' };
    }
  }, [isAuthenticated, savePermissionsToLocalStorage]);
  
  // Function to approve a permission request
  const approvePhotoPermission = useCallback(async (requestId) => {
    if (!requestId || !isAuthenticated) {
      return { success: false, error: 'Invalid request' };
    }

    try {
      log.debug(`Approving photo permission request ${requestId}`);

      try {
        const result = await permissionClient.respondToPhotoPermission(requestId, 'approved');

        if (result.success) {
          // Remove from pending requests
          setPendingRequests(prev => {
            // Find the request to get the userId
            const request = prev.find(req => req._id === requestId);

            if (request && request.userId) {
              // Update permissions
              setPhotoPermissions(prevPermissions => {
                const newPermissions = {
                  ...prevPermissions,
                  [request.userId]: 'approved'
                };

                // Save to localStorage
                savePermissionsToLocalStorage(newPermissions);

                return newPermissions;
              });
            }

            // Remove the request from pending list
            return prev.filter(req => req._id !== requestId);
          });

          return { success: true };
        } else {
          return { success: false, error: result.error || 'Approval failed' };
        }
      } catch (socketError) {
        log.warn('Socket-based permission approval failed, using local fallback:', socketError);

        // Fallback: just remove from pending and update local state
        setPendingRequests(prev => {
          // Find the request to get the userId
          const request = prev.find(req => req._id === requestId);

          if (request && request.userId) {
            // Update permissions
            setPhotoPermissions(prevPermissions => {
              const newPermissions = {
                ...prevPermissions,
                [request.userId]: 'approved'
              };

              // Save to localStorage
              savePermissionsToLocalStorage(newPermissions);

              return newPermissions;
            });
          }

          // Remove the request from pending list
          return prev.filter(req => req._id !== requestId);
        });

        return { success: true, message: 'Used local fallback' };
      }
    } catch (error) {
      log.error('Failed to approve photo permission:', error);
      return { success: false, error: error.message || 'Approval failed' };
    }
  }, [isAuthenticated, savePermissionsToLocalStorage]);
  
  // Function to reject a permission request
  const rejectPhotoPermission = useCallback(async (requestId) => {
    if (!requestId || !isAuthenticated) {
      return { success: false, error: 'Invalid request' };
    }

    try {
      log.debug(`Rejecting photo permission request ${requestId}`);

      try {
        const result = await permissionClient.respondToPhotoPermission(requestId, 'rejected');

        if (result.success) {
          // Remove from pending requests
          setPendingRequests(prev => {
            // Find the request to get the userId
            const request = prev.find(req => req._id === requestId);

            if (request && request.userId) {
              // Update permissions state to reflect rejection
              setPhotoPermissions(prevPermissions => {
                const newPermissions = {
                  ...prevPermissions,
                  [request.userId]: 'rejected'
                };

                // Save to localStorage
                savePermissionsToLocalStorage(newPermissions);

                return newPermissions;
              });
            }

            // Remove the request from pending list
            return prev.filter(req => req._id !== requestId);
          });

          return { success: true };
        } else {
          return { success: false, error: result.error || 'Rejection failed' };
        }
      } catch (socketError) {
        log.warn('Socket-based permission rejection failed, using local fallback:', socketError);

        // Fallback: just remove from pending
        setPendingRequests(prev => {
          // Find the request to get the userId
          const request = prev.find(req => req._id === requestId);

          if (request && request.userId) {
            // Update permissions state to reflect rejection
            setPhotoPermissions(prevPermissions => {
              const newPermissions = {
                ...prevPermissions,
                [request.userId]: 'rejected'
              };

              // Save to localStorage
              savePermissionsToLocalStorage(newPermissions);

              return newPermissions;
            });
          }

          // Remove the request from pending list
          return prev.filter(req => req._id !== requestId);
        });

        return { success: true, message: 'Used local fallback' };
      }
    } catch (error) {
      log.error('Failed to reject photo permission:', error);
      return { success: false, error: error.message || 'Rejection failed' };
    }
  }, [isAuthenticated, savePermissionsToLocalStorage]);
  
  // Function to grant permission directly (for users who want to allow someone to see private photos)
  const grantPhotoPermission = useCallback(async (userId) => {
    if (!userId || !isAuthenticated) {
      return { success: false, error: 'Invalid request' };
    }

    try {
      log.debug(`Directly granting photo permission for user ${userId}`);

      try {
        const response = await api.post(`/users/photo-permissions/grant`, { userId });

        if (response.success) {
          // Update local state to reflect granted permission
          setPhotoPermissions(prev => {
            const newPermissions = {
              ...prev,
              [userId]: 'approved'
            };

            // Save to localStorage as fallback
            savePermissionsToLocalStorage(newPermissions);

            return newPermissions;
          });

          return { success: true };
        } else {
          return { success: false, error: response.error || 'Granting permission failed' };
        }
      } catch (apiError) {
        log.warn('API-based permission grant failed, using local fallback:', apiError);

        // Fallback to local state only when API fails
        setPhotoPermissions(prev => {
          const newPermissions = {
            ...prev,
            [userId]: 'approved'
          };

          // Save to localStorage as fallback
          savePermissionsToLocalStorage(newPermissions);

          return newPermissions;
        });

        return { success: true, message: 'Used local fallback' };
      }
    } catch (error) {
      log.error('Failed to grant photo permission:', error);
      return { success: false, error: error.message || 'Granting permission failed' };
    }
  }, [isAuthenticated, api, savePermissionsToLocalStorage]);
  
  // Batch approve all pending requests
  const approveAllPendingRequests = useCallback(async () => {
    if (pendingRequests.length === 0) {
      return { success: true, message: 'No pending requests' };
    }

    try {
      log.debug(`Approving all ${pendingRequests.length} pending requests`);

      try {
        const response = await api.post('/users/photo-permissions/approve-all');

        if (response.success) {
          // Collect all user IDs from requests
          const userIds = pendingRequests.map(req => req.userId).filter(Boolean);

          // Update permissions for all these users
          if (userIds.length > 0) {
            setPhotoPermissions(prev => {
              const newPermissions = { ...prev };

              userIds.forEach(userId => {
                if (userId) {
                  newPermissions[userId] = 'approved';
                }
              });

              // Save to localStorage
              savePermissionsToLocalStorage(newPermissions);

              return newPermissions;
            });
          }

          // Clear all pending requests
          setPendingRequests([]);
          return { success: true };
        } else {
          return { success: false, error: response.error || 'Batch approval failed' };
        }
      } catch (apiError) {
        log.warn('API-based batch approval failed, using local fallback:', apiError);

        // Manually approve each request using local state only
        const userIds = pendingRequests.map(req => req.userId).filter(Boolean);

        // Update permissions for all these users
        if (userIds.length > 0) {
          setPhotoPermissions(prev => {
            const newPermissions = { ...prev };

            userIds.forEach(userId => {
              if (userId) {
                newPermissions[userId] = 'approved';
              }
            });

            // Save to localStorage
            savePermissionsToLocalStorage(newPermissions);

            return newPermissions;
          });
        }

        // Clear all pending requests
        setPendingRequests([]);

        return { success: true, message: 'Used local fallback' };
      }
    } catch (error) {
      log.error('Failed to approve all permissions:', error);
      return { success: false, error: error.message || 'Batch approval failed' };
    }
  }, [pendingRequests, api, savePermissionsToLocalStorage]);
  
  // Provide the context value
  const contextValue = {
    photoPermissions,
    pendingRequests,
    isLoading,
    canViewUserPrivatePhotos,
    requestPhotoPermission,
    approvePhotoPermission,
    rejectPhotoPermission,
    grantPhotoPermission,
    approveAllPendingRequests
  };
  
  return (
    <PermissionsContext.Provider value={contextValue}>
      {children}
    </PermissionsContext.Provider>
  );
};

// Hook for using the permissions context
export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};

export default PermissionsContext;