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
import { toast } from "react-toastify";
import PropTypes from "prop-types";
import { logger } from "../utils";
import styles from "../styles/videoCall.module.css";

// NOTE: socketService is now passed as a prop instead of being imported directly

const log = logger.create("VideoCall");

// --- Configuration Constants ---
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.google.com:19302" },
  { urls: "stun:stun.stunprotocol.org:3478" },
  // Add your actual TURN servers for production
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

const CONFIG = {
  peerConnection: {
    iceServers: ICE_SERVERS,
    iceCandidatePoolSize: 10,
    iceTransportPolicy: "all",
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
    sdpSemantics: "unified-plan"
  },
  media: {
    video: {
      width: { ideal: 640, max: 1280 },
      height: { ideal: 480, max: 720 },
      frameRate: { ideal: 24, max: 30 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  },
  timeouts: {
    signaling: 20000,       // 20 seconds
    connection: 30000,      // 30 seconds
    reconnect: 2000,        // 2 seconds
    unansweredCall: 45000   // 45 seconds
  },
  retry: {
    maxCount: 3
  },
  intervals: {
    stats: 5000,            // 5 seconds
    audioMeter: 100         // 100 milliseconds
  }
};

// --- Canvas Visualization Utilities ---
const canvasUtils = {
  drawConnectionQuality: (canvas, quality) => {
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
  },

  drawAudioLevel: (canvas, level) => {
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
  },

  drawPlaceholderVideo: (canvas, text) => {
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
  }
};

// --- WebRTC Utilities ---
const rtcUtils = {
  // Extract a unique identifier for an ICE candidate
  getCandidateFingerprint: (candidate) => {
    if (!candidate) return "";
    if (typeof candidate === "string") return candidate;
    return [candidate.candidate, candidate.sdpMid, candidate.sdpMLineIndex].join("|");
  },

  // Generate a unique identifier for a signaling message
  getSignalId: (signal) => {
    if (!signal || !signal.type) return `invalid-${Date.now()}`;
    if (signal.type === "ice-candidate") {
      return `ice-${rtcUtils.getCandidateFingerprint(signal.candidate)}`;
    } else if (signal.type === "offer" || signal.type === "answer") {
      // Use SDP fingerprint for uniqueness
      const sdpFingerprint = signal.sdp?.sdp?.slice(0, 150) || signal.sdp?.slice(0, 150) || "";
      return `${signal.type}-${sdpFingerprint}`;
    }
    return `${signal.type}-${Date.now()}`;
  },

  // Assess the quality of the connection
  getConnectionQuality: (peerConnection) => {
    if (!peerConnection) return "unknown";

    const iceState = peerConnection.iceConnectionState;
    const connState = peerConnection.connectionState;

    if (connState === "failed" || iceState === "failed") return "poor";
    if (connState === "disconnected" || iceState === "disconnected") return "poor";
    if (connState === "connecting" || iceState === "checking") return "fair";
    if (connState === "connected" && iceState === "connected") return "good";
    if (connState === "connected" && iceState === "completed") return "excellent";

    return "unknown";
  },

  // Format error messages for better user experience
  formatErrorMessage: (error) => {
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
  }
};

// --- UI Formatting Utilities ---
const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

// --- Main VideoCall Component ---
// MODIFIED: Changed isActive to isOpen and added socketService as a prop
const VideoCall = ({
  isOpen, // Renamed from isActive
  user,
  recipient,
  onEndCall,
  socketService, // Added socketService as a prop
  isIncoming = false,
  callId = null,
  // recipientName is derived below now
}) => {
  // --- Derived values ---
  const recipientId = recipient?._id;
  const recipientName = recipient?.nickname || "User";
  const userId = user?._id;
  // --- Refs ---
  const refs = {
    // Video elements
    localVideo: useRef(null),
    remoteVideo: useRef(null),
    localPlaceholder: useRef(null),
    remotePlaceholder: useRef(null),


    // Visualization canvases
    qualityCanvas: useRef(null),
    localAudioCanvas: useRef(null),
    remoteAudioCanvas: useRef(null),

    // Media and connection
    localStream: useRef(null),
    peerConnection: useRef(null),
    audioAnalyser: useRef(null),
    audioData: useRef(null),
    remoteAudioAnalyser: useRef(null),
    remoteAudioData: useRef(null),

    // Timers
    signallingTimeout: useRef(null),
    connectionTimeout: useRef(null),
    reconnectTimeout: useRef(null),
    candidateFlushTimeout: useRef(null),
    statsInterval: useRef(null),
    audioMeterInterval: useRef(null),
    unansweredCallTimeout: useRef(null),

    // State tracking
    iceCandidateQueue: useRef([]),
    processedCandidates: useRef(new Set()),
    processedSignals: useRef(new Set()),
    incomingSignalQueue: useRef([]),
    negotiationInProgress: useRef(false),
    isMounted: useRef(false),
    connectionCompleted: useRef(false),
    callAnswered: useRef(false)
  };

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
    if (refs.localStream.current) {
      log.debug("Reusing existing media stream.");
      if (refs.localVideo.current && refs.localVideo.current.srcObject !== refs.localStream.current) {
        refs.localVideo.current.srcObject = refs.localStream.current;
      }

      // Setup audio visualization for existing stream
      if (!refs.audioAnalyser.current && refs.localStream.current.getAudioTracks().length > 0) {
        setupAudioVisualization();
      }

      return;
    }

    try {
      let stream = null;

      try {
        log.debug("Requesting user media with video and audio constraints.");
        stream = await navigator.mediaDevices.getUserMedia({
          video: CONFIG.media.video,
          audio: CONFIG.media.audio
        });
        log.debug("Acquired video and audio stream.");
        setIsLocalMuted(false);
        setIsLocalVideoOff(false);
      } catch (err) {
        log.warn(`Media acquisition with audio+video failed: ${err.message}. Trying fallbacks.`);

        // Fallback 1: Video only
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: CONFIG.media.video });
          setIsLocalMuted(true);
          setIsLocalVideoOff(false);
          toast.warning("Microphone access failed. You are muted.");
          log.warn("Acquired video-only stream.");
        } catch (err2) {
          log.warn(`Video-only acquisition failed: ${err2.message}. Trying audio only.`);

          // Fallback 2: Audio only
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: CONFIG.media.audio });
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

      refs.localStream.current = stream;

      if (refs.localVideo.current) {
        refs.localVideo.current.srcObject = stream;
        refs.localVideo.current.muted = true; // Mute local playback to prevent echo

        // If video is disabled, show placeholder canvas
        if (stream.getVideoTracks().length === 0 || !stream.getVideoTracks()[0].enabled) {
          setIsLocalVideoOff(true);
          if (refs.localPlaceholder.current) {
            canvasUtils.drawPlaceholderVideo(refs.localPlaceholder.current, "Camera Off");
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
    if (!refs.localStream.current || !refs.localStream.current.getAudioTracks().length) {
      return;
    }

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Local audio analyzer
      const localSource = audioContext.createMediaStreamSource(refs.localStream.current);
      const localAnalyser = audioContext.createAnalyser();
      localAnalyser.fftSize = 256;
      localSource.connect(localAnalyser);

      refs.audioAnalyser.current = localAnalyser;
      refs.audioData.current = new Uint8Array(localAnalyser.frequencyBinCount);

      // Start audio level monitoring
      if (refs.audioMeterInterval.current) {
        clearInterval(refs.audioMeterInterval.current);
      }

      refs.audioMeterInterval.current = setInterval(() => {
        updateAudioLevels();
      }, CONFIG.intervals.audioMeter);

      log.debug("Audio visualization setup complete");
    } catch (err) {
      log.warn("Could not setup audio visualization:", err);
    }
  }, []);

  // Update audio level meters
  const updateAudioLevels = useCallback(() => {
    // Update local audio level
    if (refs.audioAnalyser.current && refs.audioData.current && !isLocalMuted) {
      refs.audioAnalyser.current.getByteFrequencyData(refs.audioData.current);

      // Calculate average volume level
      const average = Array.from(refs.audioData.current)
        .reduce((sum, value) => sum + value, 0) / refs.audioData.current.length;

      // Normalize to 0-1 range
      const normalizedLevel = average / 255;
      setLocalAudioLevel(normalizedLevel);

      // Draw on canvas
      if (refs.localAudioCanvas.current) {
        canvasUtils.drawAudioLevel(refs.localAudioCanvas.current, normalizedLevel);
      }
    } else if (isLocalMuted && refs.localAudioCanvas.current) {
      // Show muted state
      canvasUtils.drawAudioLevel(refs.localAudioCanvas.current, 0);
      setLocalAudioLevel(0);
    }

    // Update remote audio level
    if (refs.remoteAudioAnalyser.current && refs.remoteAudioData.current && !isRemoteMuted) {
      refs.remoteAudioAnalyser.current.getByteFrequencyData(refs.remoteAudioData.current);

      // Calculate average volume level
      const average = Array.from(refs.remoteAudioData.current)
        .reduce((sum, value) => sum + value, 0) / refs.remoteAudioData.current.length;

      // Normalize to 0-1 range
      const normalizedLevel = average / 255;
      setRemoteAudioLevel(normalizedLevel);

      // Draw on canvas
      if (refs.remoteAudioCanvas.current) {
        canvasUtils.drawAudioLevel(refs.remoteAudioCanvas.current, normalizedLevel);
      }
    } else if (isRemoteMuted && refs.remoteAudioCanvas.current) {
      // Show muted state
      canvasUtils.drawAudioLevel(refs.remoteAudioCanvas.current, 0);
      setRemoteAudioLevel(0);
    }
  }, [isLocalMuted, isRemoteMuted]);

  // Flush queued remote ICE candidates after remote description is set
  const flushCandidateQueue = useCallback(async () => {
    if (!refs.peerConnection.current) {
      return;
    }

    if (refs.candidateFlushTimeout.current) {
      clearTimeout(refs.candidateFlushTimeout.current);
      refs.candidateFlushTimeout.current = null;
    }

    if (!refs.peerConnection.current.remoteDescription) {
      log.debug("Remote description not set yet, delaying candidate flush");
      refs.candidateFlushTimeout.current = setTimeout(flushCandidateQueue, 500);
      return;
    }

    const queue = [...refs.iceCandidateQueue.current];
    refs.iceCandidateQueue.current = [];

    if (queue.length > 0) {
      log.debug(`Flushing ${queue.length} queued ICE candidates.`);
    }

    for (const candidate of queue) {
      try {
        const fingerprint = rtcUtils.getCandidateFingerprint(candidate);

        if (!refs.processedCandidates.current.has(fingerprint)) {
          await refs.peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
          refs.processedCandidates.current.add(fingerprint);
        }
      } catch (err) {
        log.error("Error adding queued ICE candidate:", err);

        if (err.name === "OperationError" || err.message.includes("prerequisite")) {
          refs.iceCandidateQueue.current.push(candidate);
        }
      }
    }

    if (refs.iceCandidateQueue.current.length > 0 && !refs.candidateFlushTimeout.current) {
      refs.candidateFlushTimeout.current = setTimeout(flushCandidateQueue, 1000);
    }
  }, []);


  // MODIFIED: Create an offer with socketService prop
  const createOffer = useCallback(async (options = {}) => {
    // Check if socketService prop is available
    if (!socketService) {
        log.warn("createOffer: socketService prop is not available.");
        return;
    }

    if (!refs.peerConnection.current) {
      log.error("Cannot create offer: Peer connection does not exist.");
      return;
    }

    const pc = refs.peerConnection.current;

    // Prevent offer creation if state is not stable or negotiation is ongoing
    if (pc.signalingState !== "stable") {
      log.warn(`Cannot create offer in signaling state: ${pc.signalingState}. Aborting.`);
      return;
    }

    if (refs.negotiationInProgress.current) {
      log.warn("Negotiation already in progress, skipping offer creation.");
      return;
    }

    try {
      refs.negotiationInProgress.current = true;

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
        refs.negotiationInProgress.current = false;
        return;
      }

      await pc.setLocalDescription(offer);

      // Send the offer via signaling using the socketService prop
      const signalPayload = { type: "offer", sdp: pc.localDescription };
      const signalId = rtcUtils.getSignalId(signalPayload);
      refs.processedSignals.current.add(signalId);

      socketService.emit("videoSignal", {
        recipientId,
        signal: signalPayload,
        from: { userId, callId },
      });

      flushCandidateQueue();

      // If caller, set a flag to show we're waiting for the call to be answered
      if (!isIncoming && !refs.callAnswered.current) {
        setIsWaitingForResponse(true);

        // Set timeout for unanswered call
        if (refs.unansweredCallTimeout.current) {
          clearTimeout(refs.unansweredCallTimeout.current);
        }

        refs.unansweredCallTimeout.current = setTimeout(() => {
          if (!refs.callAnswered.current && refs.isMounted.current) {
            log.warn("Call went unanswered for too long. Ending call attempt.");
            setConnectionError("No answer from the recipient. They may be away or unable to accept calls right now.");
            setIsConnecting(false);
            setIsWaitingForResponse(false);

            // Auto-hang up after timeout
            if (onEndCall) {
              setTimeout(() => {
                if (refs.isMounted.current) onEndCall();
              }, 5000);
            }
          }
        }, CONFIG.timeouts.unansweredCall);
      }
    } catch (err) {
      log.error("Error creating or setting offer:", err);
      setConnectionError(`Signaling Error: ${err.message}`);
      refs.negotiationInProgress.current = false;
      attemptConnectionRecovery(createOffer);
    }
  }, [recipientId, userId, callId, flushCandidateQueue, isIncoming, onEndCall, socketService]); // Added socketService


  // Start the signaling process
  const startSignaling = useCallback(async () => {
    log.debug(`Starting signaling. Role: ${isIncoming ? "Callee (Incoming)" : "Caller (Outgoing)"}`);

    if (refs.signallingTimeout.current) {
      clearTimeout(refs.signallingTimeout.current);
    }

    // Timeout for the signaling phase
    refs.signallingTimeout.current = setTimeout(() => {
      if (refs.isMounted.current && !isConnected && isConnecting) {
        log.error("Signaling timeout reached. Connection failed.");
        setConnectionError(
          "Connection timed out. The other user may be offline or have network issues."
        );
        setIsConnecting(false);
        setIsWaitingForResponse(false);
      }
    }, CONFIG.timeouts.signaling);

    try {
      if (!refs.peerConnection.current) {
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

  // Flush signals that arrived before the peer connection was ready
  const flushIncomingSignalQueue = useCallback(() => {
    if (refs.incomingSignalQueue.current.length > 0) {
      log.debug(`Flushing ${refs.incomingSignalQueue.current.length} queued incoming signals`);

      const queue = [...refs.incomingSignalQueue.current];
      refs.incomingSignalQueue.current = [];

      queue.forEach(data => {
        handleVideoSignal(data);
      });
    }
  }, []);

  // MODIFIED: Handle local ICE candidates gathering with socketService prop
  const handleICECandidate = useCallback((event) => {
    // Check if socketService prop is available
    if (!socketService) {
        log.warn("handleICECandidate: socketService prop is not available.");
        return;
    }

    if (event.candidate && refs.peerConnection.current) {
      const fingerprint = rtcUtils.getCandidateFingerprint(event.candidate);

      if (refs.processedCandidates.current.has(fingerprint)) {
        return;
      }

      refs.processedCandidates.current.add(fingerprint);

      // Use the socketService prop to emit
      socketService.emit("videoSignal", {
        recipientId,
        signal: { type: "ice-candidate", candidate: event.candidate.toJSON() },
        from: { userId, callId },
      });
    }
  }, [recipientId, userId, callId, socketService]); // Added socketService to dependency array

  // Handle remote tracks
  const handleRemoteTrack = useCallback((event) => {
    try {
      if (!event.streams || event.streams.length === 0) {
        log.warn("Remote track received without a stream.");
        return;
      }

      const stream = event.streams[0];

      // Setup remote audio visualization if it's an audio track
      if (event.track.kind === "audio" && !refs.remoteAudioAnalyser.current) {
        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const remoteSource = audioContext.createMediaStreamSource(stream);
          const remoteAnalyser = audioContext.createAnalyser();
          remoteAnalyser.fftSize = 256;
          remoteSource.connect(remoteAnalyser);

          refs.remoteAudioAnalyser.current = remoteAnalyser;
          refs.remoteAudioData.current = new Uint8Array(remoteAnalyser.frequencyBinCount);
        } catch (err) {
          log.warn("Could not setup remote audio visualization:", err);
        }
      }

      // Attach stream to the remote video element if not already set
      if (refs.remoteVideo.current && refs.remoteVideo.current.srcObject !== stream) {
        refs.remoteVideo.current.srcObject = stream;

        // Mark connection as established
        refs.connectionCompleted.current = true;
        refs.callAnswered.current = true;
        setIsConnected(true);
        setIsConnecting(false);
        setIsWaitingForResponse(false);
        setConnectionError(null);
        setRetryCount(0);

        if (refs.connectionTimeout.current) {
          clearTimeout(refs.connectionTimeout.current);
          refs.connectionTimeout.current = null;
        }

        if (refs.unansweredCallTimeout.current) {
          clearTimeout(refs.unansweredCallTimeout.current);
          refs.unansweredCallTimeout.current = null;
        }
      }

      // Update remote status based on track's initial muted state
      if (event.track.kind === "audio") {
        const initialMuted = event.track.muted || !event.track.enabled;
        setIsRemoteMuted(initialMuted);

        event.track.onmute = () => setIsRemoteMuted(true);
        event.track.onunmute = () => setIsRemoteMuted(false);
        event.track.onended = () => setIsRemoteMuted(true);
      } else if (event.track.kind === "video") {
        const initialMuted = event.track.muted || !event.track.enabled;
        setIsRemoteVideoOff(initialMuted);

        // If video is disabled, show placeholder
        if (initialMuted && refs.remotePlaceholder.current) {
          canvasUtils.drawPlaceholderVideo(refs.remotePlaceholder.current, "Remote Camera Off");
        }

        event.track.onmute = () => {
          setIsRemoteVideoOff(true);
          if (refs.remotePlaceholder.current) {
            canvasUtils.drawPlaceholderVideo(refs.remotePlaceholder.current, "Remote Camera Off");
          }
        };

        event.track.onunmute = () => setIsRemoteVideoOff(false);

        event.track.onended = () => {
          setIsRemoteVideoOff(true);
          if (refs.remotePlaceholder.current) {
            canvasUtils.drawPlaceholderVideo(refs.remotePlaceholder.current, "Remote Video Ended");
          }
        };
      }
    } catch (err) {
      log.error("Error handling remote track:", err);
    }
  }, []);

  // Unified connection state handler
  const handleConnectionStateChange = useCallback(() => {
    if (!refs.peerConnection.current) return;
    const pc = refs.peerConnection.current;

    // Get current states
    const connectionState = pc.connectionState;
    const iceState = pc.iceConnectionState;

    // Update quality indicator
    const quality = rtcUtils.getConnectionQuality(pc);
    setConnectionQuality(quality);

    if (refs.qualityCanvas.current) {
      canvasUtils.drawConnectionQuality(refs.qualityCanvas.current, quality);
    }

    log.debug(`Connection states changed - RTCPeerConnection: ${connectionState}, ICE: ${iceState}`);

    // Handle connection state changes
    if (connectionState === "connected" || iceState === "connected" || iceState === "completed") {
      // Connection established
      refs.connectionCompleted.current = true;
      refs.callAnswered.current = true;
      setIsConnected(true);
      setIsConnecting(false);
      setIsWaitingForResponse(false);
      setConnectionError(null);
      refs.negotiationInProgress.current = false;
      setRetryCount(0);

      // Clear timers
      if (refs.connectionTimeout.current) {
        clearTimeout(refs.connectionTimeout.current);
        refs.connectionTimeout.current = null;
      }

      if (refs.unansweredCallTimeout.current) {
        clearTimeout(refs.unansweredCallTimeout.current);
        refs.unansweredCallTimeout.current = null;
      }

      flushCandidateQueue();
    }
    else if (connectionState === "disconnected" || iceState === "disconnected") {
      // Temporary disconnection - wait to see if it recovers
      log.warn(`Connection state: ${connectionState}, ICE state: ${iceState}`);

      // Don't immediately update UI, wait to see if it recovers
      setTimeout(() => {
        if (refs.isMounted.current &&
            (refs.peerConnection.current?.connectionState === "disconnected" ||
             refs.peerConnection.current?.iceConnectionState === "disconnected")) {
          log.warn("Connection still disconnected after grace period");
          setIsConnected(false);

          // Try to recover the connection if ice state is disconnected
          if (refs.peerConnection.current?.iceConnectionState === "disconnected") {
            attemptConnectionRecovery(createOffer);
          }
        }
      }, 3000);
    }
    else if (connectionState === "failed" || iceState === "failed") {
      // Connection failed
      log.error(`Connection failed - state: ${connectionState}, ICE: ${iceState}`);
      setIsConnected(false);
      setIsConnecting(false);
      setConnectionError("Connection failed. Please retry.");

      // Attempt reconnection
      attemptReconnect(createPeerConnection, startSignaling);
    }
    else if (connectionState === "closed") {
      // Connection closed
      log.info("Connection closed");
      setIsConnected(false);
      setIsConnecting(false);
    }
    else if (connectionState === "connecting" || iceState === "checking") {
      // Connection in progress
      if (!isConnected) {
        setIsConnecting(true);
      }
    }
  }, [flushCandidateQueue, isConnected]);

  // Create and configure the RTCPeerConnection
  const createPeerConnection = useCallback(async () => {
    log.debug("Creating new RTCPeerConnection");

    // Clean up any existing connection
    if (refs.peerConnection.current) {
      refs.peerConnection.current.close();
      refs.peerConnection.current = null;
    }

    // Reset state
    refs.processedCandidates.current.clear();
    refs.processedSignals.current.clear();
    refs.iceCandidateQueue.current = [];
    refs.incomingSignalQueue.current = [];
    refs.negotiationInProgress.current = false;

    try {
      const pc = new RTCPeerConnection(CONFIG.peerConnection);

      // Add local media tracks
      if (refs.localStream.current) {
        refs.localStream.current.getTracks().forEach((track) => {
          try {
            pc.addTrack(track, refs.localStream.current);
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
      pc.oniceconnectionstatechange = handleConnectionStateChange;

      // Additional state monitoring
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === "complete") {
          flushCandidateQueue();
        }
      };

      pc.onsignalingstatechange = () => {
        refs.negotiationInProgress.current = (pc.signalingState !== "stable");
      };

      refs.peerConnection.current = pc;

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
    flushCandidateQueue,
    flushIncomingSignalQueue
  ]);

  // MODIFIED: Create an answer with socketService prop
  const createAnswer = useCallback(async () => {
    // Check if socketService prop is available
    if (!socketService) {
        log.warn("createAnswer: socketService prop is not available.");
        return;
    }

    if (!refs.peerConnection.current) {
      log.error("Cannot create answer: Peer connection does not exist.");
      return;
    }

    const pc = refs.peerConnection.current;

    // Should only create answer if we have a remote offer
    if (pc.signalingState !== "have-remote-offer") {
      log.warn(`Cannot create answer in signaling state: ${pc.signalingState}. Aborting.`);
      return;
    }

    try {
      refs.negotiationInProgress.current = true;

      const answer = await pc.createAnswer();

      // Check state again before setting local description
      if (pc.signalingState !== "have-remote-offer") {
        log.warn(`Signaling state changed during answer creation. Aborting.`);
        refs.negotiationInProgress.current = false;
        return;
      }

      await pc.setLocalDescription(answer);

      // Send the answer via signaling using the socketService prop
      const signalPayload = { type: "answer", sdp: pc.localDescription };
      const signalId = rtcUtils.getSignalId(signalPayload);
      refs.processedSignals.current.add(signalId);

      socketService.emit("videoSignal", {
        recipientId,
        signal: signalPayload,
        from: { userId, callId },
      });

      flushCandidateQueue();

      // Mark the call as answered when we send an answer
      if (isIncoming) {
        refs.callAnswered.current = true;
      }
    } catch (err) {
      log.error("Error creating or setting answer:", err);
      setConnectionError(`Signaling Error: ${err.message}`);
      refs.negotiationInProgress.current = false;
      attemptConnectionRecovery(createOffer);
    }
  }, [recipientId, userId, callId, flushCandidateQueue, createOffer, isIncoming, socketService]); // Added socketService

  // Socket signal handler for incoming WebRTC signaling messages
  const handleVideoSignal = useCallback((data) => {
    // Basic validation
    if (!data || !data.signal || !data.signal.type || !data.userId) {
      log.warn("Received invalid signal data structure.");
      return;
    }

    // Ignore signals not from expected recipient
    if (data.userId !== recipientId) {
      return;
    }

    const signal = data.signal;
    const signalType = signal.type;

    // If peer connection isn't ready yet, queue the signal
    if (!refs.peerConnection.current) {
      log.warn(`Peer connection not ready. Queuing '${signalType}' signal.`);
      refs.incomingSignalQueue.current.push(data);
      return;
    }

    const pc = refs.peerConnection.current;
    const currentState = pc.signalingState;

    // Prevent processing duplicate signals
    const signalId = rtcUtils.getSignalId(signal);
    if (refs.processedSignals.current.has(signalId)) {
      return;
    }

    try {
      switch (signalType) {
        case "request-offer":
          if (currentState === "stable" && !refs.negotiationInProgress.current) {
            createOffer().catch(err => log.error("Error creating offer:", err));
          }
          break;

        case "offer":
          refs.processedSignals.current.add(signalId);

          // If receiving an offer, the other party is online and responding
          if (!isIncoming) {
            setIsWaitingForResponse(false);
            if (refs.unansweredCallTimeout.current) {
              clearTimeout(refs.unansweredCallTimeout.current);
              refs.unansweredCallTimeout.current = null;
            }
          }

          // Offer/Answer Collision (Glare) Handling
          const isMakingOffer = refs.negotiationInProgress.current && currentState === "have-local-offer";

          if (isMakingOffer) {
            log.warn("Offer collision detected (both peers sending offers).");
            // Use user IDs as tie-breaker. Higher ID accepts offer
            const politePeer = userId > recipientId;

            if (politePeer) {
              log.debug("This peer is polite. Rolling back local offer and accepting remote offer.");
              refs.negotiationInProgress.current = false;

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
            pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
              .then(() => {
                flushCandidateQueue();

                // Create answer if state is now have-remote-offer
                if (pc.signalingState === "have-remote-offer") {
                  return createAnswer();
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
          // If receiving an answer, the remote user has explicitly accepted the call
          if (!isIncoming) {
            refs.callAnswered.current = true;
            setIsWaitingForResponse(false);
            if (refs.unansweredCallTimeout.current) {
              clearTimeout(refs.unansweredCallTimeout.current);
              refs.unansweredCallTimeout.current = null;
            }
          }

          if (currentState === "have-local-offer") {
            refs.processedSignals.current.add(signalId);

            pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
              .then(() => {
                log.debug("Remote answer set successfully. Connection should establish soon.");
                refs.negotiationInProgress.current = false;
                flushCandidateQueue();
              })
              .catch(err => {
                log.error("Error setting remote answer description:", err);
                setConnectionError(`Signaling Error: ${err.message}`);
              });
          }
          break;

        case "ice-candidate":
          if (!signal.candidate) {
            return;
          }

          const candidate = new RTCIceCandidate(signal.candidate);
          const fingerprint = rtcUtils.getCandidateFingerprint(candidate);

          if (refs.processedCandidates.current.has(fingerprint)) {
            return;
          }

          // Queue if remote description not yet set
          if (!pc.remoteDescription) {
            log.debug("Queuing remote ICE candidate (no remote description yet).");
            refs.iceCandidateQueue.current.push(candidate);
          } else {
            pc.addIceCandidate(candidate)
              .then(() => {
                refs.processedCandidates.current.add(fingerprint);
              })
              .catch(err => {
                log.error("Error adding remote ICE candidate:", err);
                // Only re-queue if we think it might succeed later
                if (pc.signalingState !== 'closed') {
                  refs.iceCandidateQueue.current.push(candidate);
                }
              });
          }
          break;
      }
    } catch (err) {
      log.error(`Error processing signal type ${signalType}:`, err);
      setConnectionError(`Signaling Error: ${err.message}`);
      refs.negotiationInProgress.current = false;
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
    if (!refs.peerConnection.current || !refs.isMounted.current) return;
    const pc = refs.peerConnection.current;

    log.warn("Attempting connection recovery (ICE Restart).");

    // Update UI to show recovery attempt
    setConnectionQuality(rtcUtils.getConnectionQuality(pc));

    if (refs.qualityCanvas.current) {
      canvasUtils.drawConnectionQuality(refs.qualityCanvas.current, "poor");
    }

    // Check if ICE restart is supported and needed
    if (
      typeof pc.restartIce === "function" &&
      (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed")
    ) {
      log.debug("Performing ICE restart.");
      refs.negotiationInProgress.current = false;
      pc.restartIce();

      // An offer might need to be created after ICE restart
      if (!isIncoming && pc.signalingState === 'stable') {
        log.debug("Initiator attempting offer creation after ICE restart.");

        setTimeout(() => {
          if (refs.isMounted.current &&
              refs.peerConnection.current?.signalingState === 'stable') {
            createOfferFunc({ iceRestart: true })
              .catch(e => log.error("Error creating recovery offer:", e));
          }
        }, 500);
      }
    } else {
      log.warn(`ICE restart not applicable or supported. State: ${pc.iceConnectionState}. Attempting full reconnect.`);
      attemptReconnect(createPeerConnection, startSignaling);
    }
  }, [isIncoming, createPeerConnection, startSignaling]);

  // Attempt full reconnection (create new PeerConnection)
  const attemptReconnect = useCallback((createPC, startSig) => {
    if (!refs.isMounted.current) return;

    if (retryCount >= CONFIG.retry.maxCount) {
      log.error("Max reconnection attempts reached. Giving up.");
      setConnectionError(
        "Failed to establish connection after multiple attempts. Please check network or try again later."
      );
      setIsConnecting(false);
      return;
    }

    // Avoid scheduling multiple reconnects
    if (refs.reconnectTimeout.current) {
      log.debug("Reconnect attempt already scheduled.");
      return;
    }

    setIsConnecting(true);
    setIsConnected(false);
    setRetryCount(prev => prev + 1);

    const currentAttempt = retryCount + 1;
    log.warn(`Attempting full reconnect (${currentAttempt}/${CONFIG.retry.maxCount}) in ${CONFIG.timeouts.reconnect}ms...`);

    setConnectionError(`Connection lost. Attempting to reconnect (${currentAttempt}/${CONFIG.retry.maxCount})...`);

    refs.reconnectTimeout.current = setTimeout(async () => {
      refs.reconnectTimeout.current = null;

      if (!refs.isMounted.current) return;

      try {
        // Create a completely new peer connection
        await createPC();

        if (!refs.isMounted.current) return;

        // Re-initialize signaling
        await startSig();
      } catch (err) {
        log.error(`Error during reconnection attempt ${currentAttempt}:`, err);
        setConnectionError(`Reconnection failed: ${err.message}`);
        setIsConnecting(false);

        // Schedule next retry if applicable
        if (currentAttempt < CONFIG.retry.maxCount) {
          attemptReconnect(createPC, startSig);
        } else {
          log.error("Final reconnection attempt failed.");
          setConnectionError("Failed to reconnect. Please try again later.");
        }
      }
    }, CONFIG.timeouts.reconnect);
  }, [retryCount, createPeerConnection]);


  // Gather WebRTC stats for debugging and quality monitoring
  const getConnectionStats = useCallback(async () => {
    if (!refs.peerConnection.current || !isConnected) return;

    try {
      const statsReport = await refs.peerConnection.current.getStats();

      // Extract useful stats
      let inboundVideo = null;
      let candidatePair = null;

      statsReport.forEach(report => {
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          inboundVideo = report;
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
        // Quality assessment based on multiple metrics
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
        if (refs.qualityCanvas.current) {
          canvasUtils.drawConnectionQuality(refs.qualityCanvas.current, quality);
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
    const timeouts = [
      'signallingTimeout', 'connectionTimeout', 'reconnectTimeout',
      'candidateFlushTimeout', 'unansweredCallTimeout'
    ];

    const intervals = ['statsInterval', 'audioMeterInterval'];

    // Clear all timeouts
    timeouts.forEach(timeoutName => {
      if (refs[timeoutName].current) {
        clearTimeout(refs[timeoutName].current);
        refs[timeoutName].current = null;
      }
    });

    // Clear all intervals
    intervals.forEach(intervalName => {
      if (refs[intervalName].current) {
        clearInterval(refs[intervalName].current);
        refs[intervalName].current = null;
      }
    });

    // Stop local media tracks
    if (refs.localStream.current) {
      refs.localStream.current.getTracks().forEach((track) => {
        track.stop();
      });
      refs.localStream.current = null;
    }

    // Clean up audio analyzers
    refs.audioAnalyser.current = null;
    refs.audioData.current = null;
    refs.remoteAudioAnalyser.current = null;
    refs.remoteAudioData.current = null;

    // Detach streams from video elements
    if (refs.localVideo.current) refs.localVideo.current.srcObject = null;
    if (refs.remoteVideo.current) refs.remoteVideo.current.srcObject = null;

    // Close peer connection
    if (refs.peerConnection.current) {
      refs.peerConnection.current.close();
      refs.peerConnection.current = null;
    }

    // Clear other refs
    refs.iceCandidateQueue.current = [];
    refs.incomingSignalQueue.current = [];
    refs.processedCandidates.current.clear();
    refs.processedSignals.current.clear();
    refs.negotiationInProgress.current = false;
    refs.connectionCompleted.current = false;
    refs.callAnswered.current = false;
  }, []);

  // MODIFIED: Media control with socketService prop
  const toggleMute = useCallback(() => {
    // Check if socketService prop is available
    if (!socketService) {
        log.warn("toggleMute: socketService prop is not available.");
        return;
    }

    if (!refs.localStream.current) return;

    const audioTracks = refs.localStream.current.getAudioTracks();
    if (audioTracks.length > 0) {
      const newMuteState = !isLocalMuted;
      audioTracks[0].enabled = !newMuteState;
      setIsLocalMuted(newMuteState);

      // Update canvas
      if (refs.localAudioCanvas.current) {
        canvasUtils.drawAudioLevel(refs.localAudioCanvas.current, newMuteState ? 0 : localAudioLevel);
      }

      // Notify remote peer using the socketService prop
      socketService.emit("videoMediaControl", {
        recipientId,
        type: "audio",
        muted: newMuteState,
      });
    }
  }, [isLocalMuted, recipientId, localAudioLevel, socketService]); // Added socketService

  // MODIFIED: Toggle video with socketService prop
  const toggleVideo = useCallback(() => {
    // Check if socketService prop is available
    if (!socketService) {
        log.warn("toggleVideo: socketService prop is not available.");
        return;
    }

    if (!refs.localStream.current) return;

    const videoTracks = refs.localStream.current.getVideoTracks();
    if (videoTracks.length > 0) {
      const newVideoState = !isLocalVideoOff;
      videoTracks[0].enabled = !newVideoState;
      setIsLocalVideoOff(newVideoState);

      // Update placeholder
      if (refs.localPlaceholder.current) {
        if (newVideoState) {
          canvasUtils.drawPlaceholderVideo(refs.localPlaceholder.current, "Camera Off");
        }
      }

      // Notify remote peer using the socketService prop
      socketService.emit("videoMediaControl", {
        recipientId,
        type: "video",
        muted: newVideoState,
      });
    }
  }, [isLocalVideoOff, recipientId, socketService]); // Added socketService

  // MODIFIED: End call with socketService prop
  const handleEndCall = useCallback(() => {
    // Check if socketService prop is available
    if (!socketService) {
        log.warn("handleEndCall: socketService prop is not available.");
        // Still call onEndCall locally even if socket fails
        if (onEndCall) {
            onEndCall();
        }
        return;
    }

    // Use the socketService prop to emit
    socketService.emit("videoHangup", { recipientId });

    if (onEndCall) {
      onEndCall();
    }
  }, [recipientId, onEndCall, socketService]); // Added socketService

  const toggleFullscreen = useCallback(() => {
    const container = document.querySelector(`.${styles.videoContainer}`);
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
    refs.isMounted.current = true;

    return () => {
      refs.isMounted.current = false;
      closeConnection();
    };
  }, [closeConnection]);

  // Effect for setting up and initializing the call
  // MODIFIED: Changed isActive to isOpen
  useEffect(() => {
    if (isOpen && refs.isMounted.current) {
      // Reset connection state
      refs.connectionCompleted.current = false;
      refs.callAnswered.current = false;

      // Set overall connection timeout
      refs.connectionTimeout.current = setTimeout(() => {
        if (refs.isMounted.current && !refs.connectionCompleted.current) {
          setConnectionError("Connection failed to establish after 30 seconds.");
          setIsConnecting(false);
          setIsWaitingForResponse(false);
        }
      }, CONFIG.timeouts.connection);

      // Initialization sequence
      const initializeCall = async () => {
        try {
          setConnectionError(null);
          setIsConnecting(true);
          setRetryCount(0);
          setIsWaitingForResponse(false);

          await initializeMedia();
          if (!refs.isMounted.current) return;

          await createPeerConnection();
          if (!refs.isMounted.current) return;

          await startSignaling();
          if (!refs.isMounted.current) return;
        } catch (err) {
          if (refs.isMounted.current) {
            setIsConnecting(false);
            setIsWaitingForResponse(false);
            setConnectionError(`Setup failed: ${err.message}`);
          }
        }
      };

      initializeCall();

      // Set up stats gathering interval
      refs.statsInterval.current = setInterval(() => {
        getConnectionStats();
      }, CONFIG.intervals.stats);

      // Start call duration timer
      const durationInterval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);

      // Return cleanup function
      return () => {
        clearInterval(durationInterval);
        closeConnection();
        setCallDuration(0);
      };
    } else if (!isOpen && refs.peerConnection.current) {
      // If call becomes inactive, ensure cleanup
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
    isOpen, // Changed from isActive
    initializeMedia,
    createPeerConnection,
    startSignaling,
    closeConnection,
    getConnectionStats
  ]);

  // MODIFIED: Effect for setting up socket event listeners using socketService prop
  useEffect(() => {
    // Check if required props are available
    if (!isOpen || !socketService || !recipientId) {
        log.debug("Socket listener effect skipped: component not open or props missing.");
        return;
    }

    log.debug("Setting up socket listeners for VideoCall");

    // Socket event handlers (ensure these are stable or defined outside/memoized if complex)
    const handleVideoSignalEvent = (data) => handleVideoSignal(data); // handleVideoSignal is already useCallback

    const handleHangup = (data) => {
      if (data.userId === recipientId) {
        log.info("Received hangup signal from peer.");
        toast.info("The other user has ended the call.");
        if (onEndCall) onEndCall();
      }
    };

    const handleMediaControl = (data) => {
      if (data.userId === recipientId) {
        log.debug(`Received media control: type=${data.type}, muted=${data.muted}`);
        if (data.type === "audio") {
          setIsRemoteMuted(data.muted);
          if (refs.remoteAudioCanvas.current) {
            canvasUtils.drawAudioLevel(refs.remoteAudioCanvas.current, data.muted ? 0 : remoteAudioLevel);
          }
        }
        if (data.type === "video") {
          setIsRemoteVideoOff(data.muted);
          if (data.muted && refs.remotePlaceholder.current) {
            canvasUtils.drawPlaceholderVideo(refs.remotePlaceholder.current, "Remote Camera Off");
          }
        }
      }
    };

    const handleErrorSignal = (data) => {
       log.error(`Received remote error signal: ${data?.error}`);
       setConnectionError(`Remote Error: ${data?.error || 'Unknown issue'}`);
       setIsConnecting(false);
       setIsWaitingForResponse(false);
    };

    // Register event listeners using the socketService prop
    const unsubscribeSignal = socketService.on("videoSignal", handleVideoSignalEvent);
    const unsubscribeHangup = socketService.on("videoHangup", handleHangup);
    const unsubscribeMedia = socketService.on("videoMediaControl", handleMediaControl);
    const unsubscribeError = socketService.on("videoError", handleErrorSignal);

    // Return cleanup function
    return () => {
      log.debug("Cleaning up socket listeners for VideoCall");
      // Use the unsubscribe functions returned by socketService.on
      if (typeof unsubscribeSignal === 'function') unsubscribeSignal();
      if (typeof unsubscribeHangup === 'function') unsubscribeHangup();
      if (typeof unsubscribeMedia === 'function') unsubscribeMedia();
      if (typeof unsubscribeError === 'function') unsubscribeError();
    };
    // Add all stable dependencies used inside the effect
  }, [isOpen, recipientId, onEndCall, handleVideoSignal, remoteAudioLevel, socketService]); // Added socketService

  // Effect for showing/hiding controls on mouse movement
  useEffect(() => {
    let controlsTimeout = null;

    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeout) clearTimeout(controlsTimeout);
      controlsTimeout = setTimeout(() => {
        if (refs.isMounted.current) setShowControls(false);
      }, 3000);
    };

    const container = document.querySelector(`.${styles.videoContainer}`);
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
    if (refs.qualityCanvas.current) {
      canvasUtils.drawConnectionQuality(refs.qualityCanvas.current, connectionQuality);
    }

    // Initialize audio level canvases
    if (refs.localAudioCanvas.current) {
      canvasUtils.drawAudioLevel(refs.localAudioCanvas.current, isLocalMuted ? 0 : localAudioLevel);
    }

    if (refs.remoteAudioCanvas.current) {
      canvasUtils.drawAudioLevel(refs.remoteAudioCanvas.current, isRemoteMuted ? 0 : remoteAudioLevel);
    }

    // Initialize video placeholders if needed
    if (isLocalVideoOff && refs.localPlaceholder.current) {
      canvasUtils.drawPlaceholderVideo(refs.localPlaceholder.current, "Camera Off");
    }

    if (isRemoteVideoOff && refs.remotePlaceholder.current) {
      canvasUtils.drawPlaceholderVideo(refs.remotePlaceholder.current, "Remote Camera Off");
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

  // --- Component Rendering ---

  // Render call controls
  const renderCallControls = () => (
    <div className={`${styles.callControls} ${showControls ? styles.visible : styles.hidden}`}>
      <button
        className={`${styles.controlButton} ${isLocalMuted ? styles.active : ""}`}
        onClick={toggleMute}
        aria-label={isLocalMuted ? "Unmute Microphone" : "Mute Microphone"}
        aria-pressed={isLocalMuted}
      >
        {isLocalMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
      </button>

      <button
        className={`${styles.controlButton} ${isLocalVideoOff ? styles.active : ""}`}
        onClick={toggleVideo}
        aria-label={isLocalVideoOff ? "Turn Camera On" : "Turn Camera Off"}
        aria-pressed={isLocalVideoOff}
      >
        {isLocalVideoOff ? <FaVideoSlash /> : <FaVideo />}
      </button>

      <button
        className={`${styles.controlButton} ${styles.endCall}`}
        onClick={handleEndCall}
        aria-label="End Call"
      >
        <FaPhoneSlash />
      </button>

      <button
        className={`${styles.controlButton} ${isFullscreen ? styles.active : ""}`}
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        aria-pressed={isFullscreen}
      >
        {isFullscreen ? <FaCompressAlt /> : <FaExpandAlt />}
      </button>

      <button
        className={styles.controlButton}
        aria-label="Show connection quality"
      >
        <FaSignal />
        <span className={`${styles.qualityDot} ${styles[connectionQuality]}`}></span>
      </button>
    </div>
  );

  // Final component render
  return (
    <div className={styles.videoCall}>
      <div className={styles.videoContainer}>
        {/* Remote video */}
        <div className={styles.remoteVideoWrapper}>
          <video
            ref={refs.remoteVideo}
            className={styles.remoteVideo}
            autoPlay
            playsInline
          />

          {/* Remote video placeholder when video is off */}
          {isRemoteVideoOff && (
            <canvas
              ref={refs.remotePlaceholder}
              className={`${styles.videoPlaceholder} ${styles.remoteVideoPlaceholder}`}
              width="640"
              height="480"
            ></canvas>
          )}

          {/* Connection quality indicator */}
          <div className={styles.connectionQualityIndicator}>
            <canvas
              ref={refs.qualityCanvas}
              width="100"
              height="30"
              className={`${styles.qualityCanvas} ${styles[connectionQuality]}`}
            ></canvas>
            <span className={`${styles.qualityText} ${styles[connectionQuality]}`}>
              {connectionQuality}
            </span>
          </div>

          {/* Remote audio level indicator */}
          <div className={styles.remoteAudioIndicator}>
            <canvas
              ref={refs.remoteAudioCanvas}
              width="15"
              height="80"
              className={styles.audioLevelCanvas}
            ></canvas>
          </div>

          {/* Remote audio status indicator */}
          {isRemoteMuted && !isConnecting && !connectionError && (
            <div className={styles.audioOffIndicator}>
              <FaMicrophoneSlash aria-label="Remote peer muted" />
            </div>
          )}

          {/* Waiting for answer indicator */}
          {isWaitingForResponse && !connectionError && (
            <div className={styles.waitingIndicator}>
              <FaSpinner className={styles.spin} aria-hidden="true" />
              <span>Calling {recipientName}...</span>
              <span className={styles.waitingSubtext}>Waiting for answer</span>
            </div>
          )}

          {/* Connecting indicator */}
          {isConnecting && !isConnected && !isWaitingForResponse && (
            <div className={styles.connectingIndicator}>
              <FaSpinner className={styles.spin} aria-hidden="true" />
              <span>Connecting...</span>
              {retryCount > 0 && (
                <span className={styles.retryCount}>
                  Attempt {retryCount}/{CONFIG.retry.maxCount}
                </span>
              )}
            </div>
          )}

          {/* Error message overlay */}
          {connectionError && !isConnecting && (
            <div className={styles.errorIndicator}>
              <div className={styles.errorMessage}>
                <FaExclamationTriangle className={styles.errorIcon} />
                <span>{rtcUtils.formatErrorMessage(connectionError)}</span>
                {retryCount < CONFIG.retry.maxCount && !isConnected && (
                  <button
                    className={styles.retryButton}
                    onClick={() => attemptReconnect(createPeerConnection, startSignaling)}
                    aria-label="Retry connection"
                  >
                    <FaUndo /> Retry
                  </button>
                )}
                <button
                  className={styles.errorEndCallButton}
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
        <div className={styles.localVideoWrapper}>
          <video
            ref={refs.localVideo}
            className={styles.localVideo}
            autoPlay
            playsInline
            muted
          />

          {/* Local video placeholder when video is off */}
          {isLocalVideoOff && (
            <canvas
              ref={refs.localPlaceholder}
              className={`${styles.videoPlaceholder} ${styles.localVideoPlaceholder}`}
              width="160"
              height="120"
            ></canvas>
          )}

          {/* Local audio level indicator */}
          <div className={styles.localAudioIndicator}>
            <canvas
              ref={refs.localAudioCanvas}
              width="10"
              height="60"
              className={styles.audioLevelCanvas}
            ></canvas>
          </div>
        </div>

        {/* Call info display */}
        <div className={styles.callInfo}>
          <span className={styles.callDuration} aria-label={`Call duration: ${formatDuration(callDuration)}`}>
            {formatDuration(callDuration)}
          </span>

          {isConnected && videoStats.resolution && (
            <span className={styles.videoStats}>
              {videoStats.resolution} • {videoStats.frameRate} fps
            </span>
          )}
        </div>

        {/* Call control buttons */}
        {renderCallControls()}
      </div>
    </div>
  );
};

// MODIFIED: Updated PropTypes with new prop names
VideoCall.propTypes = {
  isOpen: PropTypes.bool.isRequired, // Renamed from isActive
  user: PropTypes.shape({
    _id: PropTypes.string.isRequired,
  }),
  recipient: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    nickname: PropTypes.string,
  }),
  onEndCall: PropTypes.func.isRequired,
  socketService: PropTypes.object.isRequired, // Added socketService prop type
  isIncoming: PropTypes.bool,
  callId: PropTypes.string,
};

// MODIFIED: Updated DefaultProps
VideoCall.defaultProps = {
  isIncoming: false,
  callId: null,
  user: null,
  recipient: null,
};

export default VideoCall;
