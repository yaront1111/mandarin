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

const CALL_SETUP_DELAY = 1000;
const PEER_CONNECT_TIMEOUT = 20000;
const CONNECTION_PROGRESS_CLEAR_TIMEOUT = 5000;
const HANGUP_DELAY = 2000;
const RECONNECT_DELAY = 3000;
const GLOBAL_TIMEOUT = 45045; // slightly over 45s to allow some buffer
const ICE_SERVER_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.stunprotocol.org:3478" },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:80?transport=tcp",
        "turn:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

const toggleTracks = (stream, trackType, enabled) => {
  if (!stream) return;
  const tracks =
    trackType === "audio" ? stream.getAudioTracks() : stream.getVideoTracks();
  tracks.forEach((track) => {
    track.enabled = enabled;
  });
};

const stopMediaTracks = (stream) => {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch (error) {}
  });
};

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
  // State variables
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

  // Sound state flags
  const [playSounds, setPlaySounds] = useState({
    ringtone: isInitiator,
    callConnect: false,
    callEnd: false,
  });

  // Flag to prevent duplicate hangup processing
  const [userInitiated, setUserInitiated] = useState(false);

  // Refs
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
  const globalTimeoutRef = useRef(null);
  const initializedRef = useRef(false);
  const soundTimeoutRef = useRef(null);

  // Web Audio API refs (for potential future use)
  const audioContextRef = useRef(null);
  const callEndSoundPlayedRef = useRef(false);

  // Initialize Web Audio API to unlock audio on user interaction
  useEffect(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current =
          new (window.AudioContext || window.webkitAudioContext)();
      }
      const unlockAudioContext = () => {
        if (audioContextRef.current && audioContextRef.current.state === "suspended") {
          audioContextRef.current.resume();
        }
      };
      document.addEventListener("click", unlockAudioContext);
      document.addEventListener("touchstart", unlockAudioContext);
      return () => {
        document.removeEventListener("click", unlockAudioContext);
        document.removeEventListener("touchstart", unlockAudioContext);
      };
    } catch (err) {
      console.warn("Web Audio API initialization failed:", err);
    }
  }, []);

  // Reset callEnd sound flag after playing
  useEffect(() => {
    if (playSounds.callEnd) {
      if (soundTimeoutRef.current) clearTimeout(soundTimeoutRef.current);
      soundTimeoutRef.current = setTimeout(() => {
        setPlaySounds(prev => ({ ...prev, callEnd: false }));
      }, 3000);
      return () => {
        if (soundTimeoutRef.current) clearTimeout(soundTimeoutRef.current);
      };
    }
  }, [playSounds.callEnd]);

  useEffect(() => {
    if (initializedRef.current) return;
    if (!user || !user._id || !remoteUserId) {
      setConnectionStatus("error");
      onError && onError(new Error("Missing required user information for video call"));
      return;
    }
    if (!socket) {
      setConnectionStatus("error");
      onError && onError(new Error("Socket connection required for video calls"));
      return;
    }
    globalTimeoutRef.current = setTimeout(() => {
      if (connectionStatus !== "connected") {
        setConnectionStatus("error");
        onError &&
          onError(new Error("Call setup timed out. Please try again later."));
        if (callRef.current) {
          try {
            callRef.current.close();
          } catch (e) {}
          callRef.current = null;
        }
      }
    }, GLOBAL_TIMEOUT);
    startCall();
    // Reset call end sound flag when starting a call
    callEndSoundPlayedRef.current = false;
    initializedRef.current = true;
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    const unlockAudio = () => {
      // For further handling if needed
    };
    document.addEventListener("click", unlockAudio);
    document.addEventListener("touchstart", unlockAudio);
    return () => {
      endCall();
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      if (peerConnectTimeoutRef.current) clearTimeout(peerConnectTimeoutRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (globalTimeoutRef.current) clearTimeout(globalTimeoutRef.current);
      if (soundTimeoutRef.current) clearTimeout(soundTimeoutRef.current);
      document.removeEventListener("click", unlockAudio);
      document.removeEventListener("touchstart", unlockAudio);
    };
  }, []);

  const handleMediaControl = useCallback(
    (data) => {
      if (data.userId === remoteUserId) {
        if (data.type === "audio") setIsRemoteAudioMuted(data.muted);
        else if (data.type === "video") setIsRemoteVideoOff(data.muted);
      }
    },
    [remoteUserId]
  );

  const handleHangupSocket = useCallback(
    (data) => {
      if (hangupProcessedRef.current) return;
      if (data.userId === remoteUserId) {
        hangupProcessedRef.current = true;
        setPlaySounds({ ringtone: false, callConnect: false, callEnd: true });
        toast.info(`${remoteName} ended the call`);
        setTimeout(() => {
          onClose && onClose();
        }, HANGUP_DELAY);
      }
    },
    [remoteUserId, remoteName, onClose]
  );

  const handlePeerIdReceived = useCallback(
    (data) => {
      if (peerConnectTimeoutRef.current) {
        clearTimeout(peerConnectTimeoutRef.current);
        peerConnectTimeoutRef.current = null;
      }
      if (remotePeerId) return;
      const fromUserId = data.from?.userId || data.userId;
      if (fromUserId !== remoteUserId) return;
      const remoteId = data.peerId;
      if (!remoteId) return;
      setRemotePeerId(remoteId);
      hangupProcessedRef.current = false;
      if (isInitiator) {
        setPlaySounds({ ringtone: true, callConnect: false, callEnd: false });
        setTimeout(() => {
          if (peerRef.current && peerRef.current.disconnected) {
            peerRef.current.reconnect();
          }
          if (callRef.current) return;
          if (!peerRef.current) return;
          if (!streamRef.current) {
            onError && onError(new Error("Local stream not available"));
            return;
          }
          try {
            const call = peerRef.current.call(remoteId, streamRef.current);
            if (!call) {
              onError && onError(new Error("Failed to create peer connection"));
              return;
            }
            callRef.current = call;
            setupCallHandlers(call);
            if (peerConnectTimeoutRef.current) clearTimeout(peerConnectTimeoutRef.current);
            peerConnectTimeoutRef.current = setTimeout(() => {
              if (connectionStatus !== "connected") {
                if (callRef.current) {
                  callRef.current.close();
                  callRef.current = null;
                }
                if (connectionAttempts < 3) {
                  setConnectionAttempts((c) => c + 1);
                  setTimeout(() => {
                    handlePeerIdReceived(data);
                  }, 1000);
                } else {
                  setConnectionStatus("error");
                  onError &&
                    onError(
                      new Error("Failed to establish connection after multiple attempts")
                    );
                }
              }
            }, PEER_CONNECT_TIMEOUT);
          } catch (err) {
            onError && onError(err);
          }
        }, CALL_SETUP_DELAY);
      } else {
        setPlaySounds({ ringtone: true, callConnect: false, callEnd: false });
        if (peerConnectTimeoutRef.current) clearTimeout(peerConnectTimeoutRef.current);
        peerConnectTimeoutRef.current = setTimeout(() => {
          if (connectionStatus !== "connected") {
            setConnectionStatus("error");
            onError &&
              onError(new Error("Timed out waiting for incoming call"));
          }
        }, PEER_CONNECT_TIMEOUT);
      }
    },
    [
      isInitiator,
      onError,
      remoteUserId,
      remotePeerId,
      connectionStatus,
      connectionAttempts,
    ]
  );

  useEffect(() => {
    if (!socket) return;
    socket.off("videoMediaControl");
    socket.off("videoHangup");
    socket.off("peerIdExchange");
    socket.on("videoMediaControl", handleMediaControl);
    socket.on("videoHangup", handleHangupSocket);
    socket.on("peerIdExchange", handlePeerIdReceived);
    return () => {
      socket.off("videoMediaControl", handleMediaControl);
      socket.off("videoHangup", handleHangupSocket);
      socket.off("peerIdExchange", handlePeerIdReceived);
    };
  }, [socket, handleMediaControl, handleHangupSocket, handlePeerIdReceived]);

  const startCall = async () => {
    try {
      if (!socket) {
        setConnectionStatus("error");
        onError && onError(new Error("Socket connection required for video calls"));
        return;
      }
      connectionInProgressRef.current = true;
      if (peerRef.current) return;
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
          audio: true,
        });
        streamRef.current = mediaStream;
        setStream(mediaStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
        }
      } catch (mediaError) {
        try {
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          streamRef.current = audioOnlyStream;
          setStream(audioOnlyStream);
          setIsVideoOff(true);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = audioOnlyStream;
          }
        } catch (audioError) {
          throw audioError;
        }
      }
      // Reset the call end sound flag for new calls
      callEndSoundPlayedRef.current = false;
      const peerId = `${user._id}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      const peerInstance = new Peer(peerId, {
        debug: 2,
        config: {
          iceServers: ICE_SERVER_CONFIG.iceServers,
          sdpSemantics: "unified-plan",
        },
        host: window.location.hostname,
        port: 9000,
        path: "/peerjs",
        secure: window.location.protocol === "https:",
      });
      peerRef.current = peerInstance;
      peerInstance.on("open", (id) => {
        setConnectionStatus("connecting");
        if (socket) {
          socket.emit("peerIdExchange", {
            recipientId: remoteUserId,
            peerId: id,
            from: { userId: user._id, name: user.nickname || "User" },
          });
        } else {
          setConnectionStatus("error");
          onError && onError(new Error("Socket connection not available for signaling"));
        }
      });
      peerInstance.on("connect_error", (error) => {
        connectionInProgressRef.current = false;
        setConnectionStatus("error");
        onError && onError(new Error(`Connection error: ${error.message}`));
      });
      peerInstance.on("error", (err) => {
        toast.error(`Connection error: ${err.type}`);
        setConnectionStatus("error");
        onError && onError(err);
      });
      peerInstance.on("disconnected", () => {
        if (connectionStatus === "connected" && !hangupProcessedRef.current && peerRef.current) {
          setTimeout(() => {
            try {
              peerRef.current.reconnect();
            } catch (e) {
              setConnectionStatus("error");
            }
          }, 1000);
        }
      });
      peerInstance.on("reconnect", (reconnectId) => {
        if (callRef.current && callRef.current.open) {
          // Already connected
        } else if (remotePeerId && isInitiator) {
          try {
            const call = peerRef.current.call(remotePeerId, streamRef.current);
            if (call) {
              callRef.current = call;
              setupCallHandlers(call);
            }
          } catch (err) {}
        }
      });
      peerInstance.on("close", () => {
        if (!hangupProcessedRef.current) {
          setConnectionStatus("disconnected");
        }
      });
      peerInstance.on("call", (call) => {
        if (callRef.current) return;
        if (peerConnectTimeoutRef.current) {
          clearTimeout(peerConnectTimeoutRef.current);
          peerConnectTimeoutRef.current = null;
        }
        callRef.current = call;
        hangupProcessedRef.current = false;
        call.answer(streamRef.current);
        setupCallHandlers(call);
        setPlaySounds({ ringtone: false, callConnect: true, callEnd: false });
      });
    } catch (err) {
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
    if (!call) return;
    call.on("stream", (remoteStream) => {
      connectionInProgressRef.current = false;
      if (peerConnectTimeoutRef.current) {
        clearTimeout(peerConnectTimeoutRef.current);
        peerConnectTimeoutRef.current = null;
      }
      if (globalTimeoutRef.current) {
        clearTimeout(globalTimeoutRef.current);
        globalTimeoutRef.current = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        const playPromise = remoteVideoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            const resumeVideo = () => {
              remoteVideoRef.current.play().catch(() => {});
              document.removeEventListener('click', resumeVideo);
            };
            document.addEventListener('click', resumeVideo, { once: true });
          });
        }
        setTimeout(() => {
          if (remoteStream.active) {
            setPlaySounds(prev => ({ ...prev, ringtone: false, callConnect: true }));
          }
        }, 500);
      }
      setConnectionStatus("connected");
      toast.success(`Connected to ${remoteName}`);
    });
    call.on("close", () => {
      setConnectionStatus("disconnected");
      connectionInProgressRef.current = false;
      if (!hangupProcessedRef.current) {
        setPlaySounds({ ringtone: false, callConnect: false, callEnd: true });
      }
    });
    call.on("error", (err) => {
      setConnectionStatus("error");
      connectionInProgressRef.current = false;
      onError && onError(err);
    });
  };

  // Updated endCall without synthetic oscillator sounds
  const endCall = () => {
    connectionInProgressRef.current = false;
    setPlaySounds({ ringtone: false, callConnect: false, callEnd: false });
    if (peerConnectTimeoutRef.current) {
      clearTimeout(peerConnectTimeoutRef.current);
      peerConnectTimeoutRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (globalTimeoutRef.current) {
      clearTimeout(globalTimeoutRef.current);
      globalTimeoutRef.current = null;
    }
    if (callRef.current) {
      try {
        callRef.current.close();
      } catch (err) {}
      callRef.current = null;
    }
    if (streamRef.current) {
      stopMediaTracks(streamRef.current);
      streamRef.current = null;
    }
    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch (err) {}
      peerRef.current = null;
    }
    setConnectionStatus("disconnected");
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  // Prevent duplicate hangup processing
  const handleHangup = () => {
    if (userInitiated) return;
    setUserInitiated(true);
    // Remove synthetic oscillator sound here—rely solely on CallSounds.
    setPlaySounds({ ringtone: false, callConnect: false, callEnd: true });
    if (socket && remoteUserId) {
      try {
        socket.emit("videoHangup", {
          recipientId: remoteUserId,
          userId: user._id,
          timestamp: Date.now(),
        });
      } catch (err) {}
    }
    setTimeout(() => {
      endCall();
      onClose && onClose();
    }, HANGUP_DELAY);
  };

  const toggleAudioMute = () => {
    if (streamRef.current) {
      try {
        toggleTracks(streamRef.current, "audio", isAudioMuted);
        setIsAudioMuted(!isAudioMuted);
        if (socket) {
          socket.emit("videoMediaControl", {
            recipientId: remoteUserId,
            type: "audio",
            muted: !isAudioMuted,
            userId: user._id,
          });
        }
      } catch (err) {
        toast.error("Failed to change audio state");
      }
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      try {
        toggleTracks(streamRef.current, "video", isVideoOff);
        setIsVideoOff(!isVideoOff);
        if (socket) {
          socket.emit("videoMediaControl", {
            recipientId: remoteUserId,
            type: "video",
            muted: !isVideoOff,
            userId: user._id,
          });
        }
      } catch (err) {
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
            setIsFullscreen(true);
          })
          .catch(() => {
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
            setIsFullscreen(false);
          })
          .catch(() => {
            toast.error("Failed to exit fullscreen mode");
          });
      }
    }
  };

  const retryConnection = () => {
    setConnectionAttempts((prev) => prev + 1);
    if (callRef.current) {
      callRef.current.close();
      callRef.current = null;
    }
    if (peerRef.current && peerRef.current.disconnected) {
      peerRef.current.reconnect();
    }
    if (connectionAttempts >= 2) {
      if (peerRef.current) {
        try {
          peerRef.current.destroy();
        } catch (e) {}
        peerRef.current = null;
      }
      const fallbackPeerId = `${user._id}-fallback-${Date.now()}`;
      const fallbackPeer = new Peer(fallbackPeerId, {
        debug: 3,
        config: {
          iceServers: ICE_SERVER_CONFIG.iceServers,
          iceTransportPolicy: "relay",
          iceCandidatePoolSize: 15,
        },
        secure: window.location.protocol === "https:",
        host: window.location.hostname,
        port: 9000,
        path: "/peerjs",
      });
      peerRef.current = fallbackPeer;
      fallbackPeer.on("open", (id) => {
        setConnectionStatus("connecting");
        socket.emit("peerIdExchange", {
          recipientId: remoteUserId,
          peerId: id,
          from: { userId: user._id, name: user.nickname || "User" },
          isFallback: true,
        });
      });
      fallbackPeer.on("error", (err) => {
        setConnectionStatus("error");
        onError && onError(err);
      });
      fallbackPeer.on("call", (call) => {
        callRef.current = call;
        call.answer(streamRef.current);
        setupCallHandlers(call);
      });
      return;
    }
    if (isInitiator && remotePeerId && streamRef.current && peerRef.current) {
      setConnectionStatus("connecting");
      setTimeout(() => {
        try {
          const call = peerRef.current.call(remotePeerId, streamRef.current);
          if (!call) return;
          callRef.current = call;
          setupCallHandlers(call);
        } catch (err) {}
      }, 1000);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (connectionStatus === "error" && remotePeerId && peerRef.current) {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        try {
          if (peerRef.current && peerRef.current.disconnected) {
            peerRef.current.reconnect();
          }
          if (isInitiator && streamRef.current && remotePeerId && connectionAttempts < 3) {
            setConnectionAttempts((prev) => prev + 1);
            setConnectionStatus("connecting");
            const call = peerRef.current.call(remotePeerId, streamRef.current);
            if (call) {
              callRef.current = call;
              setupCallHandlers(call);
            }
          }
        } catch (err) {}
      }, RECONNECT_DELAY);
    }
  }, [connectionStatus, remotePeerId, isInitiator, connectionAttempts]);

  return (
    <div className="video-call-container" ref={containerRef}>
      {playSounds.ringtone && (
        <CallSounds isPlaying={true} sound="ringtone" loop={true} volume={1.0} />
      )}
      {playSounds.callConnect && (
        <CallSounds isPlaying={true} sound="callConnect" loop={false} volume={1.0} />
      )}
      {playSounds.callEnd && (
        <CallSounds isPlaying={true} sound="callEnd" loop={false} volume={1.0} />
      )}
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
          <video ref={localVideoRef} className="local-video" autoPlay playsInline muted />
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
