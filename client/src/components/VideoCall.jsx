import { useEffect, useRef, useState, useCallback } from "react";
import Peer from "peerjs";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaPhoneSlash,
  FaExpandAlt,
  FaCompress,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { useAuth } from "../context";

// Constants for timeouts/delays (in milliseconds)
const PEER_ID_CLEANUP_TIMEOUT = 30000;
const CALL_SETUP_DELAY = 1000;
const CONNECTION_PROGRESS_CLEAR_TIMEOUT = 5000;
const HANGUP_DELAY = 2000;
const RECONNECT_DELAY = 3000;

// Utility function to toggle audio or video tracks
const toggleTracks = (stream, trackType, enabled) => {
  const tracks =
    trackType === "audio" ? stream.getAudioTracks() : stream.getVideoTracks();
  tracks.forEach((track) => {
    console.log(`[ToggleTracks] ${trackType} track current enabled: ${track.enabled}, setting to ${enabled}`);
    track.enabled = enabled;
  });
};

// Utility function to stop all tracks of a media stream
const stopMediaTracks = (stream) => {
  if (!stream) return;
  console.log("[stopMediaTracks] Stopping all media tracks");
  stream.getTracks().forEach((track) => {
    try {
      console.log("[stopMediaTracks] Stopping track:", track.kind);
      track.stop();
    } catch (error) {
      console.error("[stopMediaTracks] Error stopping track:", error);
    }
  });
};

// Utility function to format call duration
const formatDuration = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
};

