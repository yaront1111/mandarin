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
  // Enhanced user validation and cleanup with better error handling
  const validateAndSetUser = (userData) => {
    if (!userData) {
      log.warn("Received null or undefined user data");
      setUser(null);
      return;
    }

    // Make a clean copy of the user data
    const cleanUserData = { ...userData };
    
    // Set a default ID if missing - FOR TEST ENVIRONMENTS ONLY!
    if (!cleanUserData._id && process.env.NODE_ENV === "development") {
      log.warn("Development mode: Setting default user ID since none was provided");
      cleanUserData._id = "5f50c31f72c5e315b4b3e1c5"; // Fake but valid MongoDB ObjectId
    }

    // If ID exists but isn't a string, convert it to string
    if (cleanUserData._id && typeof cleanUserData._id !== "string") {
      log.warn(`Converting non-string ID to string: ${typeof cleanUserData._id} -> string`);
      try {
        cleanUserData._id = cleanUserData._id.toString();
      } catch (err) {
        log.error(`Failed to convert user._id to string: ${err.message}`);
        // Continue with the ID we have - we'll validate it next
      }
    }

    // Check if the user has a valid MongoDB ObjectId (24 hex chars)
    const hasValidId = cleanUserData._id && /^[0-9a-fA-F]{24}$/.test(cleanUserData._id);
    
    if (!hasValidId) {
      log.warn(`User data has invalid ID format: "${cleanUserData._id}"`);
      log.debug(`ID type: ${typeof cleanUserData._id}, Length: ${cleanUserData._id?.length || 0}`);

      // If we're in development, still set the user but warn
      if (process.env.NODE_ENV === "development") {
        log.info("Development mode: Continuing with invalid user ID format");
        
        // If we have a token but invalid ID, ensure we at least have a functional ID
        // This prevents socket and other services from failing
        if (!hasValidId && localStorage.getItem("token")) {
          cleanUserData._id = "5f50c31f72c5e315b4b3e1c5"; // Fake but valid MongoDB ObjectId
          log.info(`Assigned temporary valid ID: ${cleanUserData._id}`);
        }
        
        setUser(cleanUserData);
      } else {
        // In production, reject invalid IDs
        toast.error("Authentication error: Your user profile has an invalid format. Please try logging in again.");
        setUser(null);
        setIsAuthenticated(false);
        removeToken();
        return;
      }
    } else {
      // Valid ID, set the user
      log.debug(`User has valid ID: ${cleanUserData._id}`);
      setUser(cleanUserData);
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

  // Force convert the user ID to a proper MongoDB ObjectId string format
  // This is a direct fix for corrupted user IDs in the client
  const fixUserIdFormat = useCallback(async () => {
    if (!user || !user._id) {
      console.error("Cannot fix user ID: No user or user ID available")
      return false
    }

    // Import the ensureValidObjectId utility dynamically to avoid circular dependencies
    const { ensureValidObjectId } = await import("../utils/index.js")

    // Use our specialized utility to ensure we have a valid ObjectId
    const validObjectId = ensureValidObjectId(user._id)

    if (validObjectId) {
      if (validObjectId === user._id) {
        log.debug("User ID is already in valid format:", validObjectId)
        return true
      }

      // Create a new user object with the fixed ID
      const fixedUser = {
        ...user,
        _id: validObjectId,
      }

      // Update the user state
      setUser(fixedUser)
      log.info(`User ID fixed to: ${validObjectId} (was: ${user._id})`)
      return true
    }

    // If we can't fix it, log the issue
    log.error(`Cannot fix user ID format: ${user._id}`)
    return false
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
        console.log("Refreshing auth token...")

        // Use apiService directly to bypass interceptors
        const response = await apiService.post(
          "/auth/refresh-token",
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
          console.log("Token refreshed successfully")
          return newToken
        } else {
          throw new Error("Invalid refresh response")
        }
      } catch (err) {
        console.error("Token refresh failed:", err)
        refreshTokenPromiseRef.current = null

        if (err?.response?.status === 401 || err?.status === 401) {
          logout()
        } else {
          const currentToken = getToken()
          if (currentToken && isTokenExpired(currentToken)) {
            console.log("Token expired, logging out")
            toast.error("Your session has expired. Please log in again.")
            logout()
          }
        }
        return null
      } finally {
        setTimeout(() => {
          refreshTokenPromiseRef.current = null
        }, 1000)
      }
    })()

    return refreshTokenPromiseRef.current
  }, [isAuthenticated, logout, scheduleTokenRefresh])

  const register = useCallback(
    async (userData) => {
      setLoading(true)
      setError(null)

      try {
        const response = await apiService.post("/auth/register", userData)

        if (response.success) {
          if (response.token) {
            setToken(response.token, false) // Don't use remember me by default for new registrations
            validateAndSetUser(response.user)
            setIsAuthenticated(true)

            // Schedule refresh if token exists
            scheduleTokenRefresh(response.token)
          }
          setLoading(false)
          return true
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
          const errorMessage = err.message || "Network error. Please check your connection and try again."
          setError(errorMessage)
          throw new Error(errorMessage)
        }
      } finally {
        setLoading(false)
      }
    },
    [scheduleTokenRefresh],
  )

  // Add this function to check and refresh the token
  const checkAndRefreshToken = useCallback(async () => {
    try {
      const token = localStorage.getItem("token")
      if (!token) return false

      // Check if token is valid
      const response = await apiService.get("/auth/verify")
      if (response.success) {
        return true
      }

      // If not valid, try to refresh
      const refreshResponse = await apiService.post("/auth/refresh")
      if (refreshResponse.success && refreshResponse.data?.token) {
        localStorage.setItem("token", refreshResponse.data.token)
        return true
      }

      // If refresh fails, clear auth state
      logout()
      return false
    } catch (err) {
      console.error("Token refresh error:", err)
      return false
    }
  }, [logout])

  const login = useCallback(
    async (credentials, rememberMe = false) => {
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
