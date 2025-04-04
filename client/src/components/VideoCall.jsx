import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaPhoneSlash,
  FaExpandAlt,
  FaCompressAlt,
  FaSpinner,
  FaUndo,
  FaSignal,
  FaExclamationTriangle
} from "react-icons/fa";
import socketService from "../services/socketService.jsx";
import { toast } from "react-toastify";
import { logger } from "../utils";

const log = logger.create("VideoCall");

// --- Configuration Constants ---
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.stunprotocol.org:3478" },
  { urls: "stun:stun.voip.blackberry.com:3478" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  // TURN servers for production - Replace with your actual TURN servers
  {
    urls: "turn:turn.example.org:3478",
    username: "turnuser",
    credential: "turnpassword"
  },
  {
    urls: "turn:turn.example.org:443?transport=tcp", // TCP fallback
    username: "turnuser",
    credential: "turnpassword"
  }
];

const PEER_CONNECTION_CONFIG = {
  iceServers: ICE_SERVERS,
  iceCandidatePoolSize: 10,
  iceTransportPolicy: "all", // Consider "relay" for TURN-only in challenging networks
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
  sdpSemantics: "unified-plan",
};

const VIDEO_CONSTRAINTS = {
  width: { ideal: 640, max: 1280 },
  height: { ideal: 480, max: 720 },
  frameRate: { ideal: 24, max: 30 },
};

const AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

const MAX_RETRY_COUNT = 3;
const SIGNALLING_TIMEOUT = 20000; // 20 seconds
const CONNECTION_TIMEOUT = 30000; // 30 seconds
const RECONNECT_DELAY = 2000; // 2 seconds
const STATS_INTERVAL = 5000; // 5 seconds
const AUDIO_METER_INTERVAL = 100; // 100ms for audio level updates
const UNANSWERED_CALL_TIMEOUT = 45000; // 45 seconds for unanswered calls

// --- Helper Functions ---
const getCandidateFingerprint = (candidate) => {
  if (!candidate) return "";
  if (typeof candidate === "string") return candidate;
  return [candidate.candidate, candidate.sdpMid, candidate.sdpMLineIndex].join("|");
};

const getSignalId = (signal) => {
  if (!signal || !signal.type) return `invalid-${Date.now()}`;
  if (signal.type === "ice-candidate") {
    return `ice-${getCandidateFingerprint(signal.candidate)}`;
  } else if (signal.type === "offer" || signal.type === "answer") {
    // Use SDP fingerprint for uniqueness
    const sdpFingerprint = signal.sdp?.sdp?.slice(0, 150) || signal.sdp?.slice(0, 150) || "";
    return `${signal.type}-${sdpFingerprint}`;
  }
  return `${signal.type}-${Date.now()}`;
};

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const getConnectionQuality = (peerConnection) => {
  if (!peerConnection) return "unknown";

  const iceState = peerConnection.iceConnectionState;
  const connState = peerConnection.connectionState;

  if (connState === "failed" || iceState === "failed") return "poor";
  if (connState === "disconnected" || iceState === "disconnected") return "poor";
  if (connState === "connecting" || iceState === "checking") return "fair";
  if (connState === "connected" && iceState === "connected") return "good";
  if (connState === "connected" && iceState === "completed") return "excellent";

  return "unknown";
};

const formatErrorMessage = (error) => {
  if (!error) return null;

  // Simple string contains check
  if (typeof error === "string") {
    if (error.includes("Permission denied")) {
      return "Camera or microphone access was denied. Please check browser permissions.";
    }
    if (error.includes("NotFoundError") || error.includes("Devices not found")) {
      return "Camera or microphone not found. Please check if they are connected and enabled.";
    }
    if (error.includes("timed out")) {
      return "Connection timed out. The other user may be offline.";
    }
    if (error.includes("Could not access")) {
      return "Unable to access camera or microphone. Please check connections and browser permissions.";
    }
    if (error.includes("multiple attempts")) {
      return "Connection failed after several attempts. Please check your network or try again later.";
    }
    if (error.includes("Failed to set remote answer sdp: Called in wrong state")) {
      return "Connection synchronization error. Attempting to recover...";
    }
    if (error.includes("Failed to execute 'addIceCandidate'")) {
      return "Network negotiation issue occurred. Attempting to continue...";
    }
    if (error.includes("No answer")) {
      return "No answer from the recipient. They may be away or unable to accept calls right now.";
    }
  }

  return `An unexpected error occurred${error ? `: ${error.toString().split(":")[0]}` : ""}. Please try again.`;
};

// Canvas visualization helper functions
const drawConnectionQuality = (canvas, quality) => {
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Set colors based on quality
  let color = "#aaaaaa"; // unknown - gray
  let barCount = 0;

  switch(quality) {
    case "excellent":
      color = "#4caf50"; // green
      barCount = 4;
      break;
    case "good":
      color = "#8bc34a"; // light green
      barCount = 3;
      break;
    case "fair":
      color = "#ffc107"; // yellow
      barCount = 2;
      break;
    case "poor":
      color = "#f44336"; // red
      barCount = 1;
      break;
    default:
      barCount = 0;
  }

  // Draw bars
  const barWidth = Math.floor(canvas.width / 5);
  const barMargin = Math.floor(barWidth / 4);
  const fullWidth = barWidth - barMargin;

  ctx.fillStyle = color;

  for (let i = 0; i < 4; i++) {
    const height = Math.floor(canvas.height * (0.4 + (i * 0.2)));
    const x = i * barWidth;
    const y = canvas.height - height;

    // Draw filled or empty bar
    if (i < barCount) {
      ctx.fillRect(x, y, fullWidth, height);
    } else {
      ctx.strokeStyle = "#888888";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, fullWidth, height);
    }
  }
};

const drawAudioLevel = (canvas, level) => {
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Normalize level to 0-1
  const normalizedLevel = Math.min(1, Math.max(0, level));

  // Draw gradient background
  const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
  gradient.addColorStop(0, "#4caf50");    // Green at bottom
  gradient.addColorStop(0.5, "#ffeb3b");  // Yellow in middle
  gradient.addColorStop(1, "#f44336");    // Red at top

  ctx.fillStyle = gradient;

  // Draw meter
  const height = Math.round(canvas.height * normalizedLevel);
  ctx.fillRect(0, canvas.height - height, canvas.width, height);

  // Draw level ticks
  ctx.fillStyle = "#222";
  for (let i = 0; i <= 10; i++) {
    const y = canvas.height - (i * canvas.height / 10);
    const tickWidth = i % 5 === 0 ? 10 : 5;
    ctx.fillRect(0, y, tickWidth, 1);
  }
};

const drawPlaceholderVideo = (canvas, text) => {
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw dark background
  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw text
  ctx.fillStyle = "#fff";
  ctx.font = "20px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text || "Video Off", canvas.width / 2, canvas.height / 2);

  // Draw camera icon
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  const iconSize = 50;
  const x = (canvas.width - iconSize) / 2;
  const y = (canvas.height - iconSize) / 2 - 40;

  // Simple camera shape
  ctx.beginPath();
  ctx.rect(x, y, iconSize, iconSize * 0.7);
  ctx.stroke();

  // Lens
  ctx.beginPath();
  ctx.arc(x + iconSize/2, y + iconSize*0.35, iconSize*0.25, 0, Math.PI * 2);
  ctx.stroke();

  // Diagonal line for "camera off"
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 5);
  ctx.lineTo(x + iconSize + 5, y + iconSize * 0.7 + 5);
  ctx.stroke();
};

