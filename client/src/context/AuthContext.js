"use client"

// Upgraded AuthContext.js with improved token handling and security
import { createContext, useState, useContext, useEffect, useCallback } from "react"
import { toast } from "react-toastify"
import apiService from "../services/apiService"
import { getToken, setToken, removeToken } from "../utils/tokenStorage"

const AuthContext = createContext()

export const useAuth = () => useContext(AuthContext)

// Create and export the authApiService for authentication-specific API calls
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

  // Clear any error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

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
        setUser(response.user)
        setIsAuthenticated(true)
        toast.success(`Welcome back, ${response.user.nickname}!`)
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
  }, [])

  // Log out a user
  const logout = useCallback(async () => {
    setLoading(true)
    try {
      await authApiService.logout()
      removeToken()
      setUser(null)
      setIsAuthenticated(false)
      toast.info("You have been logged out")
    } catch (err) {
      console.error("Logout error:", err)
      // Still remove token and user data even if API call fails
      removeToken()
      setUser(null)
      setIsAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }, [])

  // Refresh the auth token
  const refreshToken = useCallback(async () => {
    try {
      const token = getToken()
      if (!token) return null

      const response = await authApiService.refreshToken(token)
      if (response.success && response.token) {
        setToken(response.token, localStorage.getItem("token") !== null)
        return response.token
      }
      return null
    } catch (err) {
      console.error("Token refresh error:", err)
      return null
    }
  }, [])

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
          await getCurrentUser()
        } catch (err) {
          console.error("Auth check error:", err)
          // If token is invalid or expired, try to refresh it
          const newToken = await refreshToken()
          if (newToken) {
            await getCurrentUser()
          } else {
            setUser(null)
            setIsAuthenticated(false)
            removeToken()
          }
        } finally {
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

  // Listen for auth logout events (e.g., from API service)
  useEffect(() => {
    const handleLogout = () => {
      setUser(null)
      setIsAuthenticated(false)
      removeToken()
    }

    window.addEventListener("authLogout", handleLogout)
    return () => {
      window.removeEventListener("authLogout", handleLogout)
    }
  }, [])

  // Context value
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
