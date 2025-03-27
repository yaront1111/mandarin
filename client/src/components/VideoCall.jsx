"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Peer } from "peerjs"
import "../styles/video-call.css"
import CallSounds from "./CallSounds"

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
]

const VideoCall = ({ callId, userId, callType, caller, onCallEnd, socket, onError, isIncoming = false }) => {
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [callStatus, setCallStatus] = useState("connecting") // connecting, connected, ended
  const [connectionAttempts, setConnectionAttempts] = useState(0)
  const [peerConnected, setPeerConnected] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const [isFullScreen, setIsFullScreen] = useState(false)

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const peerRef = useRef(null)
  const connectionRef = useRef(null)
  const callTimerRef = useRef(null)
  const controlsTimerRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const callInitializedRef = useRef(false)

  // Debug logging helper
  const log = useCallback((message) => {
    console.log(`[VideoCall] ${message}`)
  }, [])

  // Initialize call
  useEffect(() => {
    log("Component mounted")

    if (!callInitializedRef.current) {
      startCall()
      callInitializedRef.current = true
    } else {
      log("Already initialized, skipping startCall")
    }

    setupSocketListeners()

    // Auto-hide controls after inactivity
    const handleMouseMove = () => {
      setShowControls(true)
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current)
      }
      controlsTimerRef.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }

    document.addEventListener("mousemove", handleMouseMove)

    return () => {
      log("Component unmounting: cleaning up")
      endCall()
      document.removeEventListener("mousemove", handleMouseMove)
      removeSocketListeners()
    }
  }, [])

  // Setup socket event listeners
  const setupSocketListeners = useCallback(() => {
    log("Setting up socket listeners")

    if (!socket) {
      log("No socket provided, skipping socket listeners")
      return
    }

    socket.on("peerIdExchange", handlePeerIdExchange)
    socket.on("videoHangup", handleHangup)

    // Return cleanup function
    return () => removeSocketListeners()
  }, [socket])

  // Remove socket listeners
  const removeSocketListeners = useCallback(() => {
    log("Removing socket listeners")

    if (!socket) return

    socket.off("peerIdExchange", handlePeerIdExchange)
    socket.off("videoHangup", handleHangup)
  }, [socket])

  // Handle peer ID exchange
  const handlePeerIdExchange = useCallback(
    (data) => {
      log(`Received peer ID: ${data.peerId} from user ${data.userId}`)

      if (data.userId !== userId) {
        log(`Peer ID is not for current call (${data.userId} vs ${userId}), ignoring`)
        return
      }

      if (peerRef.current && peerRef.current.open && localStream) {
        log(`Calling peer with ID: ${data.peerId}`)

        try {
          const call = peerRef.current.call(data.peerId, localStream, {
            metadata: { callId, userId: socket.id },
            sdpTransform: (sdp) => {
              // Prioritize video quality
              return sdp.replace("useinbandfec=1", "useinbandfec=1; stereo=1; maxaveragebitrate=510000")
            },
          })

          if (call) {
            connectionRef.current = call
            setupCallListeners(call)
          } else {
            log("Failed to initiate call - call object is null")
            handleCallError(new Error("Failed to initiate call"))
          }
        } catch (err) {
          log(`Error calling peer: ${err.message}`)
          handleCallError(err)
        }
      } else {
        log("Peer or local stream not ready yet, will retry")
        // Schedule retry if peer or stream isn't ready
        setTimeout(() => {
          if (data.peerId && peerRef.current && peerRef.current.open && localStream) {
            handlePeerIdExchange(data)
          }
        }, 1000)
      }
    },
    [callId, userId, localStream, socket],
  )

  // Handle hangup event
  const handleHangup = useCallback(
    (data) => {
      log(`Hangup event received: ${JSON.stringify(data)}`)

      if (data.userId === userId) {
        log("Remote user hung up")

        if (connectionRef.current) {
          connectionRef.current.close()
          connectionRef.current = null
        } else {
          log("No connection in progress, closing call immediately")
        }

        endCall()
      }
    },
    [userId],
  )

  // Setup call event listeners
  const setupCallListeners = useCallback((call) => {
    if (!call) return

    call.on("stream", (stream) => {
      log("Received remote stream")
      setRemoteStream(stream)
      setCallStatus("connected")

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream
      }

      // Start call timer
      if (callTimerRef.current) clearInterval(callTimerRef.current)
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    })

    call.on("close", () => {
      log("Call closed")
      endCall()
    })

    call.on("error", (err) => {
      log(`Call error: ${err.message}`)
      handleCallError(err)
    })
  }, [])

  // Start the call
  const startCall = useCallback(async () => {
    log("Starting call")

    try {
      log("Requesting user media...")
      const constraints = {
        audio: true,
        video: callType === "video" ? { width: 1280, height: 720 } : false,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      log("User media acquired")

      setLocalStream(stream)

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      // Create PeerJS instance with better config
      const peerId = `${socket ? socket.id : "user"}-${Date.now()}`
      log(`Creating PeerJS instance with ID: ${peerId}`)

      const peer = new Peer(peerId, {
        debug: 2,
        host: window.location.hostname,
        port: window.location.port || (window.location.protocol === "https:" ? 443 : 80),
        path: "/peerjs",
        secure: window.location.protocol === "https:",
        config: {
          iceServers: ICE_SERVERS,
          sdpSemantics: "unified-plan",
          iceTransportPolicy: "all",
        },
        // Add more reliable connection options
        pingInterval: 3000,
        reconnectTimer: 1000,
      })

      peerRef.current = peer

      peer.on("open", (id) => {
        log(`PeerJS open event fired. ID: ${id}`)
        setPeerConnected(true)

        // Emit peer ID to the other user
        if (socket && socket.connected) {
          log(`Emitting peerIdExchange with ID: ${id}`)
          socket.emit("peerIdExchange", {
            peerId: id,
            userId: socket.id,
            targetUserId: userId,
            callId,
          })
        } else {
          log("Socket not connected, cannot emit peerIdExchange")
          handleCallError(new Error("Socket connection unavailable"))
        }
      })

      peer.on("call", (call) => {
        log(`Incoming call from ${call.peer}`)
        connectionRef.current = call

        call.answer(stream)
        setupCallListeners(call)
      })

      peer.on("error", (err) => {
        log(`PeerJS error: ${err}`)
        handleCallError(err)
      })

      peer.on("disconnected", () => {
        log("PeerJS disconnected")
        setPeerConnected(false)

        // Attempt to reconnect
        log("Attempting to reconnect peer...")
        peer.reconnect()
      })

      peer.on("close", () => {
        log("PeerJS connection closed")
        setPeerConnected(false)
      })
    } catch (err) {
      log(`Error starting call: ${err.message}`)
      handleCallError(err)
    }
  }, [callId, callType, userId, socket])

  // Handle call errors
  const handleCallError = useCallback(
    (error) => {
      log(`Call error: ${error.message}`)

      // Notify parent component
      if (onError) {
        onError(error)
      }

      // Attempt to reconnect if appropriate
      if (connectionAttempts < 3) {
        log(`Reconnection attempt ${connectionAttempts + 1}/3`)
        setConnectionAttempts((prev) => prev + 1)

        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current)
        }

        reconnectTimerRef.current = setTimeout(() => {
          if (peerRef.current) {
            // Try to reconnect the peer
            try {
              peerRef.current.destroy()
              peerRef.current = null
              callInitializedRef.current = false
              startCall()
            } catch (err) {
              log(`Error during reconnection: ${err.message}`)
            }
          }
        }, 2000)
      } else {
        log("Max reconnection attempts reached, ending call")
        endCall()
      }
    },
    [connectionAttempts, onError, startCall],
  )

  // End the call
  const endCall = useCallback(() => {
    log("Ending call and cleaning up resources")

    // Emit hangup signal
    if (socket) {
      log("Emitting videoHangup signal")
      socket.emit("videoHangup", {
        userId: socket.id,
        targetUserId: userId,
        callId,
      })
    }

    // Close peer connection
    if (peerRef.current) {
      try {
        peerRef.current.destroy()
      } catch (err) {
        log(`Error destroying peer: ${err.message}`)
      }
      peerRef.current = null
    }

    // Close media connection
    if (connectionRef.current) {
      try {
        connectionRef.current.close()
      } catch (err) {
        log(`Error closing connection: ${err.message}`)
      }
      connectionRef.current = null
    }

    // Stop local stream tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.stop()
      })
      setLocalStream(null)
    }

    // Clear timers
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current)
      callTimerRef.current = null
    }

    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current)
      controlsTimerRef.current = null
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    // Update state
    setCallStatus("ended")

    // Notify parent component
    if (onCallEnd) {
      onCallEnd()
    }
  }, [callId, userId, socket, onCallEnd, localStream])

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks()
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled
      })
      setIsMuted(!isMuted)
    }
  }, [localStream, isMuted])

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks()
      videoTracks.forEach((track) => {
        track.enabled = !track.enabled
      })
      setIsVideoOff(!isVideoOff)
    }
  }, [localStream, isVideoOff])

  // Toggle fullscreen
  const toggleFullScreen = useCallback(() => {
    const container = document.querySelector(".video-call-container")

    if (!document.fullscreenElement) {
      if (container.requestFullscreen) {
        container.requestFullscreen()
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen()
      } else if (container.msRequestFullscreen) {
        container.msRequestFullscreen()
      }
      setIsFullScreen(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen()
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen()
      }
      setIsFullScreen(false)
    }
  }, [])

  // Format call duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className={`video-call-container ${callType} ${callStatus}`}>
      <CallSounds callStatus={callStatus} isIncoming={isIncoming} />

      <div className="video-grid">
        {callType === "video" && (
          <>
            <div className="remote-video-container">
              {remoteStream ? (
                <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
              ) : (
                <div className="connecting-placeholder">
                  <div className="spinner"></div>
                  <p>Connecting...</p>
                </div>
              )}
            </div>

            <div className="local-video-container">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`local-video ${isVideoOff ? "video-off" : ""}`}
              />
              {isVideoOff && (
                <div className="video-off-indicator">
                  <i className="fas fa-video-slash"></i>
                </div>
              )}
            </div>
          </>
        )}

        {callType === "audio" && (
          <div className="audio-call-ui">
            <div className="caller-avatar">
              {caller && caller.avatar ? (
                <img src={caller.avatar || "/placeholder.svg"} alt={caller.name || "Caller"} />
              ) : (
                <div className="avatar-placeholder">
                  {caller && caller.name ? caller.name.charAt(0).toUpperCase() : "?"}
                </div>
              )}
            </div>
            <h2 className="caller-name">{caller ? caller.name : "Unknown"}</h2>
            <p className="call-status">
              {callStatus === "connecting"
                ? "Connecting..."
                : callStatus === "connected"
                  ? formatDuration(callDuration)
                  : "Call ended"}
            </p>
          </div>
        )}
      </div>

      {showControls && (
        <div className="call-controls">
          <button
            className={`control-button ${isMuted ? "active" : ""}`}
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            <i className={`fas ${isMuted ? "fa-microphone-slash" : "fa-microphone"}`}></i>
          </button>

          {callType === "video" && (
            <button
              className={`control-button ${isVideoOff ? "active" : ""}`}
              onClick={toggleVideo}
              aria-label={isVideoOff ? "Turn video on" : "Turn video off"}
            >
              <i className={`fas ${isVideoOff ? "fa-video-slash" : "fa-video"}`}></i>
            </button>
          )}

          <button className="control-button end-call" onClick={endCall} aria-label="End call">
            <i className="fas fa-phone-slash"></i>
          </button>

          {callType === "video" && (
            <button
              className={`control-button ${isFullScreen ? "active" : ""}`}
              onClick={toggleFullScreen}
              aria-label={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              <i className={`fas ${isFullScreen ? "fa-compress" : "fa-expand"}`}></i>
            </button>
          )}

          <div className="call-duration">{callStatus === "connected" && formatDuration(callDuration)}</div>
        </div>
      )}

      {callStatus === "connecting" && (
        <div className="connection-status">
          <p>Establishing secure connection...</p>
          <div className="connection-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}
    </div>
  )
}

export default VideoCall
