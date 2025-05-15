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
import { useModals } from "./ModalContext"
import notificationService from "../services/notificationService"
import socketService from "../services/socketService"
import { toast } from "react-toastify"
import { useNavigate } from "react-router-dom"
import { FaHeart, FaCheck, FaTimes, FaCamera } from "react-icons/fa"
import debounce from "lodash.debounce"
import logger from "../utils/logger"
import MemoryHelper from "../utils/simple-memory-helper"

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
      if (state.notifications.some(n => (n._id || n.id) === (payload._id || payload.id))) {
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
          (n._id || n.id) === payload ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(
          0,
          state.unreadCount -
            (state.notifications.find(n => (n._id || n.id) === payload && !n.read)
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

export function NotificationProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const { openProfileModal } = useModals()
  const navigate = useNavigate()
  const [state, dispatch] = useReducer(reducer, initialState)
  
  // Simple memory helper for cleanup
  const cleanupHelper = useRef(new MemoryHelper());
  
  // Cleanup on unmount
  useEffect(() => {
    const helper = cleanupHelper.current;
    return () => {
      helper.cleanup();
    };
  }, [])

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
    if (!isAuthenticated) return

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
      } else if (event === "photoPermissionRequest") {
        // Special handling for photo permission requests with custom styling
        toast.info(
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ 
              backgroundColor: "#3897f0", 
              borderRadius: "50%", 
              width: "28px", 
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "14px"
            }}>
              <FaCamera />
            </div>
            <span>
              {`${data.sender?.nickname || "Someone"} requested access to your private photos`}
            </span>
          </div>,
          { 
            autoClose: 6000,
            closeButton: true,
            icon: "🔒"
          }
        );
      } else if (event === "photoPermissionResponse") {
        // Special handling for photo permission responses
        const isApproved = data.data?.status === "approved";
        toast[isApproved ? "success" : "info"](
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ 
              backgroundColor: isApproved ? "#43a047" : "#757575", 
              borderRadius: "50%", 
              width: "28px", 
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "14px"
            }}>
              {isApproved ? <FaCheck /> : <FaTimes />}
            </div>
            <span>
              {data.sender?.nickname || "Someone"} {isApproved ? "approved" : "declined"} your photo request
            </span>
          </div>,
          { 
            autoClose: 6000,
            closeButton: true,
            icon: isApproved ? "🔓" : "🔒"
          }
        );
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

    // Create event handlers and unsubscribers using helper
    const helper = cleanupHelper.current;
    
    const unsubscribers = [
      helper.addSubscription('notification', socketService.on("notification", d => handleIncoming(d, "notification"))),
      helper.addSubscription('newMessage', socketService.on("newMessage", d => handleIncoming(d, "newMessage"))),
      helper.addSubscription('newLike', socketService.on("newLike", d => handleIncoming(d, "newLike"))),
      helper.addSubscription('photoPermissionRequest', socketService.on("photoPermissionRequestReceived", d => {
        log.info("Received photo permission request notification:", d);
        handleIncoming(d, "photoPermissionRequest");
      })),
      helper.addSubscription('photoPermissionResponse', socketService.on("photoPermissionResponseReceived", d => {
        log.info("Received photo permission response notification:", d);
        handleIncoming(d, "photoPermissionResponse");
      })),
      helper.addSubscription('newComment', socketService.on("newComment", d => handleIncoming(d, "newComment"))),
      helper.addSubscription('incomingCall', socketService.on("incomingCall", d => handleIncoming(d, "incomingCall"))),
      helper.addSubscription('connect', socketService.on("connect", onConnect)),
      helper.addSubscription('disconnect', socketService.on("disconnect", onDisconnect))
    ]
    
    // Set initial connection state
    dispatch({
      type: "SET_SOCKET_CONNECTED",
      payload: socketService.isConnected(),
    })

    // Monitor connection state changes
    const checkConnectionInterval = setInterval(() => {
      const isConnected = socketService.isConnected()
      dispatch({
        type: "SET_SOCKET_CONNECTED",
        payload: isConnected,
      })
    }, 1000) // Check every second

    // Cleanup function - helper handles cleanup
    return () => {
      // Clear connection check interval
      clearInterval(checkConnectionInterval)
      
      // Helper will cleanup all subscriptions when component unmounts
      unsubscribers.forEach(unsub => {
        if (typeof unsub === 'function') {
          unsub();
        }
      });
    }
  }, [isAuthenticated, fetchNotifications])

  // Poll as fallback when socket is disconnected
  useEffect(() => {
    const helper = cleanupHelper.current;
    
    if (isAuthenticated && !state.socketConnected) {
      const intervalCleanup = helper.setInterval(() => {
        if (!socketService.isConnected()) {
          fetchNotifications()
          socketService.reconnect?.()
        }
      }, 30_000)
      
      return intervalCleanup;
    }
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
      const id = notification._id || notification.id
      if (!notification.read) markAsRead(id)

      const type = notification.type
      const data = notification.data || {}
      const senderId =
        notification.sender?._id ||
        data.sender?._id ||
        data.requester?._id ||
        data.user?._id ||
        data.owner?._id ||
        (type === "match" && data.matchedUser?._id) ||
        (type === "comment" && data.commenter?._id)

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