const VideoCall = ({
  isInitiator = false,
  remoteUserId,
  remoteUserName,
  onClose,
  socket,
  onError,
}) => {
  const [stream, setStream] = useState(null);
  const [remoteName, setRemoteName] = useState(remoteUserName || "User");
  const [connectionStatus, setConnectionStatus] = useState("initializing");
  const [callDuration, setCallDuration] = useState(0);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRemoteAudioMuted, setIsRemoteAudioMuted] = useState(false);
  const [isRemoteVideoOff, setIsRemoteVideoOff] = useState(false);
  const [remotePeerId, setRemotePeerId] = useState(null);

  const { user } = useAuth();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const callRef = useRef(null);
  const callTimerRef = useRef(null);
  const containerRef = useRef(null);
  const connectionInProgressRef = useRef(false);
  const hangupProcessedRef = useRef(false);

  // Log component mount
  useEffect(() => {
    console.log("[VideoCall] Component mounted");
    if (!user || !user._id || !remoteUserId) {
      const errMsg = "Missing required user information for video call";
      console.error("[VideoCall] " + errMsg);
      setConnectionStatus("error");
      onError && onError(new Error(errMsg));
      return;
    }
    if (!socket) {
      const errMsg = "Socket connection required for video calls";
      console.error("[VideoCall] " + errMsg);
      setConnectionStatus("error");
      onError && onError(new Error(errMsg));
      return;
    }

    startCall();

    // Set up call duration timer
    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => {
      console.log("[VideoCall] Component unmounting: cleaning up");
      endCall();
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, []);

  // Socket event handlers
  const handleMediaControl = useCallback(
    (data) => {
      console.log("[VideoCall] Media control event received:", data);
      if (data.userId === remoteUserId) {
        if (data.type === "audio") setIsRemoteAudioMuted(data.muted);
        else if (data.type === "video") setIsRemoteVideoOff(data.muted);
      }
    },
    [remoteUserId]
  );

  const handleHangupSocket = useCallback(
    (data) => {
      console.log("[VideoCall] Hangup event received:", data);
      if (hangupProcessedRef.current) return;
      if (data.userId === remoteUserId) {
        hangupProcessedRef.current = true;
        toast.info(`${remoteName} ended the call`);
        if (connectionInProgressRef.current) {
          console.log("[VideoCall] Connection in progress, delaying hangup cleanup...");
          setTimeout(() => {
            if (hangupProcessedRef.current) {
              console.log("[VideoCall] Delayed hangup processing complete, closing call");
              onClose && onClose();
            }
          }, HANGUP_DELAY);
        } else {
          console.log("[VideoCall] No connection in progress, closing call immediately");
          onClose && onClose();
        }
      }
    },
    [remoteUserId, remoteName, onClose]
  );

  // Setup socket listeners
  useEffect(() => {
    if (!socket) return;
    console.log("[VideoCall] Setting up socket listeners");
    socket.on("videoMediaControl", handleMediaControl);
    socket.on("videoHangup", handleHangupSocket);
    return () => {
      console.log("[VideoCall] Removing socket listeners");
      socket.off("videoMediaControl", handleMediaControl);
      socket.off("videoHangup", handleHangupSocket);
    };
  }, [socket, handleMediaControl, handleHangupSocket]);

  // Start call: obtain media and initialize PeerJS
  const startCall = async () => {
    try {
      console.log("[VideoCall] Starting call");
      if (!socket) {
        const errMsg = "Socket connection required for video calls";
        console.error("[VideoCall] " + errMsg);
        setConnectionStatus("error");
        onError && onError(new Error(errMsg));
        return;
      }

      connectionInProgressRef.current = true;

      if (peerRef.current) {
        console.log("[VideoCall] PeerJS instance already exists, reusing it");
        return;
      }

      console.log("[VideoCall] Requesting user media...");
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      console.log("[VideoCall] User media acquired");
      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = mediaStream;
      }

      const peerId = `${user._id}-${Date.now()}`;
      console.log("[VideoCall] Creating PeerJS instance with ID:", peerId);
      const peerInstance = new Peer(peerId, {
        debug: 2,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:global.stun.twilio.com:3478" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            { urls: "stun:stun3.l.google.com:19302" },
            { urls: "stun:stun4.l.google.com:19302" },
          ],
        },
      });
      peerRef.current = peerInstance;

      // PeerJS open event
      peerInstance.on("open", (id) => {
        console.log("[VideoCall] PeerJS open event fired. ID:", id);
        setConnectionStatus("connecting");
        if (socket) {
          console.log("[VideoCall] Emitting peerIdExchange with ID:", id);
          socket.emit("peerIdExchange", {
            recipientId: remoteUserId,
            peerId: id,
            from: {
              userId: user._id,
              name: user.nickname || "User",
            },
          });

          const handlePeerIdReceived = (data) => {
            console.log("[VideoCall] Received peerIdExchange data:", data);
            if (data.from?.userId === remoteUserId || data.userId === remoteUserId) {
              const remoteId = data.peerId;
              console.log("[VideoCall] Remote peer ID received:", remoteId);
              setRemotePeerId(remoteId);
              hangupProcessedRef.current = false;
              if (isInitiator) {
                console.log("[VideoCall] Initiator: calling remote peer in", CALL_SETUP_DELAY, "ms");
                setTimeout(() => {
                  if (peerInstance.disconnected) {
                    console.log("[VideoCall] Peer disconnected, attempting to reconnect...");
                    peerInstance.reconnect();
                  }
                  console.log("[VideoCall] Initiator: making call to remote ID:", remoteId);
                  const call = peerInstance.call(remoteId, mediaStream);
                  if (!call) {
                    console.error("[VideoCall] Failed to create call object");
                    return;
                  }
                  callRef.current = call;
                  setupCallHandlers(call);
                }, CALL_SETUP_DELAY);
              } else {
                console.log("[VideoCall] Non-initiator: waiting for incoming call from remote ID:", remoteId);
              }
            }
          };

          socket.on("peerIdExchange", handlePeerIdReceived);
          setTimeout(() => {
            try {
              console.log("[VideoCall] Removing peerIdExchange listener after timeout");
              socket.off("peerIdExchange", handlePeerIdReceived);
            } catch (err) {
              console.error("[VideoCall] Error removing peerIdExchange listener:", err);
            }
          }, PEER_ID_CLEANUP_TIMEOUT);
        } else {
          console.error("[VideoCall] Socket connection not available for signaling");
          setConnectionStatus("error");
          onError && onError(new Error("Socket connection not available for signaling"));
        }
      });

      // Handle incoming call (for non-initiator)
      peerInstance.on("call", (call) => {
        console.log("[VideoCall] Incoming call received from PeerJS");
        callRef.current = call;
        hangupProcessedRef.current = false;
        console.log("[VideoCall] Answering incoming call...");
        call.answer(mediaStream);
        setupCallHandlers(call);
      });

      // PeerJS error event
      peerInstance.on("error", (err) => {
        console.error("[VideoCall] PeerJS error:", err);
        toast.error(`[VideoCall] Connection error: ${err.type}`);
        setConnectionStatus("error");
        onError && onError(err);
      });
    } catch (err) {
      console.error("[VideoCall] Error starting video call:", err);
      toast.error(err.message || "Couldn't access camera or microphone");
      setConnectionStatus("error");
      onError && onError(err);
    } finally {
      setTimeout(() => {
        connectionInProgressRef.current = false;
      }, CONNECTION_PROGRESS_CLEAR_TIMEOUT);
    }
  };

  // Set up call event handlers
  const setupCallHandlers = (call) => {
    if (!call) {
      console.error("[VideoCall] Cannot set up handlers for null call");
      return;
    }
    console.log("[VideoCall] Setting up call handlers for call:", call);

    call.on("stream", (remoteStream) => {
      console.log("[VideoCall] 'stream' event fired with remote stream:", remoteStream);
      connectionInProgressRef.current = false;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        setTimeout(() => {
          if (!remoteStream.active) {
            console.warn("[VideoCall] Remote stream is not active");
          } else {
            console.log("[VideoCall] Remote stream is active");
          }
        }, 1000);
      }
      setConnectionStatus("connected");
      toast.success(`Connected to ${remoteName}`);
    });

    call.on("close", () => {
      console.log("[VideoCall] Call closed by peer");
      setConnectionStatus("disconnected");
      connectionInProgressRef.current = false;
    });

    call.on("error", (err) => {
      console.error("[VideoCall] Call error:", err);
      setConnectionStatus("error");
      connectionInProgressRef.current = false;
      onError && onError(err);
    });
  };

  // End call and cleanup
  const endCall = () => {
    console.log("[VideoCall] Ending call and cleaning up resources");
    connectionInProgressRef.current = false;
    if (callRef.current) {
      try {
        console.log("[VideoCall] Closing call");
        callRef.current.close();
      } catch (err) {
        console.error("[VideoCall] Error closing call:", err);
      }
      callRef.current = null;
    }
    if (streamRef.current) {
      stopMediaTracks(streamRef.current);
      streamRef.current = null;
    }
    if (peerRef.current) {
      try {
        console.log("[VideoCall] Destroying peer");
        peerRef.current.destroy();
      } catch (err) {
        console.error("[VideoCall] Error destroying peer:", err);
      }
      peerRef.current = null;
    }
    if (socket && remoteUserId && !hangupProcessedRef.current) {
      try {
        console.log("[VideoCall] Emitting videoHangup signal");
        socket.emit("videoHangup", {
          recipientId: remoteUserId,
          userId: user._id,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error("[VideoCall] Error sending hangup signal:", err);
      }
    }
    setConnectionStatus("disconnected");
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  // Hangup button handler
  const handleHangup = () => {
    console.log("[VideoCall] Hangup button clicked");
    endCall();
    onClose && onClose();
  };

  // Toggle audio mute/unmute
  const toggleAudioMute = () => {
    if (streamRef.current) {
      try {
        toggleTracks(streamRef.current, "audio", isAudioMuted);
        setIsAudioMuted(!isAudioMuted);
        console.log("[VideoCall] Toggling audio mute. New state:", !isAudioMuted);
        if (socket) {
          socket.emit("videoMediaControl", {
            recipientId: remoteUserId,
            type: "audio",
            muted: !isAudioMuted,
            userId: user._id,
          });
        }
      } catch (err) {
        console.error("[VideoCall] Error toggling audio mute:", err);
        toast.error("Failed to change audio state");
      }
    }
  };

  // Toggle video on/off
  const toggleVideo = () => {
    if (streamRef.current) {
      try {
        toggleTracks(streamRef.current, "video", isVideoOff);
        setIsVideoOff(!isVideoOff);
        console.log("[VideoCall] Toggling video. New state:", !isVideoOff);
        if (socket) {
          socket.emit("videoMediaControl", {
            recipientId: remoteUserId,
            type: "video",
            muted: !isVideoOff,
            userId: user._id,
          });
        }
      } catch (err) {
        console.error("[VideoCall] Error toggling video:", err);
        toast.error("Failed to change video state");
      }
    }
  };

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current && containerRef.current.requestFullscreen) {
        containerRef.current
          .requestFullscreen()
          .then(() => {
            console.log("[VideoCall] Entered fullscreen");
            setIsFullscreen(true);
          })
          .catch((err) => {
            console.error("[VideoCall] Fullscreen error:", err);
            toast.error("Failed to enter fullscreen mode");
          });
      } else {
        toast.warning("Fullscreen not supported in your browser");
      }
    } else {
      if (document.exitFullscreen) {
        document
          .exitFullscreen()
          .then(() => {
            console.log("[VideoCall] Exited fullscreen");
            setIsFullscreen(false);
          })
          .catch((err) => {
            console.error("[VideoCall] Exit fullscreen error:", err);
            toast.error("Failed to exit fullscreen mode");
          });
      }
    }
  };

  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      console.log("[VideoCall] Fullscreen change event. Fullscreen active:", !!document.fullscreenElement);
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Reconnection logic if connection fails
  useEffect(() => {
    if (connectionStatus === "error" && remotePeerId && peerRef.current) {
      console.log("[VideoCall] Attempting to reconnect after error...");
      const reconnectTimeout = setTimeout(() => {
        try {
          if (peerRef.current.disconnected) {
            console.log("[VideoCall] Peer is disconnected, attempting reconnect...");
            peerRef.current.reconnect();
          }
          if (isInitiator && streamRef.current && remotePeerId) {
            console.log("[VideoCall] Initiator retrying call to:", remotePeerId);
            const call = peerRef.current.call(remotePeerId, streamRef.current);
            if (call) {
              callRef.current = call;
              setupCallHandlers(call);
              setConnectionStatus("connecting");
            }
          }
        } catch (err) {
          console.error("[VideoCall] Error during reconnection attempt:", err);
        }
      }, RECONNECT_DELAY);
      return () => clearTimeout(reconnectTimeout);
    }
  }, [connectionStatus, remotePeerId, isInitiator]);

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
            muted
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
  );
};

export default VideoCall;
