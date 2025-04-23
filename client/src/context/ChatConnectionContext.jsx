"use client"

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
} from "react"
import { useAuth } from "./AuthContext"
import socketService from "../services/socketService"
import { logger } from "../utils/logger"

const log = logger.create("ChatConnectionContext")

// Context
const ChatConnectionContext = createContext()

// Reducer actions
const ACTIONS = {
  RESET:      "RESET",
  CONNECTING: "CONNECTING",
  CONNECTED:  "CONNECTED",
  DISCONNECTED: "DISCONNECTED",
  ERROR:      "ERROR",
  ATTEMPT:    "ATTEMPT",
}

// Initial state
const initialState = {
  connected: false,
  connecting: false,
  error: null,
  attempts: 0,
}

// Reducer
function reducer(state, { type, payload }) {
  switch (type) {
    case ACTIONS.RESET:
      return { ...initialState }
    case ACTIONS.CONNECTING:
      return { ...state, connecting: true, error: null }
    case ACTIONS.CONNECTED:
      return { ...state, connected: true, connecting: false, error: null, attempts: 0 }
    case ACTIONS.DISCONNECTED:
      return { ...state, connected: false, connecting: false }
    case ACTIONS.ERROR:
      return { ...state, connecting: false, error: payload }
    case ACTIONS.ATTEMPT:
      return { ...state, attempts: state.attempts + 1 }
    default:
      return state
  }
}

// Helper: extract valid ObjectId string
function extractUserId(user, token) {
  const isValid = id => typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id)
  let id = user?.id

  if (isValid(id)) return id
  if (typeof id === "object" && id?.toString) {
    const s = id.toString().match(/([0-9a-fA-F]{24})/)
    if (s) return s[1]
  }

  // fallback to token
  try {
    const tk = token || sessionStorage.token || localStorage.token
    if (tk) {
      const pl = JSON.parse(atob(tk.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))
      const candidate = pl.id || pl.sub || pl.user?.id
      if (isValid(candidate)) return candidate
    }
  } catch {}

  // dev fallback
  if (process.env.NODE_ENV === "development") {
    return "5f50c31f72c5e315b4b3e1c5"
  }

  return null
}

export function ChatConnectionProvider({ children }) {
  const { user, isAuthenticated, token } = useAuth()
  const [state, dispatch] = useReducer(reducer, initialState)
  const reconnectRef = useRef(null)

  // Initialize socket
  const initializeSocket = useCallback(() => {
    if (!isAuthenticated) {
      dispatch({ type: ACTIONS.RESET })
      return
    }

    const userId = extractUserId(user, token)
    if (!userId) {
      dispatch({ type: ACTIONS.ERROR, payload: "Invalid user ID" })
      return
    }

    const authToken = token || sessionStorage.token || localStorage.token
    if (!authToken) {
      dispatch({ type: ACTIONS.ERROR, payload: "Missing auth token" })
      return
    }

    if (socketService.isConnected()) {
      dispatch({ type: ACTIONS.CONNECTED })
      return
    }

    dispatch({ type: ACTIONS.CONNECTING })
    socketService.init(userId, authToken)

    // Handlers
    const onConnect = () => dispatch({ type: ACTIONS.CONNECTED })
    const onDisconnect = reason => {
      dispatch({ type: ACTIONS.DISCONNECTED })
      log.warn("Socket disconnected:", reason)
    }
    const onError = err => dispatch({ type: ACTIONS.ERROR, payload: err.message || "Socket error" })
    const onConnectError = err => {
      dispatch({ type: ACTIONS.ATTEMPT })
      const msg = err.message || "Connection error"
      if (state.attempts > 2) dispatch({ type: ACTIONS.ERROR, payload: msg })
      log.error("connect_error:", msg)
    }

    // Register listeners
    const subs = [
      socketService.on("connect", onConnect),
      socketService.on("disconnect", onDisconnect),
      socketService.on("error", onError),
      socketService.on("connect_error", onConnectError),
    ]

    // Auto-reconnect logic
    reconnectRef.current = setInterval(() => {
      if (!socketService.isConnected() && state.attempts < 5) {
        dispatch({ type: ACTIONS.ATTEMPT })
        socketService.reconnect()
      }
    }, 30_000)

    return () => {
      subs.forEach(sub => sub())
      clearInterval(reconnectRef.current)
    }
  }, [isAuthenticated, user, token, state.attempts])

  // On auth change
  useEffect(() => {
    const cleanup = initializeSocket()
    return () => {
      cleanup && cleanup()
    }
  }, [initializeSocket])

  // Reconnect on page become visible
  useEffect(() => {
    const onVis = () => {
      if (!document.hidden && isAuthenticated && !socketService.isConnected()) {
        socketService.reconnect()
      }
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [isAuthenticated])

  const value = {
    ...state,
    initializeSocket,
  }

  return (
    <ChatConnectionContext.Provider value={value}>
      {children}
    </ChatConnectionContext.Provider>
  )
}

export const useChatConnection = () => {
  const ctx = useContext(ChatConnectionContext)
  if (!ctx) throw new Error("useChatConnection must be used within ChatConnectionProvider")
  return ctx
}

export default ChatConnectionContext
