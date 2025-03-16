"use client"

import { createContext, useState, useContext, useEffect, useCallback, useRef } from "react"
import { toast } from "react-toastify"
import apiService from "../services/apiService"
import { getToken, setToken, removeToken, isTokenExpired } from "../utils/tokenStorage"

const AuthContext = createContext()

export const useAuth = () => useContext(AuthContext)

// Authentication-specific API calls
export const authApiService = {
  register: async (userData) => {
    try {
      return await apiService.post("/auth/register", userData)
    } catch (err) {
      throw err
    }
  },

  login: async (credentials) => {
    try {
      return await apiService.post("/auth/login", credentials)
    } catch (err) {
      throw err
    }
  },

  logout: async () => {
    try {
      return await apiService.post("/auth/logout")
    } catch (err) {
      throw err
    }
  },

  verifyEmail: async (token) => {
    try {
      return await apiService.post("/auth/verify-email", { token })
    } catch (err) {
      throw err
    }
  },

  requestPasswordReset: async (email) => {
    try {
      return await apiService.post("/auth/forgot-password", { email })
    } catch (err) {
      throw err
    }
  },

  resetPassword: async (token, password) => {
    try {
      return await apiService.post("/auth/reset-password", { token, password })
    } catch (err) {
      throw err
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    try {
      return await apiService.post("/auth/change-password", { currentPassword, newPassword })
    } catch (err) {
      throw err
    }
  },

  getCurrentUser: async () => {
    try {
      return await apiService.get("/auth/me")
    } catch (err) {
      throw err
    }
  },

  refreshToken: async (token) => {
    try {
      return await apiService.post("/auth/refresh-token", { token })
    } catch (err) {
      throw err
    }
  },
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  // Use refs for the refresh token promise and timer
  const refreshTokenPromiseRef = useRef(null)
  const tokenRefreshTimerRef = useRef(null)

  // Clear any error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Logout is used in refreshToken; declare it first
  const logout = useCallback(async () => {
    setLoading(true)
    try {
      // Clear any scheduled token refresh timer
      if (tokenRefreshTimerRef.current) {
        clearTimeout(tokenRefreshTimerRef.current)
        tokenRefreshTimerRef.current = null
      }
      // Attempt to notify server (continue even if it fails)
      try {
        await authApiService.logout()
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

  // Schedule token refresh based on token expiry
  const scheduleTokenRefresh = useCallback((token) => {
    if (tokenRefreshTimerRef.current) {
      clearTimeout(tokenRefreshTimerRef.current)
      tokenRefreshTimerRef.current = null
    }
    try {
      // Decode token to extract expiry
      const base64Url = token.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const payload = JSON.parse(atob(base64))

      if (payload.exp) {
        const expiresAt = payload.exp * 1000 // convert to milliseconds
        const now = Date.now()
        const timeUntilRefresh = expiresAt - now - (5 * 60 * 1000) // refresh 5 minutes before expiry

        if (timeUntilRefresh > 60000) { // schedule only if more than 1 minute remains
          console.log(`Scheduling token refresh in ${Math.round(timeUntilRefresh / 60000)} minutes`)
          const timer = setTimeout(() => {
            refreshToken()
          }, timeUntilRefresh)
          tokenRefreshTimerRef.current = timer
        } else {
          console.log('Token expires soon, refreshing now')
          refreshToken()
        }
      }
    } catch (e) {
      console.error('Error scheduling token refresh:', e)
    }
  }, [])

  // Refresh the auth token with proper race condition handling
  const refreshToken = useCallback(() => {
    if (!isAuthenticated) return Promise.resolve(null)

    // Return cached promise if refresh is already in progress
    if (refreshTokenPromiseRef.current) {
      return refreshTokenPromiseRef.current
    }

    refreshTokenPromiseRef.current = (async () => {
      const token = getToken()
      if (!token) return null

      try {
        console.log("Refreshing auth token...")
        const response = await authApiService.refreshToken(token)

        if (response.success && response.token) {
          const newToken = response.token
          // Preserve "remember me" setting by checking localStorage
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
        // Clear the promise so future attempts can be made
        refreshTokenPromiseRef.current = null

        // If error indicates unauthorized or token expired, log out
        if (err?.response?.status === 401) {
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
        // Clear the promise after a delay to avoid immediate retry storms
        setTimeout(() => {
          refreshTokenPromiseRef.current = null
        }, 1000)
      }
    })()

    return refreshTokenPromiseRef.current
  }, [isAuthenticated, logout, scheduleTokenRefresh])

  // Register a new user
  const register = useCallback(async (userData) => {
    setLoading(true)
    setError(null)
    try {
      const response = await authApiService.register(userData)
      if (response.success) {
        toast.success("Registration successful! Please check your email to verify your account.")
        return response
      } else {
        throw new Error(response.error || "Registration failed")
      }
    } catch (err) {
      const errorMessage = err.error || err.message || "Registration failed"
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // Verify email with token
  const verifyEmail = useCallback(async (token) => {
    setLoading(true)
    setError(null)
    try {
      const response = await authApiService.verifyEmail(token)
      if (response.success) {
        toast.success("Email verified successfully! You can now log in.")
        return response
      } else {
        throw new Error(response.error || "Email verification failed")
      }
    } catch (err) {
      const errorMessage = err.error || err.message || "Email verification failed"
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // Log in a user
  const login = useCallback(async (credentials, rememberMe = false) => {
    setLoading(true)
    setError(null)
    try {
      const response = await authApiService.login(credentials)
      if (response.success && response.token) {
        setToken(response.token, rememberMe)
        scheduleTokenRefresh(response.token)

        if (response.user) {
          setUser(response.user)
          const welcomeMessage = response.user.nickname ? `Welcome back, ${response.user.nickname}!` : "Welcome back!"
          toast.success(welcomeMessage)
        } else {
          try {
            const userResponse = await authApiService.getCurrentUser()
            if (userResponse.success && userResponse.data) {
              setUser(userResponse.data)
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
  }, [scheduleTokenRefresh])

  // Request password reset
  const requestPasswordReset = useCallback(async (email) => {
    setLoading(true)
    setError(null)
    try {
      const response = await authApiService.requestPasswordReset(email)
      if (response.success) {
        toast.success("Password reset instructions sent to your email")
        return response
      } else {
        throw new Error(response.error || "Password reset request failed")
      }
    } catch (err) {
      const errorMessage = err.error || err.message || "Password reset request failed"
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // Reset password with token
  const resetPassword = useCallback(async (token, newPassword) => {
    setLoading(true)
    setError(null)
    try {
      const response = await authApiService.resetPassword(token, newPassword)
      if (response.success) {
        toast.success("Password reset successful! You can now log in with your new password.")
        return response
      } else {
        throw new Error(response.error || "Password reset failed")
      }
    } catch (err) {
      const errorMessage = err.error || err.message || "Password reset failed"
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // Change password (when logged in)
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    setLoading(true)
    setError(null)
    try {
      const response = await authApiService.changePassword(currentPassword, newPassword)
      if (response.success) {
        toast.success("Password changed successfully!")
        return response
      } else {
        throw new Error(response.error || "Password change failed")
      }
    } catch (err) {
      const errorMessage = err.error || err.message || "Password change failed"
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // Get current user profile
  const getCurrentUser = useCallback(async () => {
    setLoading(true)
    try {
      const response = await authApiService.getCurrentUser()
      if (response.success) {
        setUser(response.data)
        setIsAuthenticated(true)
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
    }
  }, [])

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = getToken()
      if (token) {
        try {
          if (isTokenExpired(token)) {
            console.log("Token expired, attempting to refresh")
            const newToken = await refreshToken()
            if (!newToken) {
              setUser(null)
              setIsAuthenticated(false)
              removeToken()
              setAuthChecked(true)
              return
            }
          }
          await getCurrentUser()
        } catch (err) {
          console.error("Auth check error:", err)
          setUser(null)
          setIsAuthenticated(false)
          removeToken()
          setAuthChecked(true)
        }
      } else {
        setUser(null)
        setIsAuthenticated(false)
        setAuthChecked(true)
      }
    }

    checkAuth()
  }, [getCurrentUser, refreshToken])

  // Clean up token refresh timer on unmount
  useEffect(() => {
    return () => {
      if (tokenRefreshTimerRef.current) {
        clearTimeout(tokenRefreshTimerRef.current)
      }
    }
  }, [])

  // Listen for auth logout events (e.g., from other parts of the app)
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
    verifyEmail,
    login,
    logout,
    refreshToken,
    requestPasswordReset,
    resetPassword,
    changePassword,
    getCurrentUser,
    clearError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext
