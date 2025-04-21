"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react"
import { toast } from "react-toastify"
import isMongoId from "validator/lib/isMongoId"
import apiService from "../services/apiService"
import {
  getToken,
  setToken,
  removeToken,
  isTokenExpired,
  getUserIdFromToken,
} from "../utils/tokenStorage"
import { logger } from "../utils/logger"

const log = logger.create("AuthContext")
const AuthContext = createContext()

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

export function AuthProvider({ children }) {
  // state
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  // refs
  const refreshPromiseRef = useRef(null)
  const refreshTimerRef = useRef(null)
  const authTimeoutRef = useRef(null)
  const initializedRef = useRef(false)

  // helpers

  const clearError = useCallback(() => setError(null), [])

  const normalizeUser = useCallback(async raw => {
    if (!raw) return null

    let u = { ...raw }
    // ensure _id/id
    if (!u._id && u.id) u._id = u.id
    if (!u.id && u._id) u.id = u._id

    // validate or fix via token
    const valid = id => typeof id==="string" && isMongoId(id)
    if (!valid(u._id)) {
      try {
        const token = getToken()
        if (token) {
          const tid = getUserIdFromToken(token)
          if (valid(tid)) u._id = u.id = tid
        }
      } catch(e){ log.error("normalizeUser.token", e) }
      if (!valid(u._id) && process.env.NODE_ENV==="development") {
        u._id = u.id = "5f50c31f72c5e315b4b3e1c5"
      }
    }

    if (!valid(u._id)) {
      log.error("Invalid user ID:", u._id)
      if (process.env.NODE_ENV==="production") {
        toast.error("Auth error: invalid profile, please log in again.")
        removeToken()
        return null
      }
    }

    return u
  }, [])

  const initServices = useCallback(u => {
    import("../services/notificationService")
      .then(m => m.default.initialize(u.settings?.notifications))
      .catch(() => {})
    import("../services/socketService")
      .then(m => m.default.updatePrivacySettings(u.settings?.privacy))
      .catch(() => {})
  }, [])

  const scheduleRefresh = useCallback(token => {
    clearTimeout(refreshTimerRef.current)
    try {
      const payload = JSON.parse(atob(token.split(".")[1]
        .replace(/-/g,"+").replace(/_/g,"/")))
      const expires = payload.exp * 1000
      const delay = expires - Date.now() - 5 * 60_000
      if (delay > 60_000) {
        refreshTimerRef.current = setTimeout(() => refreshToken(), delay)
      } else {
        refreshToken()
      }
    } catch(e){ log.error("scheduleRefresh", e) }
  }, [])

  // core token refresh
  const refreshToken = useCallback(() => {
    if (!isAuthenticated && !getToken()) return Promise.resolve(null)
    if (refreshPromiseRef.current) return refreshPromiseRef.current

    refreshPromiseRef.current = (async () => {
      const old = getToken()
      if (!old) return null
      try {
        log.info("Refreshing token…")
        const res = await apiService.post(
          "/auth/refresh-token",
          { token: old },
          { headers: { "x-no-cache": "true" }, _isRefreshRequest: true }
        )
        if (!res.success || !res.token) throw new Error("Bad refresh")
        setToken(res.token, !!localStorage.getItem("token"))
        scheduleRefresh(res.token)

        // maybe update user ID
        const tid = getUserIdFromToken(res.token)
        if (user && tid && tid!==user._id) {
          setUser(prev => ({ ...prev, _id: tid, id: tid }))
        }
        log.info("Token refreshed")
        return res.token
      } catch (err) {
        log.error("refreshToken", err)
        refreshPromiseRef.current = null
        if (err?.response?.status === 401 || isTokenExpired(getToken())) {
          logout()
        }
        return null
      } finally {
        setTimeout(() => (refreshPromiseRef.current = null), 1000)
      }
    })()

    return refreshPromiseRef.current
  }, [isAuthenticated, scheduleRefresh, user])

  // register
  const register = useCallback(async data => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiService.post("/auth/register", data)
      if (!res.success) throw res
      setToken(res.token, true)
      scheduleRefresh(res.token)
      const u = await normalizeUser(res.user)
      if (u) {
        setUser(u)
        setIsAuthenticated(true)
        initServices(u)
      }
      // grab full profile
      const me = await apiService.get("/auth/me")
      if (me.success) {
        const u2 = await normalizeUser(me.data)
        if (u2) setUser(u2)
      }
      return res
    } catch (err) {
      log.error("register", err)
      const msg =
        err.error ||
        (err.response?.data?.error) ||
        "Registration failed"
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }, [normalizeUser, scheduleRefresh, initServices])

  // login
  const login = useCallback(async (creds, remember=true) => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiService.post("/auth/login", creds)
      if (!res.success || !res.token) throw res
      setToken(res.token, remember)
      scheduleRefresh(res.token)
      const u = res.user
        ? await normalizeUser(res.user)
        : await (async () => {
            const me = await apiService.get("/auth/me")
            return me.success ? normalizeUser(me.data) : null
          })()
      if (u) {
        setUser(u)
        setIsAuthenticated(true)
        initServices(u)
      }
      toast.success(u?.nickname
        ? `Welcome back, ${u.nickname}!`
        : "Welcome back!")
      return res
    } catch (err) {
      log.error("login", err)
      const msg = err.error || err.message || "Login failed"
      setError(msg)
      toast.error(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [normalizeUser, scheduleRefresh, initServices])

  // logout
  const logout = useCallback(async () => {
    setLoading(true)
    try {
      clearTimeout(refreshTimerRef.current)
      await apiService.logout().catch(() => {})
      removeToken()
      setUser(null)
      setIsAuthenticated(false)
      toast.info("Logged out")
    } catch (e) {
      log.error("logout", e)
      removeToken()
      setUser(null)
      setIsAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }, [])

  // verify or refresh
  const checkAndRefresh = useCallback(async () => {
    try {
      const tok = getToken()
      if (!tok) return false
      if (isTokenExpired(tok)) {
        return !!(await refreshToken())
      }
      const res = await apiService.get("/auth/verify")
      if (res.success) return true
      return !!(await refreshToken())
    } catch (e) {
      log.error("checkAndRefresh", e)
      return false
    }
  }, [refreshToken])

  // getCurrentUser
  const getCurrentUser = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiService.get("/auth/me")
      if (!res.success) throw res
      const u = await normalizeUser(res.data)
      if (u) {
        setUser(u)
        setIsAuthenticated(true)
        initServices(u)
        return u
      }
      return null
    } catch (err) {
      log.error("getCurrentUser", err)
      setUser(null)
      setIsAuthenticated(false)
      return null
    } finally {
      setLoading(false)
      setAuthChecked(true)
      initializedRef.current = true
    }
  }, [normalizeUser, initServices])

  // resend verification
  const resendVerificationEmail = useCallback(async () => {
    try {
      const res = await apiService.post("/auth/resend-verification")
      if (res.success) {
        toast.success("Verification email sent.")
        return true
      }
      toast.error(res.error || "Failed to send verification")
      return false
    } catch (e) {
      log.error("resendVerificationEmail", e)
      if (e.response?.status === 429) {
        toast.error("Too many requests, please wait.")
      } else {
        toast.error("Failed to send verification.")
      }
      return false
    }
  }, [])

  // initial auth check
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    // safety timeout
    authTimeoutRef.current = setTimeout(() => {
      if (loading) {
        log.warn("Auth check timeout")
        setLoading(false)
        setAuthChecked(true)
        if (getToken()) setIsAuthenticated(true)
      }
    }, 8000)

    ;(async () => {
      const tok = getToken()
      if (!tok) {
        setIsAuthenticated(false)
        setUser(null)
      } else {
        const ok = await checkAndRefresh()
        if (ok) {
          await getCurrentUser()
        } else {
          removeToken()
          setUser(null)
          setIsAuthenticated(false)
        }
      }
      clearTimeout(authTimeoutRef.current)
      setAuthChecked(true)
      setLoading(false)
    })()

    return () => clearTimeout(authTimeoutRef.current)
  }, [checkAndRefresh, getCurrentUser])

  // cleanup on unmount
  useEffect(() => () => clearTimeout(refreshTimerRef.current), [])

  // expose
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
    fixUserIdFormat: normalizeUser,
    token: getToken(),
    resendVerificationEmail,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext
