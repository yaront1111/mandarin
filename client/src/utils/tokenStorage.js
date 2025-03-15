// client/src/utils/tokenStorage.js
/**
 * Token storage utility to standardize token handling across the application
 */
const tokenStorage = {
  /**
   * Store token with optional "remember me" functionality
   * @param {string} token - JWT token
   * @param {boolean} rememberMe - Whether to persist token in localStorage
   */
  setToken: (token, rememberMe = false) => {
    if (!token) return

    // Always store in sessionStorage for current session
    sessionStorage.setItem("token", token)

    // Optionally store in localStorage for persistence
    if (rememberMe) {
      localStorage.setItem("token", token)
    } else {
      localStorage.removeItem("token")
    }
  },

  /**
   * Get stored token
   * @returns {string|null} - Retrieved token or null if not found
   */
  getToken: () => {
    // First try sessionStorage (current session)
    let token = sessionStorage.getItem("token")

    // If not found, try localStorage (remembered session)
    if (!token) {
      token = localStorage.getItem("token")
      // If found in localStorage, also set in sessionStorage
      if (token) {
        sessionStorage.setItem("token", token)
      }
    }

    return token
  },

  /**
   * Remove token from all storage
   */
  removeToken: () => {
    sessionStorage.removeItem("token")
    localStorage.removeItem("token")
  },

  /**
   * Check if token is available
   * @returns {boolean} - True if token exists
   */
  hasToken: () => {
    return !!tokenStorage.getToken()
  },

  /**
   * Parse token payload without verification
   * @param {string} token - JWT token
   * @returns {object|null} - Decoded payload or null if invalid
   */
  parseToken: (token) => {
    if (!token) return null
    try {
      const base64Url = token.split(".")[1]
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
      const payload = JSON.parse(window.atob(base64))
      return payload
    } catch (error) {
      console.warn("Error parsing token:", error)
      return null
    }
  },

  /**
   * Check if token is expired (with 30-second buffer)
   * @param {string} token - JWT token to check
   * @returns {boolean} - True if token is expired or invalid
   */
  isTokenExpired: (token) => {
    const payload = tokenStorage.parseToken(token)
    if (!payload || !payload.exp) return true

    // Add 30-second buffer to account for clock differences
    const now = Math.floor(Date.now() / 1000) + 30
    return payload.exp < now
  },

  /**
   * Get time remaining before token expiry in seconds
   * @param {string} token - JWT token
   * @returns {number} - Seconds until expiry, 0 if expired or invalid
   */
  getExpiryTime: (token) => {
    const payload = tokenStorage.parseToken(token)
    if (!payload || !payload.exp) return 0

    const now = Math.floor(Date.now() / 1000)
    const timeLeft = payload.exp - now

    return timeLeft > 0 ? timeLeft : 0
  },

  /**
   * Get user ID from token
   * @returns {string|null} - User ID from token or null if not available
   */
  getUserId: () => {
    const token = tokenStorage.getToken()
    if (!token) return null

    const payload = tokenStorage.parseToken(token)
    return payload && payload.id ? payload.id : null
  },
}

export const getToken = tokenStorage.getToken
export const setToken = tokenStorage.setToken
export const removeToken = tokenStorage.removeToken

export default tokenStorage
