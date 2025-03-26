"use client"

import { useEffect, useRef, useState } from "react"
import Peer from "peerjs"
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaPhoneSlash,
  FaExpandAlt,
  FaCompress,
} from "react-icons/fa"
import { toast } from "react-toastify"
import { useAuth } from "../context"

/**
 * VideoCall component using PeerJS
 */
const VideoCall = ({ isInitiator = false, remoteUserId, remoteUserName, onClose, socket, onError }) => {
  const [stream, setStream] = useState(null)
  const [remoteName, setRemoteName] = useState(remoteUserName || "User")
  const [connectionStatus, setConnectionStatus] = useState("initializing")
  const [callDuration, setCallDuration] = useState(0)
  const [isAudioMuted, setIsAudioMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isRemoteAudioMuted, setIsRemoteAudioMuted] = useState(false)
  const [isRemoteVideoOff, setIsRemoteVideoOff] = useState(false)

  const { user } = useAuth()
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const peerRef = useRef(null)
  const streamRef = useRef(null)
  const callRef = useRef(null)
  const callTimerRef = useRef(null)
  const containerRef = useRef(null)

  // Initialize the call when component mounts
  useEffect(() => {
    // Verify required props before starting call
    if (!user || !user._id || !remoteUserId) {
      console.error("Missing required user information for video call")
      setConnectionStatus("error")
      if (onError) {
        onError(new Error("Missing required user information for video call"))
      }
      return
    }

    // Check if socket exists before starting call
    if (!socket) {
      console.error("Socket connection required for video calls")
      setConnectionStatus("error")
      if (onError) {
        onError(new Error("Socket connection required for video calls"))
      }
      return
    }

    // Start the call
    startCall()

    // Set up timer for call duration
    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1)
    }, 1000)

    // Clean up when component unmounts
    return () => {
      endCall()
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current)
      }
    }
  }, [])

  // Set up socket event listeners for call control signals
  useEffect(() => {
    if (!socket) {
      console.warn("Cannot set up socket listeners: socket is null")
      return
    }

    // Handle media control events
    const handleMediaControl = (data) => {
      if (data.userId === remoteUserId) {
        if (data.type === "audio") {
          setIsRemoteAudioMuted(data.muted)
        } else if (data.type === "video") {
          setIsRemoteVideoOff(data.muted)
        }
      }
    }

    // Handle call hang up
    const handleHangup = (data) => {
      if (data.userId === remoteUserId) {
        toast.info(`${remoteName} ended the call`)
        onClose()
      }
    }

    // Add event listeners
    socket.on("videoMediaControl", handleMediaControl)
    socket.on("videoHangup", handleHangup)

    // Clean up event listeners
    return () => {
      try {
        socket.off("videoMediaControl", handleMediaControl)
        socket.off("videoHangup", handleHangup)
      } catch (err) {
        console.error("Error cleaning up socket event listeners:", err)
      }
    }
  }, [socket, remoteUserId, remoteName])

  // Format call duration
  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // Initialize video call
  const startCall = async () => {
    try {
      // Double-check socket availability
      if (!socket) {
        console.error("Socket connection required for video calls")
        setConnectionStatus("error")
        if (onError) {
          onError(new Error("Socket connection required for video calls"))
        }
        return
      }

      // Prevent multiple PeerJS instances
      if (peerRef.current) {
        console.log("PeerJS instance already exists, reusing it")
        return
      }

      // Request user media (camera and microphone)
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })

      streamRef.current = mediaStream
      setStream(mediaStream)

      // Display local video stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = mediaStream
      }

      // Generate a unique ID for this peer
      const peerId = `${user._id}-${Date.now()}`

      // Initialize PeerJS
      const peerInstance = new Peer(peerId, {
        debug: 2, // Log level
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:global.stun.twilio.com:3478" },
            // Add more STUN/TURN servers for better connectivity
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            { urls: "stun:stun3.l.google.com:19302" },
            { urls: "stun:stun4.l.google.com:19302" },
          ],
        },
      })

      peerRef.current = peerInstance

      // Handle peer open event
      peerInstance.on("open", (id) => {
        console.log("PeerJS connection established with ID:", id)
        setConnectionStatus("connecting")

        // Check if socket is still available
        if (socket) {
          try {
            // Send peer ID to remote user via signaling server
            socket.emit("peerIdExchange", {
              recipientId: remoteUserId,
              peerId: id,
              from: {
                userId: user._id,
                name: user.nickname || "User",
              },
            })

            // If initiator, wait for remote peer ID and call
            if (isInitiator) {
              console.log("I am the initiator, waiting for remote peer ID")

              // Handle peer ID from remote user
              const handlePeerIdReceived = (data) => {
                console.log("Received peer ID exchange data:", data)

                if (data.userId === remoteUserId || data.from?.userId === remoteUserId) {
                  const remotePeerId = data.peerId
                  console.log("Received remote peer ID:", remotePeerId)

                  // Make the call to remote peer
                  const call = peerInstance.call(remotePeerId, mediaStream)
                  callRef.current = call

                  // Set up call event handlers
                  setupCallHandlers(call)
                }
              }

              socket.on("peerIdExchange", handlePeerIdReceived)

              // Clean up event listener
              setTimeout(() => {
                try {
                  socket.off("peerIdExchange", handlePeerIdReceived)
                } catch (err) {
                  console.error("Error removing peerIdExchange listener:", err)
                }
              }, 30000) // Remove listener after 30 seconds
            } else {
              console.log("I am not the initiator, waiting for incoming call")
            }
          } catch (socketError) {
            console.error("Socket operation failed:", socketError)
            setConnectionStatus("error")
            if (onError) {
              onError(new Error(`Socket operation failed: ${socketError.message}`))
            }
          }
        } else {
          console.error("Socket connection not available for signaling")
          setConnectionStatus("error")

          if (onError) {
            onError(new Error("Socket connection not available for signaling"))
          }
        }
      })

      // Handle incoming calls (non-initiator)
      peerInstance.on("call", (call) => {
        console.log("Incoming call received from PeerJS")
        callRef.current = call

        // Answer the call with our stream
        call.answer(mediaStream)

        // Set up call event handlers
        setupCallHandlers(call)
      })

      // Handle errors
      peerInstance.on("error", (err) => {
        console.error("PeerJS error:", err)
        toast.error(`Connection error: ${err.type}`)
        setConnectionStatus("error")

        if (onError) {
          onError(err)
        }
      })
    } catch (err) {
      console.error("Error starting video call:", err)
      toast.error(err.message || "Couldn't access camera or microphone")
      setConnectionStatus("error")

      if (onError) {
        onError(err)
      }
    }
  }

  // Set up call event handlers
  const setupCallHandlers = (call) => {
    if (!call) {
      console.error("Cannot set up handlers for null call")
      return
    }

    // Handle remote stream
    call.on("stream", (remoteStream) => {
      console.log("Received remote stream")

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream

        // Add event listener to check if stream is active
        const checkStreamActive = () => {
          if (remoteStream.active) {
            console.log("Remote stream is active")
          } else {
            console.warn("Remote stream is not active")
            // Don't end the call here, just warn
          }
        }

        setTimeout(checkStreamActive, 1000)
      }

      setConnectionStatus("connected")
      toast.success(`Connected to ${remoteName}`)
    })

    // Handle call close
    call.on("close", () => {
      console.log("Call closed by peer")
      setConnectionStatus("disconnected")
    })

    // Handle call errors
    call.on("error", (err) => {
      console.error("Call error:", err)
      setConnectionStatus("error")

      if (onError) {
        onError(err)
      }
    })
  }

  // End the call and clean up resources
  const endCall = () => {
    console.log("Ending call and cleaning up resources")

    // Close the call
    if (callRef.current) {
      try {
        callRef.current.close()
      } catch (err) {
        console.error("Error closing call:", err)
      }
      callRef.current = null
    }

    // Stop media tracks
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => {
          try {
            track.stop()
          } catch (trackErr) {
            console.error("Error stopping track:", trackErr)
          }
        })
      } catch (streamErr) {
        console.error("Error stopping stream tracks:", streamErr)
      }
      streamRef.current = null
    }

    // Close peer connection
    if (peerRef.current) {
      try {
        peerRef.current.destroy()
      } catch (peerErr) {
        console.error("Error destroying peer:", peerErr)
      }
      peerRef.current = null
    }

    // Notify the remote user
    if (socket && remoteUserId) {
      try {
        socket.emit("videoHangup", {
          recipientId: remoteUserId,
          userId: user._id,
          timestamp: Date.now(),
        })
      } catch (socketErr) {
        console.error("Error sending hangup signal:", socketErr)
      }
    }

    setConnectionStatus("disconnected")

    if (callTimerRef.current) {
      clearInterval(callTimerRef.current)
      callTimerRef.current = null
    }
  }

  // Handle hanging up the call
  const handleHangup = () => {
    endCall()
    if (typeof onClose === "function") {
      onClose()
    }
  }

  // Toggle audio mute
  const toggleAudioMute = () => {
    if (streamRef.current) {
      try {
        const audioTracks = streamRef.current.getAudioTracks()
        audioTracks.forEach((track) => {
          track.enabled = isAudioMuted
        })
        setIsAudioMuted(!isAudioMuted)

        // Notify remote peer
        if (socket) {
          socket.emit("videoMediaControl", {
            recipientId: remoteUserId,
            type: "audio",
            muted: !isAudioMuted,
            userId: user._id,
          })
        }
      } catch (err) {
        console.error("Error toggling audio mute:", err)
        toast.error("Failed to change audio state")
      }
    }
  }

  // Toggle video off/on
  const toggleVideo = () => {
    if (streamRef.current) {
      try {
        const videoTracks = streamRef.current.getVideoTracks()
        videoTracks.forEach((track) => {
          track.enabled = isVideoOff
        })
        setIsVideoOff(!isVideoOff)

        // Notify remote peer
        if (socket) {
          socket.emit("videoMediaControl", {
            recipientId: remoteUserId,
            type: "video",
            muted: !isVideoOff,
            userId: user._id,
          })
        }
      } catch (err) {
        console.error("Error toggling video:", err)
        toast.error("Failed to change video state")
      }
    }
  }

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current && containerRef.current.requestFullscreen) {
        containerRef.current
          .requestFullscreen()
          .then(() => setIsFullscreen(true))
          .catch((err) => {
            console.error("Fullscreen error:", err)
            toast.error("Failed to enter fullscreen mode")
          })
      } else {
        toast.warning("Fullscreen not supported in your browser")
      }
    } else {
      if (document.exitFullscreen) {
        document
          .exitFullscreen()
          .then(() => setIsFullscreen(false))
          .catch((err) => {
            console.error("Exit fullscreen error:", err)
            toast.error("Failed to exit fullscreen mode")
          })
      }
    }
  }

  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  return (
    <div className="video-call-container" ref={containerRef}>
      <div className="video-call-header">
        <div className="call-status">
          {connectionStatus === "initializing" && "Initializing..."}
          {connectionStatus === "connecting" && "Connecting..."}
          {connectionStatus === "connected" && "Connected"}
          {connectionStatus === "error" && "Connection Error"}
          {connectionStatus === "disconnected" && "Disconnected"}
        </div>
        <div className="call-timer">{formatDuration(callDuration)}</div>
      </div>

      <div className="videos-container">
        <div className="remote-video-container">
          {isRemoteVideoOff && (
            <div className="video-off-indicator">
              <FaVideoSlash />
              <span>Video Off</span>
            </div>
          )}
          {isRemoteAudioMuted && (
            <div className="audio-muted-indicator">
              <FaMicrophoneSlash />
            </div>
          )}
          <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline />
          <div className="remote-user-name">{remoteName}</div>
        </div>

        <div className="local-video-container">
          <video
            ref={localVideoRef}
            className="local-video"
            autoPlay
            playsInline
            muted // Important to avoid echo
          />
          <div className="local-user-name">{user?.nickname || "You"}</div>
        </div>
      </div>

      <div className="call-controls">
        <button
          className={`control-btn ${isAudioMuted ? "muted" : ""}`}
          onClick={toggleAudioMute}
          title={isAudioMuted ? "Unmute Microphone" : "Mute Microphone"}
        >
          {isAudioMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
        </button>

        <button
          className={`control-btn ${isVideoOff ? "muted" : ""}`}
          onClick={toggleVideo}
          title={isVideoOff ? "Turn On Camera" : "Turn Off Camera"}
        >
          {isVideoOff ? <FaVideoSlash /> : <FaVideo />}
        </button>

        <button className="control-btn hangup-btn" onClick={handleHangup} title="End Call">
          <FaPhoneSlash />
        </button>

        <button
          className={`control-btn ${isFullscreen ? "active" : ""}`}
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          {isFullscreen ? <FaCompress /> : <FaExpandAlt />}
        </button>
      </div>

      <div className="connection-status">
        {connectionStatus === "initializing" && (
          <div className="connecting-spinner">
            <div className="spinner"></div>
            <span>Initializing your camera and microphone...</span>
          </div>
        )}

        {connectionStatus === "connecting" && (
          <div className="connecting-spinner">
            <div className="spinner"></div>
            <span>Connecting to {remoteName}...</span>
          </div>
        )}

        {connectionStatus === "error" && (
          <div className="connection-error">
            <span>Connection failed. Please try again.</span>
            <button onClick={startCall} className="retry-btn">
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default VideoCall
