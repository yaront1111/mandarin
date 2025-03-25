import React, { useEffect, useRef, useState } from "react";
import Peer from "peerjs";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaPhoneSlash,
  FaExpandAlt,
  FaCompress,
  FaVolumeMute,
  FaVolumeUp,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { useAuth } from "../context";

/**
 * VideoCall component using PeerJS
 */
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

  const { user } = useAuth();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const callRef = useRef(null);
  const callTimerRef = useRef(null);
  const containerRef = useRef(null);

  // Initialize the call when component mounts
  useEffect(() => {
    startCall();

    // Set up timer for call duration
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    // Clean up when component unmounts
    return () => {
      endCall();
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, []);

  // Set up socket event listeners for call control signals
  useEffect(() => {
    if (!socket) return;

    // Handle media control events
    const handleMediaControl = (data) => {
      if (data.userId === remoteUserId) {
        if (data.type === "audio") {
          setIsRemoteAudioMuted(data.muted);
        } else if (data.type === "video") {
          setIsRemoteVideoOff(data.muted);
        }
      }
    };

    // Handle call hang up
    const handleHangup = (data) => {
      if (data.userId === remoteUserId) {
        toast.info(`${remoteName} ended the call`);
        onClose();
      }
    };

    // Add event listeners
    socket.on("videoMediaControl", handleMediaControl);
    socket.on("videoHangup", handleHangup);

    // Clean up event listeners
    return () => {
      socket.off("videoMediaControl", handleMediaControl);
      socket.off("videoHangup", handleHangup);
    };
  }, [socket, remoteUserId, remoteName]);

  // Format call duration
  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Initialize video call
  const startCall = async () => {
    try {
      // Request user media (camera and microphone)
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);

      // Display local video stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = mediaStream;
      }

      // Generate a unique ID for this peer
      const peerId = `${user._id}-${Date.now()}`;

      // Initialize PeerJS
      const peerInstance = new Peer(peerId, {
        debug: 2, // Log level
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:global.stun.twilio.com:3478" },
          ],
        }
      });

      peerRef.current = peerInstance;

      // Handle peer open event
      peerInstance.on("open", (id) => {
        console.log("PeerJS connection established with ID:", id);
        setConnectionStatus("connecting");

        // Send peer ID to remote user via signaling server
        socket.emit("peerIdExchange", {
          recipientId: remoteUserId,
          peerId: id,
          from: {
            userId: user._id,
            name: user.nickname || "User"
          }
        });

        // If initiator, wait for remote peer ID and call
        if (isInitiator) {
          // Handle peer ID from remote user
          const handlePeerIdReceived = (data) => {
            if (data.userId === remoteUserId) {
              const remotePeerId = data.peerId;
              console.log("Received remote peer ID:", remotePeerId);

              // Make the call to remote peer
              const call = peerInstance.call(remotePeerId, mediaStream);
              callRef.current = call;

              // Set up call event handlers
              setupCallHandlers(call);
            }
          };

          socket.on("peerIdExchange", handlePeerIdReceived);

          // Clean up event listener
          setTimeout(() => {
            socket.off("peerIdExchange", handlePeerIdReceived);
          }, 30000);  // Remove listener after 30 seconds
        }
      });

      // Handle incoming calls (non-initiator)
      peerInstance.on("call", (call) => {
        console.log("Incoming call received");
        callRef.current = call;

        // Answer the call with our stream
        call.answer(mediaStream);

        // Set up call event handlers
        setupCallHandlers(call);
      });

      // Handle errors
      peerInstance.on("error", (err) => {
        console.error("PeerJS error:", err);
        toast.error(`Connection error: ${err.type}`);
        setConnectionStatus("error");

        if (onError) {
          onError(err);
        }
      });

    } catch (err) {
      console.error("Error starting video call:", err);
      toast.error(err.message || "Couldn't access camera or microphone");
      setConnectionStatus("error");

      if (onError) {
        onError(err);
      }
    }
  };

  // Set up call event handlers
  const setupCallHandlers = (call) => {
    // Handle remote stream
    call.on("stream", (remoteStream) => {
      console.log("Received remote stream");

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }

      setConnectionStatus("connected");
      toast.success(`Connected to ${remoteName}`);
    });

    // Handle call close
    call.on("close", () => {
      console.log("Call closed");
      setConnectionStatus("disconnected");
    });

    // Handle call errors
    call.on("error", (err) => {
      console.error("Call error:", err);
      setConnectionStatus("error");

      if (onError) {
        onError(err);
      }
    });
  };

  // End the call and clean up resources
  const endCall = () => {
    // Close the call
    if (callRef.current) {
      callRef.current.close();
      callRef.current = null;
    }

    // Stop media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Close peer connection
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    // Notify the remote user
    if (socket && remoteUserId) {
      socket.emit("videoHangup", {
        recipientId: remoteUserId,
        userId: user._id,
      });
    }

    setConnectionStatus("disconnected");

    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
  };

  // Handle hanging up the call
  const handleHangup = () => {
    endCall();
    onClose();
  };

  // Toggle audio mute
  const toggleAudioMute = () => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = isAudioMuted;
      });
      setIsAudioMuted(!isAudioMuted);

      // Notify remote peer
      if (socket) {
        socket.emit("videoMediaControl", {
          recipientId: remoteUserId,
          type: "audio",
          muted: !isAudioMuted,
          userId: user._id
        });
      }
    }
  };

  // Toggle video off/on
  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTracks = streamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = isVideoOff;
      });
      setIsVideoOff(!isVideoOff);

      // Notify remote peer
      if (socket) {
        socket.emit("videoMediaControl", {
          recipientId: remoteUserId,
          type: "video",
          muted: !isVideoOff,
          userId: user._id
        });
      }
    }
  };

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen()
          .then(() => setIsFullscreen(true))
          .catch(err => console.error("Fullscreen error:", err));
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
          .then(() => setIsFullscreen(false))
          .catch(err => console.error("Exit fullscreen error:", err));
      }
    }
  };

  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

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
            <button onClick={startCall} className="retry-btn">Retry</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoCall;
