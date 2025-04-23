"use client"

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react"
import { useAuth } from "./AuthContext"
import notificationService from "../services/notificationService"
import socketService from "../services/socketService"
import { toast } from "react-toastify"
import { useNavigate } from "react-router-dom"
import { FaHeart } from "react-icons/fa"
import debounce from "lodash.debounce"
import logger from "../utils/logger"

const log = logger.create("NotificationContext")

const NotificationContext = createContext()

const initialState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  socketConnected: false,
}

function reducer(state, { type, payload }) {
  switch (type) {
    case "SET_LOADING":
      return { ...state, loading: payload }
    case "SET_NOTIFICATIONS":
      return {
        ...state,
        notifications: payload,
        unreadCount: payload.filter(n => !n.read).length,
      }
    case "ADD_NOTIFICATION":
      if (state.notifications.some(n => (n.id || n.id) === (payload.id || payload.id))) {
        return state
      }
      return {
        ...state,
        notifications: [payload, ...state.notifications],
        unreadCount: state.unreadCount + (payload.read ? 0 : 1),
      }
    case "MARK_AS_READ":
      return {
        ...state,
        notifications: state.notifications.map(n =>
          (n.id || n.id) === payload ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(
          0,
          state.unreadCount -
            (state.notifications.find(n => (n.id || n.id) === payload && !n.read)
              ? 1
              : 0)
        ),
      }
    case "MARK_ALL_AS_READ":
      return {
        ...state,
        notifications: state.notifications.map(n => ({ ...n, read: true })),
        unreadCount: 0,
      }
    case "SET_SOCKET_CONNECTED":
      return { ...state, socketConnected: payload }
    default:
      return state
  }
}

export function NotificationProvider({ children, openProfileModal }) {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [state, dispatch] = useReducer(reducer, initialState)
  const pollingRef = useRef(null)

  // Fetch notifications from server
  const fetchNotifications = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true })
    try {
      const list = await notificationService.getNotifications()
      dispatch({ type: "SET_NOTIFICATIONS", payload: list })
      return list
    } catch (err) {
      log.error("fetchNotifications", err)
      return []
    } finally {
      dispatch({ type: "SET_LOADING", payload: false })
    }
  }, [])

  // Provide navigate to service
  useEffect(() => {
    notificationService.setNavigate(navigate)
  }, [navigate])

  // Initialize notification service on login/logout
  useEffect(() => {
    if (!isAuthenticated || !user) {
      dispatch({ type: "SET_NOTIFICATIONS", payload: [] })
      return
    }
    const settings = user.settings?.notifications ?? {}
    notificationService.initialize({ notifications: settings })
    fetchNotifications()
    const off = notificationService.addListener(({ notifications }) => {
      dispatch({ type: "SET_NOTIFICATIONS", payload: notifications })
    })
    return () => off()
  }, [isAuthenticated, user, fetchNotifications])

  // Handle incoming socket events
  useEffect(() => {
    if (!isAuthenticated || !socketService.socket) return

    const handleIncoming = (data, event) => {
      dispatch({ type: "ADD_NOTIFICATION", payload: data })

      if (event === "newLike") {
        toast.success(
          <div style={{ display: "flex", alignItems: "center" }}>
            <FaHeart className="pulse" />
            <span style={{ marginLeft: 8 }}>
              {data.isMatch
                ? `It's a match with ${data.sender?.nickname || "Someone"}!`
                : `${data.sender?.nickname || "Someone"} liked you`}
            </span>
          </div>,
          { autoClose: 5000 }
        )
      } else {
        toast.info(data.message || data.content || "New notification", {
          autoClose: 4000,
        })
      }
    }

    const onConnect = () => {
      dispatch({ type: "SET_SOCKET_CONNECTED", payload: true })
      fetchNotifications()
    }
    const onDisconnect = () => {
      dispatch({ type: "SET_SOCKET_CONNECTED", payload: false })
    }

    const events = [
      ["notification", d => handleIncoming(d, "notification")],
      ["newMessage", d => handleIncoming(d, "newMessage")],
      ["newLike", d => handleIncoming(d, "newLike")],
      ["photoPermissionRequestReceived", d => handleIncoming(d, "photoPermissionRequest")],
      ["photoPermissionResponseReceived", d => handleIncoming(d, "photoPermissionResponse")],
      ["newComment", d => handleIncoming(d, "newComment")],
      ["incomingCall", d => handleIncoming(d, "incomingCall")],
      ["connect", onConnect],
      ["disconnect", onDisconnect],
    ]

    events.forEach(([evt, fn]) => socketService.socket.on(evt, fn))
    dispatch({
      type: "SET_SOCKET_CONNECTED",
      payload: socketService.isConnected(),
    })

    return () => events.forEach(([evt, fn]) => socketService.socket.off(evt, fn))
  }, [isAuthenticated, fetchNotifications])

  // Poll as fallback when socket is disconnected
  useEffect(() => {
    clearInterval(pollingRef.current)
    if (isAuthenticated && !state.socketConnected) {
      pollingRef.current = setInterval(() => {
        if (!socketService.isConnected()) {
          fetchNotifications()
          socketService.reconnect?.()
        }
      }, 30_000)
    }
    return () => clearInterval(pollingRef.current)
  }, [isAuthenticated, state.socketConnected, fetchNotifications])

  // Add a test notification (for QA)
  const addTestNotification = useCallback(() => {
    const n = notificationService.addTestNotification()
    dispatch({ type: "ADD_NOTIFICATION", payload: n })
    toast.info("Test notification added")
  }, [])

  // Mark a single notification as read
  const markAsRead = useCallback(id => {
    dispatch({ type: "MARK_AS_READ", payload: id })
    notificationService.markAsRead(id)
  }, [])

  // Mark all notifications as read
  const markAllAsRead = useCallback(() => {
    dispatch({ type: "MARK_ALL_AS_READ" })
    notificationService.markAllAsRead()
  }, [])

  // Handle click on a notification
  const handleNotificationClick = useCallback(
    notification => {
      if (!notification) return
      const id = notification.id || notification.id
      if (!notification.read) markAsRead(id)

      const type = notification.type
      const data = notification.data || {}
      const senderId =
        notification.sender?.id ||
        data.sender?.id ||
        data.requester?.id ||
        data.user?.id ||
        data.owner?.id ||
        (type === "match" && data.matchedUser?.id) ||
        (type === "comment" && data.commenter?.id)

      if ((type === "message" || type === "newMessage") && senderId) {
        navigate(`/messages/${senderId}`)
      } else if (senderId && openProfileModal) {
        openProfileModal(senderId)
      }
    },
    [markAsRead, navigate, openProfileModal]
  )

  // Expose context value
  const value = useMemo(
    () => ({
      notifications: state.notifications,
      unreadCount: state.unreadCount,
      loading: state.loading,
      socketConnected: state.socketConnected,
      fetchNotifications,
      addTestNotification,
      markAsRead,
      markAllAsRead,
      handleNotificationClick,
    }),
    [
      state,
      fetchNotifications,
      addTestNotification,
      markAsRead,
      markAllAsRead,
      handleNotificationClick,
    ]
  )

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider")
  return ctx
}

export default NotificationProvider
