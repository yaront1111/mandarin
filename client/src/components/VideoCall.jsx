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
  FaSync,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { useAuth } from "../context";
import CallSounds from "./CallSounds";

// Constants for timeouts/delays (in milliseconds)
const PEER_ID_CLEANUP_TIMEOUT = 30000;
const CALL_SETUP_DELAY = 1000;
const PEER_CONNECT_TIMEOUT = 30000;
const CONNECTION_PROGRESS_CLEAR_TIMEOUT = 5000;
const HANGUP_DELAY = 2000;
const RECONNECT_DELAY = 3000;
const ICE_SERVER_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    // Add TURN servers for better connectivity through firewalls
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

// Utility function to toggle audio or video tracks
const toggleTracks = (stream, trackType, enabled) => {
  if (!stream) return;
  const tracks =
    trackType === "audio" ? stream.getAudioTracks() : stream.getVideoTracks();
  tracks.forEach((track) => {
    console.log(`[ToggleTracks] ${trackType} track (${track.kind}) current enabled: ${track.enabled} => setting to ${enabled}`);
    track.enabled = enabled;
  });
};

// Utility function to stop all tracks of a media stream
const stopMediaTracks = (stream) => {
  if (!stream) return;
  console.log("[stopMediaTracks] Stopping all media tracks");
  stream.getTracks().forEach((track) => {
    try {
      console.log(`[stopMediaTracks] Stopping track: ${track.kind}`);
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
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
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
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [playSounds, setPlaySounds] = useState({
    ringtone: isInitiator, // play ringtone if initiating call
    callConnect: false
  });

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
  const peerConnectTimeoutRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  // Guard against duplicate initialization within the same session
  const initializedRef = useRef(false);

  // Debug function to log to console
  const debug = (message, ...args) => {
    console.log(`[VideoCall] ${message}`, ...args);
  };

  useEffect(() => {
    debug("Component mounted");
    if (initializedRef.current) {
      debug("Already initialized, skipping startCall");
      return;
    }
    if (!user || !user._id || !remoteUserId) {
      const errMsg = "Missing required user information for video call";
      debug(errMsg);
      setConnectionStatus("error");
      onError && onError(new Error(errMsg));
      return;
    }
    if (!socket) {
      const errMsg = "Socket connection required for video calls";
      debug(errMsg);
      setConnectionStatus("error");
      onError && onError(new Error(errMsg));
      return;
    }

    startCall();
    initializedRef.current = true;

    // Set up call duration timer
    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => {
      debug("Component unmounting: cleaning up");
      endCall();
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      if (peerConnectTimeoutRef.current) clearTimeout(peerConnectTimeoutRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, []);

  const handleMediaControl = useCallback(
    (data) => {
      debug("Media control event received:", data);
      if (data.userId === remoteUserId) {
        if (data.type === "audio") setIsRemoteAudioMuted(data.muted);
        else if (data.type === "video") setIsRemoteVideoOff(data.muted);
      }
    },
    [remoteUserId]
  );

  const handleHangupSocket = useCallback(
    (data) => {
      debug("Hangup event received:", data);
      // If we've already processed a hangup for this call, ignore duplicate events
      if (hangupProcessedRef.current) {
        debug("Ignoring duplicate hangup event");
        return;
      }

      if (data.userId === remoteUserId) {
        hangupProcessedRef.current = true;

        // Stop ringtone if it's playing
        setPlaySounds({ringtone: false, callConnect: false});

        toast.info(`${remoteName} ended the call`);
        if (connectionInProgressRef.current) {
          debug("Connection in progress, delaying hangup cleanup...");
          setTimeout(() => {
            debug("Delayed hangup processing complete, closing call");
            onClose && onClose();
          }, HANGUP_DELAY);
        } else {
          debug("No connection in progress, closing call immediately");
          onClose && onClose();
        }
      }
    },
    [remoteUserId, remoteName, onClose]
  );

  const handlePeerIdReceived = useCallback((data) => {
    debug("Received peerIdExchange data:", data);
    // If remotePeerId is already set, ignore duplicate events.
    if (remotePeerId) {
      debug("Remote peer ID already set, ignoring duplicate:", remotePeerId);
      return;
    }

    // Check if this peerIdExchange is for our call (from the remote user we're calling)
    const fromUserId = data.from?.userId || data.userId;
    if (fromUserId !== remoteUserId) {
      debug(`Ignoring peerIdExchange from ${fromUserId}, expecting ${remoteUserId}`);
      return;
    }

    const remoteId = data.peerId;
    if (!remoteId) {
      debug("Invalid peerIdExchange data: missing peerId");
      return;
    }

    debug("Remote peer ID received:", remoteId);
    setRemotePeerId(remoteId);
    hangupProcessedRef.current = false;

    if (isInitiator) {
      debug(`Initiator: calling remote peer in ${CALL_SETUP_DELAY}ms`);

      // Stop ringtone when receiving peer ID (other user has accepted)
      setPlaySounds({ringtone: false, callConnect: true});

      setTimeout(() => {
        if (peerRef.current && peerRef.current.disconnected) {
          debug("Peer disconnected, attempting to reconnect...");
          peerRef.current.reconnect();
        }
        if (callRef.current) {
          debug("Call already exists, skipping call initiation");
          return;
        }

        if (!peerRef.current) {
          debug("PeerJS instance doesn't exist, can't initiate call");
          return;
        }

        debug("Initiator: making call to remote ID:", remoteId);
        if (!streamRef.current) {
          debug("No local stream available, can't initiate call");
          onError && onError(new Error("Local stream not available"));
          return;
        }

        try {
          const call = peerRef.current.call(remoteId, streamRef.current);
          if (!call) {
            debug("Failed to create call object");
            onError && onError(new Error("Failed to create peer connection"));
            return;
          }
          callRef.current = call;
          setupCallHandlers(call);

          // Set a timeout for call connection
          if (peerConnectTimeoutRef.current) clearTimeout(peerConnectTimeoutRef.current);
          peerConnectTimeoutRef.current = setTimeout(() => {
            if (connectionStatus !== "connected") {
              debug("Call connection timed out, retrying...");
              if (callRef.current) {
                callRef.current.close();
                callRef.current = null;
              }

              // Try again if we haven't made too many attempts
              if (connectionAttempts < 3) {
                setConnectionAttempts(c => c + 1);
                handlePeerIdReceived(data);
              } else {
                setConnectionStatus("error");
                onError && onError(new Error("Failed to establish connection after multiple attempts"));
              }
            }
          }, PEER_CONNECT_TIMEOUT);

        } catch (err) {
          debug("Error making call:", err);
          onError && onError(err);
        }
      }, CALL_SETUP_DELAY);
    } else {
      debug("Non-initiator: waiting for incoming call from remote ID:", remoteId);

      // For non-initiator, stop playing ringtone now that peer ID is exchanged
      setPlaySounds({ringtone: false, callConnect: false});
    }
  }, [isInitiator, onError, remoteUserId, remotePeerId, connectionStatus, connectionAttempts]);

  useEffect(() => {
    if (!socket) return;
    debug("Setting up socket listeners");

    // Unregistering previous handlers to avoid duplicates
    socket.off("videoMediaControl");
    socket.off("videoHangup");
    socket.off("peerIdExchange");

    // Register new handlers
    socket.on("videoMediaControl", handleMediaControl);
    socket.on("videoHangup", handleHangupSocket);
    socket.on("peerIdExchange", handlePeerIdReceived);

    return () => {
      debug("Removing socket listeners");
      socket.off("videoMediaControl", handleMediaControl);
      socket.off("videoHangup", handleHangupSocket);
      socket.off("peerIdExchange", handlePeerIdReceived);
    };
  }, [socket, handleMediaControl, handleHangupSocket, handlePeerIdReceived]);

  const startCall = async () => {
    try {
      debug("Starting call");
      if (!socket) {
        const errMsg = "Socket connection required for video calls";
        debug(errMsg);
        setConnectionStatus("error");
        onError && onError(new Error(errMsg));
        return;
      }

      connectionInProgressRef.current = true;

      if (peerRef.current) {
        debug("PeerJS instance already exists, skipping new initialization");
        return;
      }

      debug("Requesting user media...");
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 24 }
          },
          audio: true,
        });

        debug("User media acquired");
        streamRef.current = mediaStream;
        setStream(mediaStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
        }
      } catch (mediaError) {
        debug("Failed to get user media:", mediaError);
        // Try without video if video failed
        try {
          debug("Trying to get audio only...");
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
          });
          streamRef.current = audioOnlyStream;
          setStream(audioOnlyStream);
          setIsVideoOff(true);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = audioOnlyStream;
          }
        } catch (audioError) {
          debug("Failed to get audio media:", audioError);
          throw audioError;
        }
      }

      const peerId = `${user._id}-${Date.now()}`;
      debug("Creating PeerJS instance with ID:", peerId);

      const peerInstance = new Peer(peerId, {
        debug: 2,
        config: {
          iceServers: ICE_SERVER_CONFIG.iceServers,
          sdpSemantics: 'unified-plan',
          iceTransportPolicy: 'all'
        }
      });

      peerRef.current = peerInstance;

      peerInstance.on("open", (id) => {
        debug("PeerJS open event fired. ID:", id);
        setConnectionStatus("connecting");

        if (socket) {
          debug("Emitting peerIdExchange with ID:", id);
          socket.emit("peerIdExchange", {
            recipientId: remoteUserId,
            peerId: id,
            from: {
              userId: user._id,
              name: user.nickname || "User",
            },
          });

          // Set timeout to clean up the peerIdExchange listener
          setTimeout(() => {
            try {
              debug("Removing peerIdExchange listener after timeout");
              // We don't need to remove the listener here as we now manage it in the useEffect
            } catch (err) {
              debug("Error removing peerIdExchange listener:", err);
            }
          }, PEER_ID_CLEANUP_TIMEOUT);
        } else {
          debug("Socket connection not available for signaling");
          setConnectionStatus("error");
          onError && onError(new Error("Socket connection not available for signaling"));
        }
      });

      peerInstance.on("call", (call) => {
        debug("Incoming call received from PeerJS");
        if (callRef.current) {
          debug("Already have an active call, ignoring new incoming call");
          return;
        }

        callRef.current = call;
        hangupProcessedRef.current = false;

        debug("Answering incoming call...");
        call.answer(streamRef.current);
        setupCallHandlers(call);

        // Let's play the call connection sound for the receiver as well
        setPlaySounds({ringtone: false, callConnect: true});
      });

      peerInstance.on("error", (err) => {
        debug("PeerJS error:", err);
        toast.error(`Connection error: ${err.type}`);
        setConnectionStatus("error");
        onError && onError(err);
      });

      peerInstance.on("disconnected", () => {
        debug("PeerJS disconnected");
        // Try to reconnect automatically
        if (peerRef.current && !hangupProcessedRef.current) {
          debug("Attempting to reconnect peer...");
          peerRef.current.reconnect();
        }
      });

      peerInstance.on("close", () => {
        debug("PeerJS connection closed");
        if (!hangupProcessedRef.current) {
          setConnectionStatus("disconnected");
        }
      });
    } catch (err) {
      debug("Error starting video call:", err);
      toast.error(err.message || "Couldn't access camera or microphone");
      setConnectionStatus("error");
      onError && onError(err);
    } finally {
      setTimeout(() => {
        connectionInProgressRef.current = false;
      }, CONNECTION_PROGRESS_CLEAR_TIMEOUT);
    }
  };

  const setupCallHandlers = (call) => {
    if (!call) {
      debug("Cannot set up handlers for null call");
      return;
    }
    debug("Setting up call handlers for call:", call);

    call.on("stream", (remoteStream) => {
      debug("'stream' event fired with remote stream:", remoteStream);
      connectionInProgressRef.current = false;

      // Clear peer connect timeout
      if (peerConnectTimeoutRef.current) {
        clearTimeout(peerConnectTimeoutRef.current);
        peerConnectTimeoutRef.current = null;
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;

        // Ensure video is playing
        remoteVideoRef.current.play().catch(err => {
          debug("Error playing remote video:", err);
        });

        setTimeout(() => {
          if (!remoteStream.active) {
            debug("Remote stream is not active");
          } else {
            debug("Remote stream is active");

            // Play connection sound after stream is confirmed active
            setPlaySounds(prev => ({...prev, ringtone: false, callConnect: true}));
          }
        }, 1000);
      }

      setConnectionStatus("connected");
      toast.success(`Connected to ${remoteName}`);
    });

    call.on("close", () => {
      debug("Call closed by peer");
      setConnectionStatus("disconnected");
      connectionInProgressRef.current = false;

      // Stop playing sounds
      setPlaySounds({ringtone: false, callConnect: false});
    });

    call.on("error", (err) => {
      debug("Call error:", err);
      setConnectionStatus("error");
      connectionInProgressRef.current = false;
      onError && onError(err);
    });
  };

  const endCall = () => {
    debug("Ending call and cleaning up resources");
    connectionInProgressRef.current = false;

    // Stop playing all sounds
    setPlaySounds({ringtone: false, callConnect: false});

    // Clear timeouts
    if (peerConnectTimeoutRef.current) {
      clearTimeout(peerConnectTimeoutRef.current);
      peerConnectTimeoutRef.current = null;
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (callRef.current) {
      try {
        debug("Closing call");
        callRef.current.close();
      } catch (err) {
        debug("Error closing call:", err);
      }
      callRef.current = null;
    }

    if (streamRef.current) {
      stopMediaTracks(streamRef.current);
      streamRef.current = null;
    }

    if (peerRef.current) {
      try {
        debug("Destroying peer");
        peerRef.current.destroy();
      } catch (err) {
        debug("Error destroying peer:", err);
      }
      peerRef.current = null;
    }

    if (socket && remoteUserId && !hangupProcessedRef.current) {
      try {
        debug("Emitting videoHangup signal");
        socket.emit("videoHangup", {
          recipientId: remoteUserId,
          userId: user._id,
          timestamp: Date.now(),
        });
      } catch (err) {
        debug("Error sending hangup signal:", err);
      }
    }

    setConnectionStatus("disconnected");

    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  const handleHangup = () => {
    debug("Hangup button clicked");
    hangupProcessedRef.current = true; // Mark as processed to avoid duplicate processing
    endCall();
    onClose && onClose();
  };

  const toggleAudioMute = () => {
    if (streamRef.current) {
      try {
        toggleTracks(streamRef.current, "audio", isAudioMuted);
        setIsAudioMuted(!isAudioMuted);
        debug("Toggling audio mute. New state:", !isAudioMuted);
        if (socket) {
          socket.emit("videoMediaControl", {
            recipientId: remoteUserId,
            type: "audio",
            muted: !isAudioMuted,
            userId: user._id,
          });
        }
      } catch (err) {
        debug("Error toggling audio mute:", err);
        toast.error("Failed to change audio state");
      }
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      try {
        toggleTracks(streamRef.current, "video", isVideoOff);
        setIsVideoOff(!isVideoOff);
        debug("Toggling video. New state:", !isVideoOff);
        if (socket) {
          socket.emit("videoMediaControl", {
            recipientId: remoteUserId,
            type: "video",
            muted: !isVideoOff,
            userId: user._id,
          });
        }
      } catch (err) {
        debug("Error toggling video:", err);
        toast.error("Failed to change video state");
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current && containerRef.current.requestFullscreen) {
        containerRef.current
          .requestFullscreen()
          .then(() => {
            debug("Entered fullscreen");
            setIsFullscreen(true);
          })
          .catch((err) => {
            debug("Fullscreen error:", err);
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
            debug("Exited fullscreen");
            setIsFullscreen(false);
          })
          .catch((err) => {
            debug("Exit fullscreen error:", err);
            toast.error("Failed to exit fullscreen mode");
          });
      }
    }
  };

  const retryConnection = () => {
    debug("Manually retrying connection");
    setConnectionAttempts(prev => prev + 1);

    // Close existing call if any
    if (callRef.current) {
      callRef.current.close();
      callRef.current = null;
    }

    // Reconnect peer if disconnected
    if (peerRef.current && peerRef.current.disconnected) {
      peerRef.current.reconnect();
    }

    // If initiator and we have remote peer ID, try calling again
    if (isInitiator && remotePeerId && streamRef.current && peerRef.current) {
      debug("Retrying call to remote peer:", remotePeerId);
      setConnectionStatus("connecting");

      setTimeout(() => {
        try {
          const call = peerRef.current.call(remotePeerId, streamRef.current);
          if (!call) {
            debug("Failed to create call on retry");
            return;
          }
          callRef.current = call;
          setupCallHandlers(call);
        } catch (err) {
          debug("Error during retry:", err);
        }
      }, 1000);
    } else {
      debug("Cannot retry: missing required data", {
        isInitiator, remotePeerId, hasStream: !!streamRef.current, hasPeer: !!peerRef.current
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      debug("Fullscreen change event. Fullscreen active:", !!document.fullscreenElement);
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (connectionStatus === "error" && remotePeerId && peerRef.current) {
      debug("Attempting to reconnect after error...");

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }

      reconnectTimerRef.current = setTimeout(() => {
        try {
          if (peerRef.current && peerRef.current.disconnected) {
            debug("Peer is disconnected, attempting reconnect...");
            peerRef.current.reconnect();
          }

          if (isInitiator && streamRef.current && remotePeerId && connectionAttempts < 3) {
            debug("Initiator retrying call to:", remotePeerId);
            setConnectionAttempts(prev => prev + 1);
            setConnectionStatus("connecting");

            const call = peerRef.current.call(remotePeerId, streamRef.current);
            if (call) {
              callRef.current = call;
              setupCallHandlers(call);
            }
          }
        } catch (err) {
          debug("Error during reconnection attempt:", err);
        }
      }, RECONNECT_DELAY);
    }
  }, [connectionStatus, remotePeerId, isInitiator, connectionAttempts]);

  return (
    <div className="video-call-container" ref={containerRef}>
      {/* Call sounds component */}
      <CallSounds
        isPlaying={playSounds.ringtone}
        sound="ringtone"
        loop={true}
      />
      <CallSounds
        isPlaying={playSounds.callConnect}
        sound="callConnect"
        loop={false}
      />

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
          <video
            ref={remoteVideoRef}
            className="remote-video"
            autoPlay
            playsInline
          />
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

        <button
          className="control-btn hangup-btn"
          onClick={handleHangup}
          title="End Call"
        >
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
            <button onClick={retryConnection} className="retry-btn">
              <FaSync /> Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoCall;