// VideoCall Component
const VideoCall = ({
  isActive,
  userId,
  recipientId,
  onEndCall,
  isIncoming = false,
  callId = null,
  recipientName = "User", // Add recipient name for better UX
}) => {
  // --- Refs ---
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const qualityCanvasRef = useRef(null);
  const localAudioCanvasRef = useRef(null);
  const remoteAudioCanvasRef = useRef(null);
  const localPlaceholderRef = useRef(null);
  const remotePlaceholderRef = useRef(null);

  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const audioAnalyserRef = useRef(null);
  const audioDataRef = useRef(null);
  const remoteAudioAnalyserRef = useRef(null);
  const remoteAudioDataRef = useRef(null);

  const signallingTimeoutRef = useRef(null);
  const connectionTimeoutRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const candidateFlushTimeoutRef = useRef(null);
  const statsIntervalRef = useRef(null);
  const audioMeterIntervalRef = useRef(null);
  const unansweredCallTimeoutRef = useRef(null);

  // Queues & State Tracking
  const iceCandidateQueueRef = useRef([]);
  const processedCandidatesRef = useRef(new Set());
  const processedSignalsRef = useRef(new Set());
  const incomingSignalQueueRef = useRef([]);
  const negotiationInProgressRef = useRef(false);
  const isMountedRef = useRef(false);
  const connectionCompletedRef = useRef(false);
  const callAnsweredRef = useRef(false);

  // --- State ---
  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isLocalMuted, setIsLocalMuted] = useState(false);
  const [isLocalVideoOff, setIsLocalVideoOff] = useState(false);
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  const [isRemoteVideoOff, setIsRemoteVideoOff] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [connectionQuality, setConnectionQuality] = useState("unknown");
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [remoteAudioLevel, setRemoteAudioLevel] = useState(0);
  const [videoStats, setVideoStats] = useState({
    resolution: "",
    frameRate: 0,
    bitrate: 0
  });
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);

  // --- WebRTC Core Logic ---

  // Initialize local media (camera/microphone)
  const initializeMedia = useCallback(async () => {
    log.debug("Initializing local media...");
    setIsConnecting(true);
    setConnectionError(null);

    // If stream already exists, reuse it
    if (localStreamRef.current) {
      log.debug("Reusing existing media stream.");
      if (localVideoRef.current && localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      // Setup audio visualization for existing stream
      if (!audioAnalyserRef.current && localStreamRef.current.getAudioTracks().length > 0) {
        setupAudioVisualization();
      }

      return;
    }

    try {
      let stream = null;

      try {
        log.debug("Requesting user media with video and audio constraints.");
        stream = await navigator.mediaDevices.getUserMedia({
          video: VIDEO_CONSTRAINTS,
          audio: AUDIO_CONSTRAINTS
        });
        log.debug("Acquired video and audio stream.");
        setIsLocalMuted(false);
        setIsLocalVideoOff(false);
      } catch (err) {
        log.warn(`Media acquisition with audio+video failed: ${err.message}. Trying fallbacks.`);

        // Fallback 1: Video only
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS });
          setIsLocalMuted(true);
          setIsLocalVideoOff(false);
          toast.warning("Microphone access failed. You are muted.");
          log.warn("Acquired video-only stream.");
        } catch (err2) {
          log.warn(`Video-only acquisition failed: ${err2.message}. Trying audio only.`);

          // Fallback 2: Audio only
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
            setIsLocalMuted(false);
            setIsLocalVideoOff(true);
            toast.warning("Camera access failed. Using audio only.");
            log.warn("Acquired audio-only stream.");
          } catch (err3) {
            log.error(`All media acquisition attempts failed: ${err3.message}`);
            throw new Error("Could not access camera or microphone. Check connections & browser permissions.");
          }
        }
      }

      if (!stream) {
        throw new Error("Media stream acquisition failed unexpectedly.");
      }

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true; // Mute local playback to prevent echo

        // If video is disabled, show placeholder canvas
        if (stream.getVideoTracks().length === 0 || !stream.getVideoTracks()[0].enabled) {
          setIsLocalVideoOff(true);
          if (localPlaceholderRef.current) {
            drawPlaceholderVideo(localPlaceholderRef.current, "Camera Off");
          }
        }
      }

      // Setup audio visualization
      if (stream.getAudioTracks().length > 0) {
        setupAudioVisualization();
      }

      log.info("Media initialized successfully.");
    } catch (err) {
      log.error("Media initialization failed:", err);
      setConnectionError(`Media Error: ${err.message}`);
      setIsConnecting(false);
      throw err;
    }
  }, []);

  // Setup audio visualization with Web Audio API
  const setupAudioVisualization = useCallback(() => {
    if (!localStreamRef.current || !localStreamRef.current.getAudioTracks().length) {
      return;
    }

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Local audio analyzer
      const localSource = audioContext.createMediaStreamSource(localStreamRef.current);
      const localAnalyser = audioContext.createAnalyser();
      localAnalyser.fftSize = 256;
      localSource.connect(localAnalyser);

      audioAnalyserRef.current = localAnalyser;
      audioDataRef.current = new Uint8Array(localAnalyser.frequencyBinCount);

      // Remote audio will be set up when remote stream is received

      // Start audio level monitoring
      if (audioMeterIntervalRef.current) {
        clearInterval(audioMeterIntervalRef.current);
      }

      audioMeterIntervalRef.current = setInterval(() => {
        updateAudioLevels();
      }, AUDIO_METER_INTERVAL);

      log.debug("Audio visualization setup complete");
    } catch (err) {
      log.warn("Could not setup audio visualization:", err);
    }
  }, []);

  // Update audio level meters
  const updateAudioLevels = useCallback(() => {
    // Update local audio level
    if (audioAnalyserRef.current && audioDataRef.current && !isLocalMuted) {
      audioAnalyserRef.current.getByteFrequencyData(audioDataRef.current);

      // Calculate average volume level
      const average = Array.from(audioDataRef.current)
        .reduce((sum, value) => sum + value, 0) / audioDataRef.current.length;

      // Normalize to 0-1 range
      const normalizedLevel = average / 255;
      setLocalAudioLevel(normalizedLevel);

      // Draw on canvas
      if (localAudioCanvasRef.current) {
        drawAudioLevel(localAudioCanvasRef.current, normalizedLevel);
      }
    } else if (isLocalMuted && localAudioCanvasRef.current) {
      // Show muted state
      drawAudioLevel(localAudioCanvasRef.current, 0);
      setLocalAudioLevel(0);
    }

    // Update remote audio level
    if (remoteAudioAnalyserRef.current && remoteAudioDataRef.current && !isRemoteMuted) {
      remoteAudioAnalyserRef.current.getByteFrequencyData(remoteAudioDataRef.current);

      // Calculate average volume level
      const average = Array.from(remoteAudioDataRef.current)
        .reduce((sum, value) => sum + value, 0) / remoteAudioDataRef.current.length;

      // Normalize to 0-1 range
      const normalizedLevel = average / 255;
      setRemoteAudioLevel(normalizedLevel);

      // Draw on canvas
      if (remoteAudioCanvasRef.current) {
        drawAudioLevel(remoteAudioCanvasRef.current, normalizedLevel);
      }
    } else if (isRemoteMuted && remoteAudioCanvasRef.current) {
      // Show muted state
      drawAudioLevel(remoteAudioCanvasRef.current, 0);
      setRemoteAudioLevel(0);
    }
  }, [isLocalMuted, isRemoteMuted]);

  // Flush queued remote ICE candidates after remote description is set
  const flushCandidateQueue = useCallback(async () => {
    if (!peerConnectionRef.current) {
      return;
    }

    if (candidateFlushTimeoutRef.current) {
      clearTimeout(candidateFlushTimeoutRef.current);
      candidateFlushTimeoutRef.current = null;
    }

    if (!peerConnectionRef.current.remoteDescription) {
      log.debug("Remote description not set yet, delaying candidate flush");
      candidateFlushTimeoutRef.current = setTimeout(flushCandidateQueue, 500);
      return;
    }

    const queue = [...iceCandidateQueueRef.current];
    iceCandidateQueueRef.current = [];

    if (queue.length > 0) {
      log.debug(`Flushing ${queue.length} queued ICE candidates.`);
    }

    for (const candidate of queue) {
      try {
        const fingerprint = getCandidateFingerprint(candidate);

        if (!processedCandidatesRef.current.has(fingerprint)) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          processedCandidatesRef.current.add(fingerprint);
          log.debug("Added queued ICE candidate:", candidate.candidate?.slice(0, 50));
        } else {
          log.debug("Skipping already processed queued ICE candidate.");
        }
      } catch (err) {
        log.error("Error adding queued ICE candidate:", err);

        if (err.name === "OperationError" || err.message.includes("prerequisite")) {
          iceCandidateQueueRef.current.push(candidate);
        }
      }
    }

    if (iceCandidateQueueRef.current.length > 0 && !candidateFlushTimeoutRef.current) {
      log.warn(`Re-scheduling flush for ${iceCandidateQueueRef.current.length} candidates.`);
      candidateFlushTimeoutRef.current = setTimeout(flushCandidateQueue, 1000);
    }
  }, []);

  // Flush signals that arrived before the peer connection was ready
  const flushIncomingSignalQueue = useCallback(() => {
    if (incomingSignalQueueRef.current.length > 0) {
      log.debug(`Flushing ${incomingSignalQueueRef.current.length} queued incoming signals`);

      const queue = [...incomingSignalQueueRef.current];
      incomingSignalQueueRef.current = [];

      queue.forEach(data => {
        handleVideoSignal(data);
      });
    }
  }, []);

  // Handle local ICE candidates gathering
  const handleICECandidate = useCallback((event) => {
    if (event.candidate && peerConnectionRef.current) {
      const fingerprint = getCandidateFingerprint(event.candidate);

      if (processedCandidatesRef.current.has(fingerprint)) {
        log.debug("Skipping duplicate local ICE candidate.");
        return;
      }

      processedCandidatesRef.current.add(fingerprint);
      log.debug("Gathered local ICE candidate:", event.candidate.candidate?.slice(0, 50));

      socketService.emit("videoSignal", {
        recipientId,
        signal: { type: "ice-candidate", candidate: event.candidate.toJSON() },
        from: { userId, callId },
      });
    } else if (!event.candidate) {
      log.debug("ICE gathering complete for this phase.");
    }
  }, [recipientId, userId, callId]);

  // Handle remote tracks
  const handleRemoteTrack = useCallback((event) => {
    log.debug("Received remote track:", event.track?.kind, "Stream ID:", event.streams[0]?.id);

    try {
      if (!event.streams || event.streams.length === 0) {
        log.warn("Remote track received without a stream.");
        return;
      }

      const stream = event.streams[0];

      // Setup remote audio visualization if it's an audio track
      if (event.track.kind === "audio" && !remoteAudioAnalyserRef.current) {
        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const remoteSource = audioContext.createMediaStreamSource(stream);
          const remoteAnalyser = audioContext.createAnalyser();
          remoteAnalyser.fftSize = 256;
          remoteSource.connect(remoteAnalyser);

          remoteAudioAnalyserRef.current = remoteAnalyser;
          remoteAudioDataRef.current = new Uint8Array(remoteAnalyser.frequencyBinCount);

          log.debug("Remote audio visualization setup complete");
        } catch (err) {
          log.warn("Could not setup remote audio visualization:", err);
        }
      }

      // Attach stream to the remote video element if not already set
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== stream) {
        log.info("Attaching remote stream to video element.");
        remoteVideoRef.current.srcObject = stream;

        // Make sure we mark connection as established
        connectionCompletedRef.current = true;
        callAnsweredRef.current = true;
        setIsConnected(true);
        setIsConnecting(false);
        setIsWaitingForResponse(false);
        setConnectionError(null);
        setRetryCount(0);

        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }

        if (unansweredCallTimeoutRef.current) {
          clearTimeout(unansweredCallTimeoutRef.current);
          unansweredCallTimeoutRef.current = null;
        }

        log.info("Connection established with media stream.");
      }

      // Update remote status based on track's initial muted state
      if (event.track.kind === "audio") {
        const initialMuted = event.track.muted || !event.track.enabled;
        setIsRemoteMuted(initialMuted);

        event.track.onmute = () => {
          log.debug("Remote audio muted");
          setIsRemoteMuted(true);
        };

        event.track.onunmute = () => {
          log.debug("Remote audio unmuted");
          setIsRemoteMuted(false);
        };

        event.track.onended = () => {
          log.warn("Remote audio track ended");
          setIsRemoteMuted(true);
        };
      } else if (event.track.kind === "video") {
        const initialMuted = event.track.muted || !event.track.enabled;
        setIsRemoteVideoOff(initialMuted);

        // If video is disabled, show placeholder
        if (initialMuted && remotePlaceholderRef.current) {
          drawPlaceholderVideo(remotePlaceholderRef.current, "Remote Camera Off");
        }

        event.track.onmute = () => {
          log.debug("Remote video disabled");
          setIsRemoteVideoOff(true);
          if (remotePlaceholderRef.current) {
            drawPlaceholderVideo(remotePlaceholderRef.current, "Remote Camera Off");
          }
        };

        event.track.onunmute = () => {
          log.debug("Remote video enabled");
          setIsRemoteVideoOff(false);
        };

        event.track.onended = () => {
          log.warn("Remote video track ended");
          setIsRemoteVideoOff(true);
          if (remotePlaceholderRef.current) {
            drawPlaceholderVideo(remotePlaceholderRef.current, "Remote Video Ended");
          }
        };
      }
    } catch (err) {
      log.error("Error handling remote track:", err);
    }
  }, []);

  // Handle connection state changes
  const handleConnectionStateChange = useCallback(() => {
    if (!peerConnectionRef.current) return;
    const pc = peerConnectionRef.current;

    log.debug("RTCPeerConnection state changed:", pc.connectionState);
    const quality = getConnectionQuality(pc);
    setConnectionQuality(quality);

    // Update quality canvas
    if (qualityCanvasRef.current) {
      drawConnectionQuality(qualityCanvasRef.current, quality);
    }

    switch (pc.connectionState) {
      case "connected":
        // Force UI update when connection is established
        log.info("Connection state connected - Updating UI");
        connectionCompletedRef.current = true;
        callAnsweredRef.current = true;
        setIsConnected(true);
        setIsConnecting(false);
        setIsWaitingForResponse(false);
        setConnectionError(null);
        negotiationInProgressRef.current = false;
        setRetryCount(0);

        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }

        if (unansweredCallTimeoutRef.current) {
          clearTimeout(unansweredCallTimeoutRef.current);
          unansweredCallTimeoutRef.current = null;
        }

        flushCandidateQueue();
        break;

      case "disconnected":
        log.warn("Connection state disconnected");
        // Don't immediately update UI, wait to see if it recovers
        setTimeout(() => {
          if (isMountedRef.current &&
              peerConnectionRef.current?.connectionState === "disconnected") {
            log.warn("Connection still disconnected after grace period");
            setIsConnected(false);
          }
        }, 3000);
        break;

      case "failed":
        log.error("Connection state failed");
        setIsConnected(false);
        setIsConnecting(false);
        setConnectionError("Connection failed. Please retry.");
        attemptReconnect(createPeerConnection, startSignaling);
        break;

      case "closed":
        log.info("Connection state closed");
        setIsConnected(false);
        setIsConnecting(false);
        break;

      case "connecting":
        log.debug("Connection state connecting");
        if (!isConnected) {
          setIsConnecting(true);
        }
        break;

      case "new":
        log.debug("Connection state new");
        if (!isConnected) {
          setIsConnecting(true);
        }
        break;
    }
  }, [flushCandidateQueue, isConnected]);

  // Handle ICE connection state changes
  const handleICEConnectionStateChange = useCallback(() => {
    if (!peerConnectionRef.current) return;
    const pc = peerConnectionRef.current;

    log.debug("ICE connection state changed:", pc.iceConnectionState);
    const quality = getConnectionQuality(pc);
    setConnectionQuality(quality);

    // Update quality canvas
    if (qualityCanvasRef.current) {
      drawConnectionQuality(qualityCanvasRef.current, quality);
    }

    switch (pc.iceConnectionState) {
      case "connected":
      case "completed":
        // Force UI update
        log.info(`ICE connection ${pc.iceConnectionState} - Updating UI`);
        connectionCompletedRef.current = true;
        callAnsweredRef.current = true;
        setIsConnected(true);
        setIsConnecting(false);
        setIsWaitingForResponse(false);
        setConnectionError(null);
        flushCandidateQueue();
        break;

      case "failed":
        log.error("ICE connection failed");
        setIsConnected(false);
        setConnectionError("Network connection failed.");
        attemptConnectionRecovery(createOffer);
        break;

      case "disconnected":
        log.warn("ICE connection disconnected, attempting recovery");
        setTimeout(() => {
          if (isMountedRef.current &&
              peerConnectionRef.current?.iceConnectionState === "disconnected") {
            attemptConnectionRecovery(createOffer);
          }
        }, 1500);
        break;
    }
  }, [flushCandidateQueue]);

  // Create and configure the RTCPeerConnection
  const createPeerConnection = useCallback(async () => {
    log.debug("Attempting to create new RTCPeerConnection");

    // Clean up any existing connection
    if (peerConnectionRef.current) {
      log.warn("Closing existing peer connection before creating a new one.");
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Reset state
    processedCandidatesRef.current.clear();
    processedSignalsRef.current.clear();
    iceCandidateQueueRef.current = [];
    incomingSignalQueueRef.current = [];
    negotiationInProgressRef.current = false;

    try {
      const pc = new RTCPeerConnection(PEER_CONNECTION_CONFIG);
      log.debug("RTCPeerConnection created with config:", PEER_CONNECTION_CONFIG);

      // Add local media tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          try {
            pc.addTrack(track, localStreamRef.current);
            log.debug(`Added local ${track.kind} track to peer connection.`);
          } catch (trackError) {
            log.error(`Failed to add ${track.kind} track:`, trackError);
          }
        });
      } else {
        log.warn("No local stream available when creating peer connection.");
        throw new Error("Local media stream missing.");
      }

      // Setup event listeners
      pc.ontrack = handleRemoteTrack;
      pc.onicecandidate = handleICECandidate;
      pc.onconnectionstatechange = handleConnectionStateChange;
      pc.oniceconnectionstatechange = handleICEConnectionStateChange;

      // Additional state monitoring
      pc.onicegatheringstatechange = () => {
        log.debug("ICE gathering state:", pc.iceGatheringState);

        if (pc.iceGatheringState === "complete") {
          flushCandidateQueue();
        }
      };

      pc.onsignalingstatechange = () => {
        log.debug("Signaling state changed:", pc.signalingState);
        negotiationInProgressRef.current = (pc.signalingState !== "stable");
      };

      pc.onnegotiationneeded = () => {
        log.debug("Negotiation needed event fired. Current state:", pc.signalingState);
      };

      peerConnectionRef.current = pc;
      log.info("Peer connection created and listeners attached successfully.");

      // Process any signals that arrived before PC was ready
      flushIncomingSignalQueue();

      return pc;
    } catch (err) {
      log.error("Fatal error creating peer connection:", err);
      setConnectionError(`Failed to initialize connection: ${err.message}`);
      setIsConnecting(false);
      throw err;
    }
  }, [
    handleRemoteTrack,
    handleICECandidate,
    handleConnectionStateChange,
    handleICEConnectionStateChange,
    flushCandidateQueue,
    flushIncomingSignalQueue
  ]);

  // Create an offer
  const createOffer = useCallback(async (options = {}) => {
    if (!peerConnectionRef.current) {
      log.error("Cannot create offer: Peer connection does not exist.");
      return;
    }

    const pc = peerConnectionRef.current;

    // Prevent offer creation if state is not stable or negotiation is ongoing
    if (pc.signalingState !== "stable") {
      log.warn(`Cannot create offer in signaling state: ${pc.signalingState}. Aborting.`);
      return;
    }

    if (negotiationInProgressRef.current) {
      log.warn("Negotiation already in progress, skipping offer creation.");
      return;
    }

    try {
      negotiationInProgressRef.current = true;
      log.debug("Creating offer...");

      // Options: iceRestart can be used for recovery
      const offerOptions = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        iceRestart: options?.iceRestart || false,
      };

      const offer = await pc.createOffer(offerOptions);

      // Check state again before setting local description
      if (pc.signalingState !== "stable") {
        log.warn(`Signaling state changed to ${pc.signalingState} during offer creation. Aborting.`);
        negotiationInProgressRef.current = false;
        return;
      }

      await pc.setLocalDescription(offer);
      log.debug("Offer created and set as local description.");

      // Send the offer via signaling
      const signalPayload = { type: "offer", sdp: pc.localDescription };
      const signalId = getSignalId(signalPayload);
      processedSignalsRef.current.add(signalId);

      socketService.emit("videoSignal", {
        recipientId,
        signal: signalPayload,
        from: { userId, callId },
      });

      log.debug("Offer sent to remote peer.");
      flushCandidateQueue();

      // If caller, set a flag to show we're waiting for the call to be answered
      if (!isIncoming && !callAnsweredRef.current) {
        setIsWaitingForResponse(true);

        // Set timeout for unanswered call
        if (unansweredCallTimeoutRef.current) {
          clearTimeout(unansweredCallTimeoutRef.current);
        }

        unansweredCallTimeoutRef.current = setTimeout(() => {
          if (!callAnsweredRef.current && isMountedRef.current) {
            log.warn("Call went unanswered for too long. Ending call attempt.");
            setConnectionError("No answer from the recipient. They may be away or unable to accept calls right now.");
            setIsConnecting(false);
            setIsWaitingForResponse(false);

            // Auto-hang up after timeout
            if (onEndCall) {
              setTimeout(() => {
                if (isMountedRef.current) onEndCall();
              }, 5000);
            }
          }
        }, UNANSWERED_CALL_TIMEOUT);
      }
    } catch (err) {
      log.error("Error creating or setting offer:", err);
      setConnectionError(`Signaling Error: ${err.message}`);
      negotiationInProgressRef.current = false;
      attemptConnectionRecovery(createOffer);
    }
  }, [recipientId, userId, callId, flushCandidateQueue, isIncoming]);

  // Create an answer
  const createAnswer = useCallback(async () => {
    if (!peerConnectionRef.current) {
      log.error("Cannot create answer: Peer connection does not exist.");
      return;
    }

    const pc = peerConnectionRef.current;

    // Should only create answer if we have a remote offer
    if (pc.signalingState !== "have-remote-offer") {
      log.warn(`Cannot create answer in signaling state: ${pc.signalingState}. Aborting.`);
      return;
    }

    try {
      negotiationInProgressRef.current = true;
      log.debug("Creating answer...");

      const answer = await pc.createAnswer();

      // Check state again before setting local description
      if (pc.signalingState !== "have-remote-offer") {
        log.warn(`Signaling state changed to ${pc.signalingState} during answer creation. Aborting.`);
        negotiationInProgressRef.current = false;
        return;
      }

      await pc.setLocalDescription(answer);
      log.debug("Answer created and set as local description.");

      // Send the answer via signaling
      const signalPayload = { type: "answer", sdp: pc.localDescription };
      const signalId = getSignalId(signalPayload);
      processedSignalsRef.current.add(signalId);

      socketService.emit("videoSignal", {
        recipientId,
        signal: signalPayload,
        from: { userId, callId },
      });

      log.debug("Answer sent to remote peer.");
      flushCandidateQueue();

      // Mark the call as answered when we send an answer
      if (isIncoming) {
        callAnsweredRef.current = true;
      }
    } catch (err) {
      log.error("Error creating or setting answer:", err);
      setConnectionError(`Signaling Error: ${err.message}`);
      negotiationInProgressRef.current = false;
      attemptConnectionRecovery(createOffer);
    }
  }, [recipientId, userId, callId, flushCandidateQueue, createOffer, isIncoming]);

  // Socket signal handler for incoming WebRTC signaling messages
  const handleVideoSignal = useCallback((data) => {
    // Basic validation
    if (!data || !data.signal || !data.signal.type || !data.userId) {
      log.warn("Received invalid signal data structure.");
      return;
    }

    // Ignore signals not from expected recipient
    if (data.userId !== recipientId) {
      log.debug(`Ignoring signal from unexpected user: ${data.userId}`);
      return;
    }

    const signal = data.signal;
    const signalType = signal.type;
    log.debug(`Received '${signalType}' signal from ${data.userId}`);

    // If peer connection isn't ready yet, queue the signal
    if (!peerConnectionRef.current) {
      log.warn(`Peer connection not ready. Queuing '${signalType}' signal.`);
      incomingSignalQueueRef.current.push(data);
      return;
    }

    const pc = peerConnectionRef.current;
    const currentState = pc.signalingState;
    log.debug(`Processing '${signalType}'. Current state: ${currentState}. Negotiation: ${negotiationInProgressRef.current}`);

    // Prevent processing duplicate signals
    const signalId = getSignalId(signal);
    if (processedSignalsRef.current.has(signalId)) {
      log.debug(`Ignoring duplicate '${signalType}' signal (ID: ${signalId.substring(0, 50)}...)`);
      return;
    }

    try {
      switch (signalType) {
        case "request-offer":
          log.debug("Received request-offer signal.");
          if (currentState === "stable" && !negotiationInProgressRef.current) {
            createOffer().catch(err => log.error("Error creating offer:", err));
          } else {
            log.warn(`Cannot create offer now upon request. State: ${currentState}, Negotiation: ${negotiationInProgressRef.current}`);
          }
          break;

        case "offer":
          log.debug("Processing received offer.");
          processedSignalsRef.current.add(signalId);

          // If receiving an offer, the other party is online and responding
          if (!isIncoming) {
            setIsWaitingForResponse(false);
            if (unansweredCallTimeoutRef.current) {
              clearTimeout(unansweredCallTimeoutRef.current);
              unansweredCallTimeoutRef.current = null;
            }
          }

          // Offer/Answer Collision (Glare) Handling
          const isMakingOffer = negotiationInProgressRef.current && currentState === "have-local-offer";

          if (isMakingOffer) {
            log.warn("Offer collision detected (both peers sending offers).");
            // Use user IDs as tie-breaker. Higher ID accepts offer
            const politePeer = userId > recipientId;

            if (politePeer) {
              log.debug("This peer is polite. Rolling back local offer and accepting remote offer.");
              negotiationInProgressRef.current = false;

              // Handle rollback case with promise chain instead of await
              pc.setLocalDescription({ type: "rollback" })
                .then(() => pc.setRemoteDescription(new RTCSessionDescription(signal.sdp)))
                .then(() => {
                  flushCandidateQueue();
                  return createAnswer();
                })
                .catch(err => {
                  log.error("Error handling polite offer collision:", err);
                });
            } else {
              log.debug("This peer is impolite. Ignoring remote offer, expecting peer to accept ours.");
              // Do nothing, other side should accept our offer
            }
          }
          // Regular Offer Handling
          else if (currentState === "stable" || currentState === "have-remote-offer") {
            // Replace await with promise chain
            pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
              .then(() => {
                log.debug("Remote offer set successfully.");
                flushCandidateQueue();

                // Create answer if state is now have-remote-offer
                if (pc.signalingState === "have-remote-offer") {
                  return createAnswer();
                } else {
                  log.warn(`State after setting remote offer is ${pc.signalingState}, not creating answer yet.`);
                }
              })
              .catch(err => {
                log.error("Error setting remote description:", err);
                setConnectionError(`Signaling Error: ${err.message}`);
              });
          } else {
            log.error(`Cannot handle offer in unexpected state: ${currentState}.`);
            attemptConnectionRecovery(createOffer);
          }
          break;

        case "answer":
          log.debug("Processing received answer.");

          // If receiving an answer, the remote user has explicitly accepted the call
          if (!isIncoming) {
            callAnsweredRef.current = true;
            setIsWaitingForResponse(false);
            if (unansweredCallTimeoutRef.current) {
              clearTimeout(unansweredCallTimeoutRef.current);
              unansweredCallTimeoutRef.current = null;
            }
          }

          if (currentState === "have-local-offer") {
            processedSignalsRef.current.add(signalId);

            // Replace await with promise chain
            pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
              .then(() => {
                log.debug("Remote answer set successfully. Connection should establish soon.");
                negotiationInProgressRef.current = false;
                flushCandidateQueue();
              })
              .catch(err => {
                log.error("Error setting remote answer description:", err);
                setConnectionError(`Signaling Error: ${err.message}`);
              });
          } else {
            log.warn(`Received answer in unexpected state: ${currentState}. Ignoring.`);
            // This could be a late/duplicate answer
          }
          break;

        case "ice-candidate":
          if (!signal.candidate) {
            log.debug("Received empty ICE candidate signal (end of candidates).");
            return;
          }

          const candidate = new RTCIceCandidate(signal.candidate);
          const fingerprint = getCandidateFingerprint(candidate);

          if (processedCandidatesRef.current.has(fingerprint)) {
            log.debug("Skipping duplicate remote ICE candidate.");
            return;
          }

          // Queue if remote description not yet set
          if (!pc.remoteDescription) {
            log.debug("Queuing remote ICE candidate (no remote description yet).");
            iceCandidateQueueRef.current.push(candidate);
          } else {
            // Replace await with promise chain
            pc.addIceCandidate(candidate)
              .then(() => {
                processedCandidatesRef.current.add(fingerprint);
                log.debug("Added remote ICE candidate:", candidate.candidate?.slice(0, 50));
              })
              .catch(err => {
                log.error("Error adding remote ICE candidate:", err);
                // Only re-queue if we think it might succeed later
                if (pc.signalingState !== 'closed') {
                  iceCandidateQueueRef.current.push(candidate);
                }
              });
          }
          break;

        default:
          log.warn(`Received unknown signal type: ${signalType}`);
      }
    } catch (err) {
      log.error(`Error processing signal type ${signalType}:`, err);
      setConnectionError(`Signaling Error: ${err.message}`);
      negotiationInProgressRef.current = false;
      attemptConnectionRecovery(createOffer);
    }
  }, [
    recipientId,
    userId,
    callId,
    createOffer,
    createAnswer,
    flushCandidateQueue,
    isIncoming
  ]);

  // Attempt less disruptive recovery (ICE Restart)
  const attemptConnectionRecovery = useCallback((createOfferFunc) => {
    if (!peerConnectionRef.current || !isMountedRef.current) return;
    const pc = peerConnectionRef.current;

    log.warn("Attempting connection recovery (ICE Restart).");

    // Update UI to show recovery attempt
    setConnectionQuality(getConnectionQuality(pc));

    if (qualityCanvasRef.current) {
      drawConnectionQuality(qualityCanvasRef.current, "poor");
    }

    // Check if ICE restart is supported and needed
    if (
      typeof pc.restartIce === "function" &&
      (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed")
    ) {
      log.debug("Performing ICE restart.");
      negotiationInProgressRef.current = false;
      pc.restartIce();

      // An offer might need to be created after ICE restart
      if (!isIncoming && pc.signalingState === 'stable') {
        log.debug("Initiator attempting offer creation after ICE restart.");

        setTimeout(() => {
          if (isMountedRef.current &&
              peerConnectionRef.current?.signalingState === 'stable') {
            createOfferFunc({ iceRestart: true })
              .catch(e => log.error("Error creating recovery offer:", e));
          }
        }, 500);
      }
    } else {
      log.warn(`ICE restart not applicable or supported. State: ${pc.iceConnectionState}. Attempting full reconnect.`);
      attemptReconnect(createPeerConnection, startSignaling);
    }
  }, [isIncoming]);

  // Attempt full reconnection (create new PeerConnection)
  const attemptReconnect = useCallback((createPC, startSig) => {
    if (!isMountedRef.current) return;

    if (retryCount >= MAX_RETRY_COUNT) {
      log.error("Max reconnection attempts reached. Giving up.");
      setConnectionError(
        "Failed to establish connection after multiple attempts. Please check network or try again later."
      );
      setIsConnecting(false);
      return;
    }

    // Avoid scheduling multiple reconnects
    if (reconnectTimeoutRef.current) {
      log.debug("Reconnect attempt already scheduled.");
      return;
    }

    setIsConnecting(true);
    setIsConnected(false);
    setRetryCount(prev => prev + 1);

    const currentAttempt = retryCount + 1;
    log.warn(`Attempting full reconnect (${currentAttempt}/${MAX_RETRY_COUNT}) in ${RECONNECT_DELAY}ms...`);

    setConnectionError(`Connection lost. Attempting to reconnect (${currentAttempt}/${MAX_RETRY_COUNT})...`);

    reconnectTimeoutRef.current = setTimeout(async () => {
      reconnectTimeoutRef.current = null;

      if (!isMountedRef.current) return;

      log.debug(`Executing reconnect attempt ${currentAttempt}`);

      try {
        // Create a completely new peer connection
        await createPC();

        if (!isMountedRef.current) return;

        // Re-initialize signaling
        await startSig();
        log.info(`Reconnect attempt ${currentAttempt} initiated signaling.`);
      } catch (err) {
        log.error(`Error during reconnection attempt ${currentAttempt}:`, err);
        setConnectionError(`Reconnection failed: ${err.message}`);
        setIsConnecting(false);

        // Schedule next retry if applicable
        if (currentAttempt < MAX_RETRY_COUNT) {
          attemptReconnect(createPC, startSig);
        } else {
          log.error("Final reconnection attempt failed.");
          setConnectionError("Failed to reconnect. Please try again later.");
        }
      }
    }, RECONNECT_DELAY);
  }, [retryCount]);

  // Start the signaling process
  const startSignaling = useCallback(async () => {
    log.debug(`Starting signaling. Role: ${isIncoming ? "Callee (Incoming)" : "Caller (Outgoing)"}`);

    if (signallingTimeoutRef.current) {
      clearTimeout(signallingTimeoutRef.current);
    }

    // Timeout for the signaling phase
    signallingTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && !isConnected && isConnecting) {
        log.error("Signaling timeout reached. Connection failed.");
        setConnectionError(
          "Connection timed out. The other user may be offline or have network issues."
        );
        setIsConnecting(false);
        setIsWaitingForResponse(false);
      }
    }, SIGNALLING_TIMEOUT);

    try {
      if (!peerConnectionRef.current) {
        throw new Error("Peer connection not initialized before starting signaling.");
      }

      if (isIncoming) {
        // Callee waits for an offer
        log.debug("Incoming call: Waiting for offer from caller.");
      } else {
        // Caller initiates by creating an offer
        log.debug("Outgoing call: Creating initial offer.");
        await createOffer();
      }
    } catch (err) {
      log.error("Error during signaling initiation:", err);
      setConnectionError(`Signaling Error: ${err.message}`);
      setIsConnecting(false);
      setIsWaitingForResponse(false);
    }
  }, [isIncoming, createOffer, isConnected, isConnecting]);

  // Gather WebRTC stats for debugging and quality monitoring
  const getConnectionStats = useCallback(async () => {
    if (!peerConnectionRef.current || !isConnected) return;

    try {
      const statsReport = await peerConnectionRef.current.getStats();

      // Extract useful stats
      let inboundVideo = null;
      let inboundAudio = null;
      let outboundVideo = null;
      let candidatePair = null;

      statsReport.forEach(report => {
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          inboundVideo = report;
        }
        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
          inboundAudio = report;
        }
        if (report.type === 'outbound-rtp' && report.kind === 'video') {
          outboundVideo = report;
        }
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          candidatePair = report;
        }
      });

      // Update video stats
      if (inboundVideo) {
        const width = inboundVideo.frameWidth || 0;
        const height = inboundVideo.frameHeight || 0;
        const fps = Math.round(inboundVideo.framesPerSecond || 0);

        setVideoStats({
          resolution: width && height ? `${width}x${height}` : "",
          frameRate: fps,
          bitrate: Math.round((inboundVideo.bytesReceived || 0) / 1024 / 8) // kbps
        });
      }

      // Update connection quality based on stats
      if (candidatePair && inboundVideo) {
        // Quality formula based on multiple factors
        const rtt = candidatePair.currentRoundTripTime || 0;
        const packetsLost = inboundVideo.packetsLost || 0;
        const packetsReceived = inboundVideo.packetsReceived || 1;
        const lossRate = packetsLost / (packetsLost + packetsReceived);
        const jitter = inboundVideo.jitter || 0;

        let quality = "unknown";

        if (rtt < 0.1 && lossRate < 0.01 && jitter < 0.01) {
          quality = "excellent";
        } else if (rtt < 0.3 && lossRate < 0.05 && jitter < 0.03) {
          quality = "good";
        } else if (rtt < 0.5 && lossRate < 0.1 && jitter < 0.05) {
          quality = "fair";
        } else {
          quality = "poor";
        }

        setConnectionQuality(quality);

        // Update quality visualization
        if (qualityCanvasRef.current) {
          drawConnectionQuality(qualityCanvasRef.current, quality);
        }
      }
    } catch (err) {
      log.warn("Error getting WebRTC stats:", err);
    }
  }, [isConnected]);

  // Clean up connection resources
  const closeConnection = useCallback(() => {
    log.info("Closing VideoCall connection and cleaning up resources.");

    // Clear all timeouts and intervals
    if (signallingTimeoutRef.current) clearTimeout(signallingTimeoutRef.current);
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (candidateFlushTimeoutRef.current) clearTimeout(candidateFlushTimeoutRef.current);
    if (unansweredCallTimeoutRef.current) clearTimeout(unansweredCallTimeoutRef.current);
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    if (audioMeterIntervalRef.current) clearInterval(audioMeterIntervalRef.current);

    signallingTimeoutRef.current = null;
    connectionTimeoutRef.current = null;
    reconnectTimeoutRef.current = null;
    candidateFlushTimeoutRef.current = null;
    unansweredCallTimeoutRef.current = null;
    statsIntervalRef.current = null;
    audioMeterIntervalRef.current = null;

    // Stop local media tracks
    if (localStreamRef.current) {
      log.debug("Stopping local media tracks.");
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      localStreamRef.current = null;
    }

    // Clean up audio analyzers
    audioAnalyserRef.current = null;
    audioDataRef.current = null;
    remoteAudioAnalyserRef.current = null;
    remoteAudioDataRef.current = null;

    // Detach streams from video elements
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    // Close peer connection
    if (peerConnectionRef.current) {
      log.debug("Closing RTCPeerConnection.");
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Clear other refs
    iceCandidateQueueRef.current = [];
    incomingSignalQueueRef.current = [];
    processedCandidatesRef.current.clear();
    processedSignalsRef.current.clear();
    negotiationInProgressRef.current = false;
    connectionCompletedRef.current = false;
    callAnsweredRef.current = false;

    log.debug("VideoCall cleanup complete.");
  }, []);

  // Media control functions
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;

    const audioTracks = localStreamRef.current.getAudioTracks();
    if (audioTracks.length > 0) {
      const newMuteState = !isLocalMuted;
      audioTracks[0].enabled = !newMuteState;
      setIsLocalMuted(newMuteState);

      // Update canvas
      if (localAudioCanvasRef.current) {
        drawAudioLevel(localAudioCanvasRef.current, newMuteState ? 0 : localAudioLevel);
      }

      log.debug(`Local audio ${newMuteState ? "muted" : "unmuted"}.`);

      // Notify remote peer
      socketService.emit("videoMediaControl", {
        recipientId,
        type: "audio",
        muted: newMuteState,
      });
    } else {
      log.warn("Attempted to toggle mute but no local audio track found.");
    }
  }, [isLocalMuted, recipientId, localAudioLevel]);

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;

    const videoTracks = localStreamRef.current.getVideoTracks();
    if (videoTracks.length > 0) {
      const newVideoState = !isLocalVideoOff;
      videoTracks[0].enabled = !newVideoState;
      setIsLocalVideoOff(newVideoState);

      // Update placeholder
      if (localPlaceholderRef.current) {
        if (newVideoState) {
          drawPlaceholderVideo(localPlaceholderRef.current, "Camera Off");
        }
      }

      log.debug(`Local video ${newVideoState ? "disabled" : "enabled"}.`);

      // Notify remote peer
      socketService.emit("videoMediaControl", {
        recipientId,
        type: "video",
        muted: newVideoState,
      });
    } else {
      log.warn("Attempted to toggle video but no local video track found.");
    }
  }, [isLocalVideoOff, recipientId]);

  const handleEndCall = useCallback(() => {
    log.info("User initiated end call.");

    socketService.emit("videoHangup", { recipientId });

    if (onEndCall) {
      onEndCall();
    }
  }, [recipientId, onEndCall]);

  const toggleFullscreen = useCallback(() => {
    const container = document.querySelector(".video-container");
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch((err) => toast.error(`Could not enter fullscreen: ${err.message}`));
    } else {
      document.exitFullscreen()
        .then(() => setIsFullscreen(false));
    }
  }, []);

  // --- Effects ---

  // Effect to manage component mount state
  useEffect(() => {
    isMountedRef.current = true;
    log.debug("VideoCall component mounted.");

    return () => {
      isMountedRef.current = false;
      log.debug("VideoCall component unmounting.");
      closeConnection();
    };
  }, [closeConnection]);

  // Effect for setting up and initializing the call
  useEffect(() => {
    if (isActive && isMountedRef.current) {
      log.info("VideoCall activated. Initializing...");

      // Reset connection state
      connectionCompletedRef.current = false;
      callAnsweredRef.current = false;

      // Set overall connection timeout
      connectionTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && !connectionCompletedRef.current) {
          log.error("Overall connection timeout reached.");
          setConnectionError("Connection failed to establish after 30 seconds.");
          setIsConnecting(false);
          setIsWaitingForResponse(false);
        }
      }, CONNECTION_TIMEOUT);

      // Initialization sequence
      const initializeCall = async () => {
        try {
          setConnectionError(null);
          setIsConnecting(true);
          setRetryCount(0);
          setIsWaitingForResponse(false);

          await initializeMedia();
          if (!isMountedRef.current) return;

          await createPeerConnection();
          if (!isMountedRef.current) return;

          await startSignaling();
          if (!isMountedRef.current) return;

          log.info("Call initialization sequence completed.");
        } catch (err) {
          log.error("Error during call initialization sequence:", err);
          setIsConnecting(false);
          setIsWaitingForResponse(false);
          setConnectionError(`Setup failed: ${err.message}`);
        }
      };

      initializeCall();

      // Set up stats gathering interval
      statsIntervalRef.current = setInterval(() => {
        getConnectionStats();
      }, STATS_INTERVAL);

      // Start call duration timer
      const durationInterval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);

      // Return cleanup function
      return () => {
        log.info("VideoCall deactivated or unmounting. Cleaning up active call.");
        clearInterval(durationInterval);
        if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
        if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
        if (unansweredCallTimeoutRef.current) clearTimeout(unansweredCallTimeoutRef.current);
        closeConnection();
        setCallDuration(0);
      };
    } else if (!isActive && peerConnectionRef.current) {
      // If call becomes inactive, ensure cleanup
      log.info("VideoCall deactivated. Performing cleanup.");
      closeConnection();

      // Reset state for potential reactivation
      setIsConnected(false);
      setIsConnecting(false);
      setIsWaitingForResponse(false);
      setConnectionError(null);
      setRetryCount(0);
      setCallDuration(0);
    }
  }, [
    isActive,
    initializeMedia,
    createPeerConnection,
    startSignaling,
    closeConnection,
    getConnectionStats
  ]);

  // Effect for setting up socket event listeners
  useEffect(() => {
    if (!isActive) return;

    log.debug("Setting up socket listeners for VideoCall");

    // Socket event handlers
    const handleVideoSignalEvent = (data) => handleVideoSignal(data);

    const handleHangup = (data) => {
      if (data.userId === recipientId) {
        log.info("Received hangup signal from peer.");
        toast.info("The other user has ended the call.");
        if (onEndCall) onEndCall();
      }
    };

    const handleMediaControl = (data) => {
      if (data.userId === recipientId) {
        log.debug(`Received media control from peer: ${data.type} = ${data.muted}`);
        if (data.type === "audio") {
          setIsRemoteMuted(data.muted);
          if (remoteAudioCanvasRef.current) {
            drawAudioLevel(remoteAudioCanvasRef.current, data.muted ? 0 : remoteAudioLevel);
          }
        }
        if (data.type === "video") {
          setIsRemoteVideoOff(data.muted);
          if (data.muted && remotePlaceholderRef.current) {
            drawPlaceholderVideo(remotePlaceholderRef.current, "Remote Camera Off");
          }
        }
      }
    };

    const handleErrorSignal = (data) => {
      log.error("Received error signal from peer or server:", data?.error);
      setConnectionError(`Remote Error: ${data?.error || 'Unknown issue'}`);
      setIsConnecting(false);
      setIsWaitingForResponse(false);
    };

    // Register event listeners
    const listeners = [
      socketService.on("videoSignal", handleVideoSignalEvent),
      socketService.on("videoHangup", handleHangup),
      socketService.on("videoMediaControl", handleMediaControl),
      socketService.on("videoError", handleErrorSignal),
    ];

    // Return cleanup function
    return () => {
      log.debug("Removing socket listeners for VideoCall");
      listeners.forEach(removeListener => removeListener());
    };
  }, [isActive, recipientId, onEndCall, handleVideoSignal, remoteAudioLevel]);

  // Effect for showing/hiding controls on mouse movement
  useEffect(() => {
    let controlsTimeout = null;

    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeout) clearTimeout(controlsTimeout);
      controlsTimeout = setTimeout(() => {
        if (isMountedRef.current) setShowControls(false);
      }, 3000);
    };

    const container = document.querySelector(".video-container");
    if (container) {
      container.addEventListener("mousemove", handleMouseMove);
      handleMouseMove(); // Initially show controls
    }

    return () => {
      if (controlsTimeout) clearTimeout(controlsTimeout);
      container?.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // Effect for initializing canvas elements and updates
  useEffect(() => {
    // Initialize quality canvas
    if (qualityCanvasRef.current) {
      drawConnectionQuality(qualityCanvasRef.current, connectionQuality);
    }

    // Initialize audio level canvases
    if (localAudioCanvasRef.current) {
      drawAudioLevel(localAudioCanvasRef.current, isLocalMuted ? 0 : localAudioLevel);
    }

    if (remoteAudioCanvasRef.current) {
      drawAudioLevel(remoteAudioCanvasRef.current, isRemoteMuted ? 0 : remoteAudioLevel);
    }

    // Initialize video placeholders if needed
    if (isLocalVideoOff && localPlaceholderRef.current) {
      drawPlaceholderVideo(localPlaceholderRef.current, "Camera Off");
    }

    if (isRemoteVideoOff && remotePlaceholderRef.current) {
      drawPlaceholderVideo(remotePlaceholderRef.current, "Remote Camera Off");
    }
  }, [
    connectionQuality,
    localAudioLevel,
    remoteAudioLevel,
    isLocalMuted,
    isRemoteMuted,
    isLocalVideoOff,
    isRemoteVideoOff
  ]);

  // Debug effect to log connection state changes
  useEffect(() => {
    log.debug(
      `Connection status changed - connected: ${isConnected}, connecting: ${isConnecting}, waiting: ${isWaitingForResponse}, error: ${connectionError || "none"}`
    );
  }, [isConnected, isConnecting, isWaitingForResponse, connectionError]);

  // --- Render ---
  return (
    <div className="video-call">
      <div className="video-container" onMouseMove={() => setShowControls(true)}>
        {/* Remote video */}
        <div className="remote-video-wrapper">
          <video
            ref={remoteVideoRef}
            className="remote-video"
            autoPlay
            playsInline
          />

          {/* Remote video placeholder when video is off */}
          {isRemoteVideoOff && (
            <canvas
              ref={remotePlaceholderRef}
              className="video-placeholder remote-video-placeholder"
              width="640"
              height="480"
            ></canvas>
          )}

          {/* Connection quality indicator */}
          <div className="connection-quality-indicator">
            <canvas
              ref={qualityCanvasRef}
              width="100"
              height="30"
              className={`quality-canvas ${connectionQuality}`}
            ></canvas>
            <span className="quality-text">{connectionQuality}</span>
          </div>

          {/* Remote audio level indicator */}
          <div className="remote-audio-indicator">
            <canvas
              ref={remoteAudioCanvasRef}
              width="15"
              height="80"
              className="audio-level-canvas"
            ></canvas>
          </div>

          {/* Remote audio/video status indicators */}
          {isRemoteMuted && !isConnecting && !connectionError && (
            <div className="audio-off-indicator remote-audio-off">
              <FaMicrophoneSlash aria-label="Remote peer muted" />
            </div>
          )}

          {/* Waiting for answer indicator */}
          {isWaitingForResponse && !connectionError && (
            <div className="waiting-indicator">
              <FaSpinner className="spin" aria-hidden="true" />
              <span>Calling {recipientName}...</span>
              <span className="waiting-subtext">Waiting for answer</span>
            </div>
          )}

          {/* Connecting indicator - only show when connecting and not waiting for response */}
          {isConnecting && !isConnected && !isWaitingForResponse && (
            <div className="connecting-indicator">
              <FaSpinner className="spin" aria-hidden="true" />
              <span>Connecting...</span>
              {retryCount > 0 && (
                <span className="retry-count">Attempt {retryCount}/{MAX_RETRY_COUNT}</span>
              )}
            </div>
          )}

          {/* Error message overlay */}
          {connectionError && !isConnecting && (
            <div className="error-indicator">
              <div className="error-message">
                <FaExclamationTriangle className="error-icon" />
                <span>{formatErrorMessage(connectionError)}</span>
                {retryCount < MAX_RETRY_COUNT && !isConnected && (
                  <button
                    className="retry-button"
                    onClick={() => attemptReconnect(createPeerConnection, startSignaling)}
                    aria-label="Retry connection"
                  >
                    <FaUndo /> Retry
                  </button>
                )}
                <button
                  className="error-end-call-button"
                  onClick={handleEndCall}
                  aria-label="End Call"
                >
                  <FaPhoneSlash /> End Call
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Local video */}
        <div className="local-video-wrapper">
          <video
            ref={localVideoRef}
            className="local-video"
            autoPlay
            playsInline
            muted
          />

          {/* Local video placeholder when video is off */}
          {isLocalVideoOff && (
            <canvas
              ref={localPlaceholderRef}
              className="video-placeholder local-video-placeholder"
              width="160"
              height="120"
            ></canvas>
          )}

          {/* Local audio level indicator */}
          <div className="local-audio-indicator">
            <canvas
              ref={localAudioCanvasRef}
              width="10"
              height="60"
              className="audio-level-canvas"
            ></canvas>
          </div>
        </div>

        {/* Call info display */}
        <div className="call-info">
          <span className="call-duration" aria-label={`Call duration: ${formatDuration(callDuration)}`}>
            {formatDuration(callDuration)}
          </span>

          {isConnected && videoStats.resolution && (
            <span className="video-stats">
              {videoStats.resolution} • {videoStats.frameRate} fps
            </span>
          )}
        </div>

        {/* Call control buttons */}
        <div className={`call-controls ${showControls ? "visible" : "hidden"}`}>
          <button
            className={`control-button ${isLocalMuted ? "active" : ""}`}
            onClick={toggleMute}
            aria-label={isLocalMuted ? "Unmute Microphone" : "Mute Microphone"}
            aria-pressed={isLocalMuted}
          >
            {isLocalMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
          </button>

          <button
            className={`control-button ${isLocalVideoOff ? "active" : ""}`}
            onClick={toggleVideo}
            aria-label={isLocalVideoOff ? "Turn Camera On" : "Turn Camera Off"}
            aria-pressed={isLocalVideoOff}
          >
            {isLocalVideoOff ? <FaVideoSlash /> : <FaVideo />}
          </button>

          <button
            className="control-button end-call"
            onClick={handleEndCall}
            aria-label="End Call"
          >
            <FaPhoneSlash />
          </button>

          <button
            className={`control-button ${isFullscreen ? "active" : ""}`}
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            aria-pressed={isFullscreen}
          >
            {isFullscreen ? <FaCompressAlt /> : <FaExpandAlt />}
          </button>

          <button
            className="control-button quality-button"
            aria-label="Show connection quality"
          >
            <FaSignal />
            <span className={`quality-dot ${connectionQuality}`}></span>
          </button>
        </div>
      </div>

      {/* Styles */}
      <style jsx="true">{`
        .video-call {
          width: 100%;
          height: 100%;
          position: relative;
          background-color: #1a1a1a;
          overflow: hidden;
          border-radius: 8px;
          color: #fff;
          font-family: system-ui, -apple-system, sans-serif;
        }
        
        .video-container {
          width: 100%;
          height: 100%;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        /* Remote Video Styles */
        .remote-video-wrapper {
          width: 100%;
          height: 100%;
          position: relative;
          overflow: hidden;
          background-color: #222;
        }
        
        .remote-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          background-color: #222;
        }
        
        /* Video Placeholders */
        .video-placeholder {
          position: absolute;
          top: 0;
          left: 0;
          background-color: rgba(0, 0, 0, 0.8);
        }
        
        .remote-video-placeholder {
          width: 100%;
          height: 100%;
          z-index: 5;
        }
        
        /* Connection Quality Indicator */
        .connection-quality-indicator {
          position: absolute;
          top: 20px;
          right: 20px;
          display: flex;
          align-items: center;
          background-color: rgba(0, 0, 0, 0.6);
          padding: 5px 10px;
          border-radius: 12px;
          z-index: 25;
          backdrop-filter: blur(3px);
        }
        
        .quality-canvas {
          margin-right: 8px;
        }
        
        .quality-text {
          font-size: 12px;
          font-weight: 500;
          text-transform: capitalize;
        }
        
        /* Audio Level Indicators */
        .remote-audio-indicator {
          position: absolute;
          bottom: 20px;
          right: 20px;
          z-index: 15;
          background-color: rgba(0, 0, 0, 0.6);
          padding: 5px;
          border-radius: 8px;
          backdrop-filter: blur(3px);
        }
        
        .local-audio-indicator {
          position: absolute;
          bottom: 5px;
          right: 5px;
          z-index: 15;
          background-color: rgba(0, 0, 0, 0.6);
          padding: 3px;
          border-radius: 5px;
          backdrop-filter: blur(3px);
        }
        
        .audio-level-canvas {
          display: block;
        }
        
        /* Indicator Styles for Video/Audio State */
        .connecting-indicator,
        .waiting-indicator,
        .error-indicator {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background-color: rgba(0, 0, 0, 0.75);
          z-index: 20;
          backdrop-filter: blur(4px);
        }
        
        .connecting-indicator,
        .waiting-indicator {
          gap: 15px;
          color: #fff;
          font-size: 1.1em;
        }
        
        .waiting-subtext {
          font-size: 0.9em;
          opacity: 0.7;
          margin-top: -5px;
        }
        
        .spin {
          animation: spin 1.2s infinite linear;
          font-size: 3em;
          color: #4a90e2;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .retry-count {
          font-size: 0.9em;
          opacity: 0.8;
        }
        
        .error-indicator {
          pointer-events: auto;
        }
        
        .error-message {
          background-color: rgba(220, 53, 69, 0.9);
          padding: 20px 25px;
          border-radius: 8px;
          max-width: 85%;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 15px;
          font-size: 0.95em;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }
        
        .error-icon {
          font-size: 2em;
          color: #ffcc00;
          margin-bottom: 10px;
        }
        
        .retry-button,
        .error-end-call-button {
          background-color: rgba(255, 255, 255, 0.2);
          border: none;
          border-radius: 5px;
          color: #fff;
          padding: 10px 15px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin: 0 auto;
          transition: background-color 0.2s, transform 0.2s;
          font-size: 0.9em;
          font-weight: 500;
        }
        
        .retry-button:hover {
          background-color: rgba(255, 255, 255, 0.3);
          transform: translateY(-2px);
        }
        
        .error-end-call-button {
          background-color: rgba(150, 40, 50, 0.9);
        }
        
        .error-end-call-button:hover {
          background-color: rgba(180, 45, 55, 1);
          transform: translateY(-2px);
        }
        
        .audio-off-indicator {
          position: absolute;
          top: 20px;
          right: 90px;
          background-color: rgba(0, 0, 0, 0.6);
          color: #dc3545;
          padding: 8px;
          border-radius: 50%;
          z-index: 10;
          font-size: 1.2em;
          backdrop-filter: blur(3px);
        }
        
        /* Local Video */
        .local-video-wrapper {
          position: absolute;
          width: clamp(120px, 20%, 180px);
          aspect-ratio: 4/3;
          bottom: 20px;
          left: 20px;
          border-radius: 8px;
          overflow: hidden;
          border: 2px solid rgba(255, 255, 255, 0.5);
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
          z-index: 10;
          transition: transform 0.3s ease;
        }
        
        .local-video-wrapper:hover {
          transform: scale(1.05);
        }
        
        .local-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          background-color: #333;
          transform: scaleX(-1); /* Mirror local view */
        }
        
        .local-video-placeholder {
          width: 100%;
          height: 100%;
          z-index: 5;
        }
        
        /* Call Info */
        .call-info {
          position: absolute;
          top: 20px;
          left: 20px;
          display: flex;
          flex-direction: column;
          gap: 5px;
          background-color: rgba(0, 0, 0, 0.6);
          padding: 8px 14px;
          border-radius: 15px;
          font-size: 0.9em;
          font-weight: 500;
          z-index: 20;
          backdrop-filter: blur(3px);
        }
        
        .video-stats {
          font-size: 0.75em;
          opacity: 0.8;
        }
        
        /* Controls */
        .call-controls {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 16px;
          background-color: rgba(0, 0, 0, 0.7);
          padding: 12px 20px;
          border-radius: 32px;
          transition: opacity 0.4s ease, transform 0.4s ease;
          z-index: 20;
          backdrop-filter: blur(10px);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }
        
        .call-controls.visible {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
        
        .call-controls.hidden {
          opacity: 0;
          transform: translateX(-50%) translateY(80px);
          pointer-events: none;
        }
        
        .control-button {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          border: none;
          background-color: rgba(255, 255, 255, 0.15);
          color: #fff;
          font-size: 1.2em;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
        }
        
        .control-button:hover {
          background-color: rgba(255, 255, 255, 0.25);
          transform: translateY(-3px);
        }
        
        .control-button.active {
          background-color: #4a90e2;
        }
        
        .control-button.end-call {
          background-color: #dc3545;
        }
        
        .control-button.end-call:hover {
          background-color: #c82333;
        }
        
        .quality-dot {
          position: absolute;
          bottom: 3px;
          right: 3px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #aaa;
        }
        
        .quality-dot.excellent {
          background-color: #4caf50;
        }
        
        .quality-dot.good {
          background-color: #8bc34a;
        }
        
        .quality-dot.fair {
          background-color: #ffc107;
        }
        
        .quality-dot.poor {
          background-color: #f44336;
        }
        
        /* Connection Quality Text Colors */
        .quality-text.excellent,
        .connection-quality.excellent {
          color: #4caf50;
        }
        
        .quality-text.good,
        .connection-quality.good {
          color: #8bc34a;
        }
        
        .quality-text.fair,
        .connection-quality.fair {
          color: #ffc107;
        }
        
        .quality-text.poor,
        .connection-quality.poor {
          color: #f44336;
        }
      `}</style>
    </div>
  );
};

export default VideoCall;
