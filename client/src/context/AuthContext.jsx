"use client"

import { createContext, useState, useContext, useEffect, useCallback, useRef } from "react"
import { toast } from "react-toastify"
import apiService from "../services/apiService.jsx"
import { getToken, setToken, removeToken, isTokenExpired } from "../utils/tokenStorage"
import { logger } from "../utils"

// Create a logger for the auth context
const log = logger.create("AuthContext")

const AuthContext = createContext()

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  // Enhanced user validation and cleanup with centralized ID validation
  const validateAndSetUser = async (userData) => {
    try {
      if (!userData) {
        log.warn("Received null or undefined user data");
        setUser(null);
        return;
      }

      // Make a clean copy of the user data
      const cleanUserData = { ...userData };
      
      // First try to normalize the ID field - we'll use _id consistently
      if (!cleanUserData._id && cleanUserData.id) {
        log.debug("Converting id field to _id for consistency");
        cleanUserData._id = cleanUserData.id;
      }
      
      // Simple validation - should work in all environments
      const isValidId = (id) => id && /^[0-9a-fA-F]{24}$/.test(id.toString());
      
      // Try to fix the ID format using basic string validation
      if (cleanUserData._id) {
        // If it's already a string and valid, use it
        if (typeof cleanUserData._id === 'string' && isValidId(cleanUserData._id)) {
          // Valid ID, no changes needed
        }
        // If it's an object with a toString method (like ObjectId), convert it
        else if (typeof cleanUserData._id === 'object' && cleanUserData._id !== null) {
          try {
            const idString = cleanUserData._id.toString();
            if (isValidId(idString)) {
              log.debug(`Fixed user ID format: object -> ${idString}`);
              cleanUserData._id = idString;
            }
          } catch (err) {
            log.error(`Error converting user ID to string: ${err.message}`);
          }
        }
      }
      
      // If we still don't have a valid ID, try to extract it from a token
      if (!cleanUserData._id || !isValidId(cleanUserData._id)) {
        log.warn(`User data has invalid ID format: "${cleanUserData._id}"`);
        
        // Try to extract the ID from token without using external utils
        try {
          const token = sessionStorage.getItem("token") || localStorage.getItem("token");
          if (token) {
            const base64Url = token.split(".")[1];
            const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
            const payload = JSON.parse(atob(base64));
            
            const tokenId = payload.id || (payload.user && (payload.user._id || payload.user.id));
            if (tokenId && isValidId(tokenId)) {
              log.info(`Using ID from token: ${tokenId}`);
              cleanUserData._id = tokenId;
            }
          }
        } catch (err) {
          log.error(`Error extracting ID from token: ${err.message}`);
        }
        
        // Last resort in development: use a placeholder ID
        if ((!cleanUserData._id || !isValidId(cleanUserData._id)) && process.env.NODE_ENV === "development") {
          log.warn("Development mode: Using placeholder ID as last resort");
          cleanUserData._id = "5f50c31f72c5e315b4b3e1c5"; // Valid MongoDB ObjectId format
        }
      }
      
      // Final validation check
      if (!isValidId(cleanUserData._id)) {
        log.error(`Failed to obtain valid user ID. Invalid format: "${cleanUserData._id}"`);
        
        if (process.env.NODE_ENV === "production") {
          // In production, reject invalid IDs
          toast.error("Authentication error: Your user profile has an invalid format. Please try logging in again.");
          setUser(null);
          setIsAuthenticated(false);
          removeToken();
          return;
        }
      }
      
      // Ensure we always have id field too for backward compatibility
      if (!cleanUserData.id && cleanUserData._id) {
        cleanUserData.id = cleanUserData._id;
      }
      
      log.debug(`Setting user with ID: ${cleanUserData._id}`);
      setUser(cleanUserData);
    } catch (error) {
      log.error(`Error in validateAndSetUser: ${error.message}`);
      
      // Fallback - at least try to set the user as-is in development
      if (process.env.NODE_ENV === "development" && userData) {
        log.warn('Using userData without validation as fallback');
        setUser(userData);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    }
  }

  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  // Refs for tracking refresh token operations
  const refreshTokenPromiseRef = useRef(null)
  const tokenRefreshTimerRef = useRef(null)
  const authCheckTimeoutRef = useRef(null)
  const initialLoadCompletedRef = useRef(false)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Simplified function to fix user ID format without external dependencies
  const fixUserIdFormat = useCallback(async () => {
    if (!user) {
      console.error("Cannot fix user ID: No user available")
      return false
    }
    
    try {
      // Simple validation function
      const isValidId = (id) => id && /^[0-9a-fA-F]{24}$/.test(id.toString());
      
      // Try multiple approaches to get a valid ID
      let validObjectId = null;
      
      // 1. Try to extract a valid ID from the current user._id
      if (user._id) {
        // If it's already a valid string, use it directly
        if (typeof user._id === 'string' && isValidId(user._id)) {
          validObjectId = user._id;
        } 
        // If it's an object (like MongoDB ObjectId), try to extract the ID
        else if (typeof user._id === 'object' && user._id !== null) {
          try {
            const idString = user._id.toString();
            // Look for a valid ObjectId format in the string
            const match = idString.match(/([0-9a-fA-F]{24})/);
            if (match && match[1]) {
              validObjectId = match[1];
              log.debug(`Extracted ObjectId from complex object: ${validObjectId}`);
            }
          } catch (err) {
            log.error(`Failed to extract valid ID from object: ${err.message}`);
          }
        }
      }
      
      // 2. Try user.id if user._id didn't work
      if (!validObjectId && user.id) {
        if (isValidId(user.id)) {
          validObjectId = user.id;
          log.debug(`Using user.id instead of user._id: ${validObjectId}`);
        }
      }
      
      // 3. If that fails, try getting it from the token
      if (!validObjectId) {
        try {
          const token = sessionStorage.getItem("token") || localStorage.getItem("token");
          if (token) {
            const base64Url = token.split(".")[1];
            const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
            const payload = JSON.parse(atob(base64));
            
            // Try various common JWT payload formats
            const tokenId = payload.id || payload.sub || 
                           (payload.user && (payload.user._id || payload.user.id));
                           
            if (tokenId && isValidId(tokenId)) {
              validObjectId = tokenId;
              log.info(`Using ID from token payload: ${validObjectId}`);
            }
          }
        } catch (tokenErr) {
          log.error(`Failed to extract ID from token: ${tokenErr.message}`);
        }
      }
      
      // If we have a valid ID now
      if (validObjectId) {
        // Check if the user already has the correct ID
        if (validObjectId === user._id) {
          log.debug("User ID is already in valid format:", validObjectId);
          
          // Ensure both _id and id fields are consistent
          if (!user.id || user.id !== validObjectId) {
            const fixedUser = {
              ...user,
              id: validObjectId
            };
            setUser(fixedUser);
            log.info(`Added missing id field: ${validObjectId}`);
          }
          
          return true;
        }
  
        // Create a new user object with both _id and id fields set correctly
        const fixedUser = {
          ...user,
          _id: validObjectId,
          id: validObjectId // Ensure both fields are set
        };
  
        // Update the user state
        setUser(fixedUser);
        log.info(`User ID fixed to: ${validObjectId} (was: ${user._id || "undefined"})`);
        return true;
      }
  
      // If we still can't fix it, log the issue
      log.error(`Cannot fix user ID format: ${user._id || "undefined"}`);
      return false;
    } catch (error) {
      log.error(`Error in fixUserIdFormat: ${error.message}`);
      return false;
    }
  }, [user])

  const logout = useCallback(async () => {
    setLoading(true)
    try {
      if (tokenRefreshTimerRef.current) {
        clearTimeout(tokenRefreshTimerRef.current)
        tokenRefreshTimerRef.current = null
      }
      try {
        await apiService.logout()
      } catch (err) {
        console.warn("Logout API call failed:", err)
      }
      removeToken()
      setUser(null)
      setIsAuthenticated(false)
      toast.info("You have been logged out")
    } catch (err) {
      console.error("Logout error:", err)
      removeToken()
      setUser(null)
      setIsAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }, [])

  const scheduleTokenRefresh = useCallback((token) => {
    if (tokenRefreshTimerRef.current) {
      clearTimeout(tokenRefreshTimerRef.current)
      tokenRefreshTimerRef.current = null
    }
    try {
      const base64Url = token.split(".")[1]
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
      const payload = JSON.parse(atob(base64))
      if (payload.exp) {
        const expiresAt = payload.exp * 1000
        const now = Date.now()
        const timeUntilRefresh = expiresAt - now - 5 * 60 * 1000 // refresh 5 minutes before expiry
        if (timeUntilRefresh > 60000) {
          console.log(`Scheduling token refresh in ${Math.round(timeUntilRefresh / 60000)} minutes`)
          const timer = setTimeout(() => {
            refreshToken()
          }, timeUntilRefresh)
          tokenRefreshTimerRef.current = timer
        } else {
          console.log("Token expires soon, refreshing now")
          refreshToken()
        }
      }
    } catch (e) {
      console.error("Error scheduling token refresh:", e)
    }
  }, [])

  const refreshToken = useCallback(() => {
    if (!isAuthenticated && !getToken()) return Promise.resolve(null)
    if (refreshTokenPromiseRef.current) return refreshTokenPromiseRef.current

    refreshTokenPromiseRef.current = (async () => {
      const token = getToken()
      if (!token) return null
      try {
        log.info("Refreshing auth token...")

        // Use apiService directly to bypass interceptors
        const response = await apiService.post(
          "/auth/refresh-token", // Use the consistent endpoint path
          { token },
          {
            headers: { "x-no-cache": "true" },
            _isRefreshRequest: true,
          },
        )

        if (response.success && response.token) {
          const newToken = response.token
          const rememberMe = localStorage.getItem("token") !== null
          setToken(newToken, rememberMe)
          scheduleTokenRefresh(newToken)
          
          // Fix user ID format using the new token if needed
          try {
            // Import utilities
            const tokenUtils = await import("../utils/tokenStorage.js");
            const tokenUserId = tokenUtils.getUserIdFromToken(newToken);
            
            if (tokenUserId && (!user?._id || tokenUserId !== user._id)) {
              log.info(`Updating user ID from refreshed token: ${tokenUserId}`);
              
              // If we have a user object, update its ID
              if (user) {
                const updatedUser = {
                  ...user,
                  _id: tokenUserId,
                  id: tokenUserId // Ensure both _id and id are set
                };
                setUser(updatedUser);
              }
            }
          } catch (idError) {
            log.error("Error updating user ID from token:", idError);
          }
          
          log.info("Token refreshed successfully");
          return newToken;
        } else {
          throw new Error("Invalid refresh response");
        }
      } catch (err) {
        log.error("Token refresh failed:", err);
        refreshTokenPromiseRef.current = null;

        if (err?.response?.status === 401 || err?.status === 401) {
          logout();
        } else {
          const currentToken = getToken();
          if (currentToken && isTokenExpired(currentToken)) {
            log.warn("Token expired, logging out");
            toast.error("Your session has expired. Please log in again.");
            logout();
          }
        }
        return null;
      } finally {
        setTimeout(() => {
          refreshTokenPromiseRef.current = null;
        }, 1000);
      }
    })();

    return refreshTokenPromiseRef.current;
  }, [isAuthenticated, logout, scheduleTokenRefresh, user])

  const register = useCallback(
    async (userData) => {
      setLoading(true)
      setError(null)

      try {
        const response = await apiService.post("/auth/register", userData)

        if (response.success) {
          if (response.token) {
            setToken(response.token, true) // Use remember me by default for new registrations
            validateAndSetUser(response.user)
            setIsAuthenticated(true)

            // Schedule refresh if token exists
            scheduleTokenRefresh(response.token)
            
            // Get latest user data to ensure all fields are loaded
            try {
              const userResponse = await apiService.get("/auth/me")
              if (userResponse.success && userResponse.data) {
                validateAndSetUser(userResponse.data)
              }
            } catch (userDataError) {
              console.warn("Failed to fetch complete user data:", userDataError)
            }
          }
          setLoading(false)
          return response // Return the full response including the token
        } else {
          setError(response.error || "Registration failed")
          setLoading(false)
          return false
        }
      } catch (err) {
        console.error("Registration error:", err)

        // Handle specific validation errors
        if (err.response && err.response.data) {
          if (err.response.data.error) {
            const errorMessage = err.response.data.error
            setError(errorMessage)
            throw new Error(errorMessage)
          } else if (err.response.data.errors && err.response.data.errors.length > 0) {
            // If there are multiple errors, show the first one
            const errorMessage = err.response.data.errors[0].msg
            setError(errorMessage)
            throw new Error(errorMessage)
          } else {
            const errorMessage = "Registration failed. Please check your information and try again."
            setError(errorMessage)
            throw new Error(errorMessage)
          }
        } else {
          const errorMessage = err.message || err.error || (err.code === "EMAIL_EXISTS" ? "User already exists" : "Network error. Please check your connection and try again.")
          setError(errorMessage)
          throw new Error(errorMessage)
        }
      } finally {
        setLoading(false)
      }
    },
    [scheduleTokenRefresh],
  )

  // Centralized token verification and refresh function 
  // Uses the main refreshToken function to ensure consistency
  const checkAndRefreshToken = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) return false;

      // First check if the token is expired
      if (isTokenExpired(token)) {
        log.info("Token is expired, attempting refresh");
        const newToken = await refreshToken();
        return !!newToken;
      }

      // If token isn't expired, verify it on the server
      const response = await apiService.get("/auth/verify");
      if (response.success) {
        return true;
      }

      // If verification fails despite non-expired token, try refresh
      log.warn("Token verification failed, attempting refresh");
      const newToken = await refreshToken();
      return !!newToken;
    } catch (err) {
      log.error("Token verification/refresh error:", err);
      return false;
    }
  }, [logout, refreshToken])

  const login = useCallback(
    async (credentials, rememberMe = true) => { // Default to rememberMe=true
      setLoading(true)
      setError(null)
      try {
        const response = await apiService.post("/auth/login", credentials)
        if (response.success && response.token) {
          setToken(response.token, rememberMe)
          scheduleTokenRefresh(response.token)
          if (response.user) {
            validateAndSetUser(response.user)
            // Initialize notification service asynchronously
            Promise.all([import("../services/notificationService.jsx"), import("../services/socketService.jsx")])
              .then(([notificationModule, socketModule]) => {
                const notificationService = notificationModule.default
                const socketService = socketModule.default

                // Initialize notification service
                if (response.user.settings?.notifications) {
                  notificationService.initialize(response.user.settings)
                } else {
                  notificationService.initialize()
                }

                // Update socket service with privacy settings
                if (response.user.settings?.privacy) {
                  socketService.updatePrivacySettings(response.user.settings.privacy)
                }

                console.log("Services initialized with user settings")
              })
              .catch((err) => {
                console.error("Failed to initialize services:", err)
              })

            const welcomeMessage = response.user.nickname ? `Welcome back, ${response.user.nickname}!` : "Welcome back!"
            toast.success(welcomeMessage)
          } else {
            try {
              const userResponse = await apiService.get("/auth/me")
              if (userResponse.success && userResponse.data) {
                validateAndSetUser(userResponse.data)
                Promise.all([import("../services/notificationService.jsx"), import("../services/socketService.jsx")])
                  .then(([notificationModule, socketModule]) => {
                    const notificationService = notificationModule.default
                    const socketService = socketModule.default

                    // Initialize notification service
                    if (userResponse.data.settings?.notifications) {
                      notificationService.initialize(userResponse.data.settings)
                    } else {
                      notificationService.initialize()
                    }

                    // Update socket service with privacy settings
                    if (userResponse.data.settings?.privacy) {
                      socketService.updatePrivacySettings(userResponse.data.settings.privacy)
                    }

                    console.log("Services initialized with user settings")
                  })
                  .catch((err) => {
                    console.error("Failed to initialize services:", err)
                  })

                const welcomeMessage = userResponse.data.nickname
                  ? `Welcome back, ${userResponse.data.nickname}!`
                  : "Welcome back!"
                toast.success(welcomeMessage)
              } else {
                toast.success("Welcome back!")
              }
            } catch (userErr) {
              console.error("Error fetching user data:", userErr)
              toast.success("Welcome back!")
            }
          }
          setIsAuthenticated(true)
          return response
        } else {
          throw new Error(response.error || "Login failed")
        }
      } catch (err) {
        const errorMessage = err.error || err.message || "Login failed"
        setError(errorMessage)
        toast.error(errorMessage)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [scheduleTokenRefresh],
  )

  const getCurrentUser = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiService.get("/auth/me")
      if (response.success) {
        validateAndSetUser(response.data)
        setIsAuthenticated(true)
        // Initialize services
        Promise.all([import("../services/notificationService.jsx"), import("../services/socketService.jsx")])
          .then(([notificationModule, socketModule]) => {
            const notificationService = notificationModule.default
            const socketService = socketModule.default

            // Initialize notification service
            if (response.data.settings?.notifications) {
              notificationService.initialize(response.data.settings)
            } else {
              notificationService.initialize()
            }

            // Update socket service with privacy settings
            if (response.data.settings?.privacy) {
              socketService.updatePrivacySettings(response.data.settings.privacy)
            }

            console.log("Services initialized with user settings")
          })
          .catch((err) => {
            console.error("Failed to initialize services:", err)
          })

        return response.data
      } else {
        throw new Error(response.error || "Failed to get user profile")
      }
    } catch (err) {
      console.error("Get current user error:", err)
      setUser(null)
      setIsAuthenticated(false)
      return null
    } finally {
      setLoading(false)
      setAuthChecked(true)
      initialLoadCompletedRef.current = true
    }
  }, [])

  // Reactive authentication logic has been improved for better reliability
  useEffect(() => {
    // Safety timeout to prevent infinite loading
    if (authCheckTimeoutRef.current) {
      clearTimeout(authCheckTimeoutRef.current)
    }

    authCheckTimeoutRef.current = setTimeout(() => {
      if (loading) {
        console.warn("Auth check timeout - forcing loading state to false")
        setLoading(false)
        setAuthChecked(true)
        initialLoadCompletedRef.current = true
        
        // Try to recover with default user state
        const token = localStorage.getItem("token")
        if (token) {
          // If we have a token but auth timed out, try to continue with minimal auth
          // This allows the app to function with basic auth until a proper refresh happens
          console.info("Auth recovery: Setting minimal authenticated state based on token")
          setIsAuthenticated(true)
        }
      }
    }, 8000) // Reduced to 8-second timeout for faster recovery

    const checkAuth = async () => {
      try {
        setAuthChecked(false)

        const token = localStorage.getItem("token")
        if (!token) {
          setIsAuthenticated(false)
          setUser(null)
          setAuthChecked(true)
          setLoading(false)
          initialLoadCompletedRef.current = true
          clearTimeout(authCheckTimeoutRef.current)
          return
        }

        const response = await apiService.get("/auth/me")
        if (response.success && response.data) {
          validateAndSetUser(response.data)
          setIsAuthenticated(true)
        } else {
          // Try to refresh token
          const refreshed = await checkAndRefreshToken()
          if (!refreshed) {
            setIsAuthenticated(false)
            setUser(null)
            removeToken()
          }
        }
      } catch (err) {
        console.error("Auth check error:", err)
        setIsAuthenticated(false)
        setUser(null)
        removeToken()
      } finally {
        setAuthChecked(true)
        setLoading(false)
        initialLoadCompletedRef.current = true
        clearTimeout(authCheckTimeoutRef.current)
      }
    }

    // Only run the check if it hasn't been completed before
    if (!initialLoadCompletedRef.current) {
      checkAuth()
    }

    // Clean up timeout on unmount
    return () => {
      if (authCheckTimeoutRef.current) {
        clearTimeout(authCheckTimeoutRef.current)
        authCheckTimeoutRef.current = null
      }
    }
  }, [getCurrentUser, refreshToken, checkAndRefreshToken])

  // Clean up token refresh timer on unmount
  useEffect(() => {
    return () => {
      if (tokenRefreshTimerRef.current) {
        clearTimeout(tokenRefreshTimerRef.current)
      }
    }
  }, [])

  // Listen for auth logout events from other parts of the app
  useEffect(() => {
    const handleLogout = () => {
      if (tokenRefreshTimerRef.current) {
        clearTimeout(tokenRefreshTimerRef.current)
        tokenRefreshTimerRef.current = null
      }
      setUser(null)
      setIsAuthenticated(false)
      removeToken()
    }
    window.addEventListener("authLogout", handleLogout)
    return () => {
      window.removeEventListener("authLogout", handleLogout)
    }
  }, [])

  const value = {
    user,
    loading,
    error,
    isAuthenticated,
    authChecked,
    register,
    login,
    logout,
    refreshToken,
    getCurrentUser,
    clearError,
    fixUserIdFormat, // Add the user ID fix function to the context value
    token: getToken(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext
