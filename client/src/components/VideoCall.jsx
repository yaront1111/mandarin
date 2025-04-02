import React, { useState, useEffect, useRef } from "react";
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
} from "react-icons/fa";
import socketService from "../services/socketService.jsx";
import { toast } from "react-toastify";
import { logger } from "../utils";

// Create a logger for this component
const log = logger.create("VideoCall");

/**
 * VideoCall component for WebRTC video calls
 * Provides a complete video calling interface with local and remote video streams
 */
const VideoCall = ({
  isActive,
  userId,
  recipientId,
  onEndCall,
  isIncoming = false,
  callId = null,
}) => {
  // Refs for video elements and connection
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const signallingTimeoutRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const iceCandidateQueueRef = useRef([]);
  
  // State for UI and call control
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

  // Constants
  const MAX_RETRY_COUNT = 3;
  const SIGNALLING_TIMEOUT = 15000;
  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ];

  // Start the call by initializing media and connections
  useEffect(() => {
    // Only run if the call is active
    if (!isActive) return;

    log.debug(`Initializing video call with ${recipientId}`);
    
    let mounted = true;
    
    const initializeMediaAndConnection = async () => {
      try {
        setIsConnecting(true);
        setConnectionError(null);
        
        // Initialize local media
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        if (!mounted) {
          // Clean up if component unmounted during initialization
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        // Store the stream for later use
        localStreamRef.current = stream;
        
        // Display local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true; // Mute local video to prevent echo
        }
        
        // Initialize peer connection
        await createPeerConnection();
        
        // Start signaling with the remote peer
        startSignaling();
        
      } catch (err) {
        log.error("Error initializing media:", err);
        setConnectionError(`Failed to access camera or microphone: ${err.message}`);
        setIsConnecting(false);
      }
    };
    
    initializeMediaAndConnection();
    
    // Set up a timer to track call duration
    const durationTimer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    
    // Clean up on unmount
    return () => {
      mounted = false;
      clearInterval(durationTimer);
      closeConnection();
    };
  }, [isActive, recipientId, userId, isIncoming, callId]);

  // Function to flush queued ICE candidates
  const flushIceCandidates = () => {
    if (iceCandidateQueueRef.current && iceCandidateQueueRef.current.length > 0) {
      log.debug(`Flushing ${iceCandidateQueueRef.current.length} queued ICE candidates`);
      
      // Check connection and signaling state
      if (peerConnectionRef.current) {
        const signalingState = peerConnectionRef.current.signalingState;
        const connectionState = peerConnectionRef.current.connectionState || 'unknown';
        const iceConnectionState = peerConnectionRef.current.iceConnectionState || 'unknown';
        
        log.debug(`Connection state before flushing: signaling=${signalingState}, connection=${connectionState}, ice=${iceConnectionState}`);
        
        // Only proceed if we have a valid connection
        const validSignalingStates = ["have-local-offer", "have-remote-offer", "stable"];
        
        // Clone the queue to avoid mutation issues during processing
        const candidatesToProcess = [...iceCandidateQueueRef.current];
        iceCandidateQueueRef.current = [];
        
        // Separate local candidates (to send) from remote candidates (to add)
        const localCandidates = candidatesToProcess.filter(c => !c.isRemote);
        const remoteCandidates = candidatesToProcess.filter(c => c.isRemote);
        
        log.debug(`Processing ${localCandidates.length} local and ${remoteCandidates.length} remote candidates`);
        
        // Process remote candidates first (apply them to our local connection)
        let remoteProcessed = 0;
        
        if (remoteCandidates.length > 0 && 
            (signalingState === "have-remote-offer" || signalingState === "have-local-pranswer" || signalingState === "stable")) {
            
          // Process remote candidates first
          remoteCandidates.forEach((candidate, index) => {
            // Clone and remove our marker property
            const { isRemote, ...cleanCandidate } = candidate;
            
            peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(cleanCandidate))
              .then(() => {
                remoteProcessed++;
                if (remoteProcessed === remoteCandidates.length) {
                  log.debug(`Successfully processed all ${remoteProcessed} remote ICE candidates`);
                }
              })
              .catch(err => {
                log.error(`Error adding remote ICE candidate: ${err.message}`);
                // If still failing, re-queue for later
                if (!iceCandidateQueueRef.current) {
                  iceCandidateQueueRef.current = [];
                }
                iceCandidateQueueRef.current.push(candidate);
              });
          });
        } else if (remoteCandidates.length > 0) {
          log.warn(`Cannot process remote candidates in state: ${signalingState}, re-queueing`);
          // Put back in the queue
          if (!iceCandidateQueueRef.current) {
            iceCandidateQueueRef.current = [];
          }
          iceCandidateQueueRef.current.push(...remoteCandidates);
        }
        
        // Process local candidates (send them to the remote peer)
        if (localCandidates.length > 0 && validSignalingStates.includes(signalingState)) {
          // Send candidates with a small delay between each to prevent flooding
          let sentCount = 0;
          
          // Sort candidates by priority (send host candidates first)
          localCandidates.sort((a, b) => {
            // Try to prioritize host candidates (local network)
            const aIsHost = a.candidate && a.candidate.includes('host');
            const bIsHost = b.candidate && b.candidate.includes('host');
            
            if (aIsHost && !bIsHost) return -1;
            if (!aIsHost && bIsHost) return 1;
            return 0;
          });
          
          // Send candidates with a small delay between them
          localCandidates.forEach((candidate, index) => {
            setTimeout(() => {
              if (peerConnectionRef.current) {
                socketService.emit("videoSignal", {
                  recipientId,
                  signal: {
                    type: "ice-candidate",
                    candidate
                  },
                  from: {
                    userId,
                    callId
                  }
                });
                sentCount++;
                
                // Log completion
                if (index === localCandidates.length - 1) {
                  log.debug(`Sent ${sentCount} local ICE candidates`);
                }
              }
            }, index * 30); // 30ms delay between candidates
          });
        } else if (localCandidates.length > 0) {
          log.warn(`Cannot send local candidates in state: ${signalingState}, re-queueing`);
          // Put back in the queue
          if (!iceCandidateQueueRef.current) {
            iceCandidateQueueRef.current = [];
          }
          iceCandidateQueueRef.current.push(...localCandidates);
          
          // Schedule another flush attempt
          setTimeout(flushIceCandidates, 1000);
        }
      } else {
        log.warn("Cannot flush ICE candidates: peer connection not initialized");
        // Don't lose the candidates, put them back
        if (iceCandidateQueueRef.current.length === 0) {
          iceCandidateQueueRef.current = [...iceCandidateQueueRef.current];
        }
      }
    }
  };

  // Create a peer connection for WebRTC
  const createPeerConnection = async () => {
    try {
      // Create a new RTCPeerConnection
      const pc = new RTCPeerConnection({
        iceServers: ICE_SERVERS
      });
      
      // Add local tracks to the peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current);
        });
      }
      
      // Handle incoming remote tracks
      pc.ontrack = handleRemoteTrack;
      
      // Handle ICE candidates
      pc.onicecandidate = handleICECandidate;
      
      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        log.debug(`Connection state changed: ${pc.connectionState}`);
        
        switch (pc.connectionState) {
          case "connecting":
            // Attempt to flush candidates regularly during connecting phase
            flushIceCandidates();
            
            // Schedule additional flushes during the connecting phase
            // This helps ensure candidates get through even with network delays
            const flushInterval = setInterval(() => {
              if (peerConnectionRef.current && peerConnectionRef.current.connectionState === "connecting") {
                log.debug("Scheduled flush during connecting phase");
                flushIceCandidates();
              } else {
                clearInterval(flushInterval);
              }
            }, 1000); // Flush every second while connecting
            
            // Auto-clear after 10 seconds to avoid memory leaks
            setTimeout(() => clearInterval(flushInterval), 10000);
            break;
            
          case "connected":
            setIsConnected(true);
            setIsConnecting(false);
            log.info("Peer connection established successfully");
            
            // Log successful connection details
            logConnectionStats();
            
            // Final flush of any remaining candidates
            flushIceCandidates();
            break;
            
          case "disconnected":
            setIsConnected(false);
            log.warn(`Peer connection disconnected`);
            
            // Try sending any remaining candidates in case that helps
            flushIceCandidates();
            
            // Attempt recovery for disconnected state
            setTimeout(() => {
              if (peerConnectionRef.current && peerConnectionRef.current.connectionState === "disconnected") {
                log.debug("Still disconnected after delay, attempting recovery");
                attemptConnectionRecovery();
              }
            }, 2000);
            break;
            
          case "failed":
            setIsConnected(false);
            log.error(`Peer connection failed`);
            
            // Get diagnostic info
            logConnectionStats();
            
            // Attempt more aggressive reconnection for failed state
            attemptReconnect();
            break;
            
          case "closed":
            setIsConnected(false);
            log.info("Peer connection closed");
            break;
        }
      };
      
      // Handle ICE connection state changes
      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        log.debug(`ICE connection state changed: ${state}`);
        
        switch (state) {
          case "checking":
            // During checking, flush candidates to increase chances of finding a path
            flushIceCandidates();
            break;
            
          case "connected":
          case "completed":
            // Successfully connected
            log.debug(`ICE connection ${state}`);
            
            // If we're completed, we can log what candidate pair was selected
            if (state === "completed") {
              logSelectedCandidatePair();
            }
            break;
            
          case "failed":
            log.error("ICE connection failed, attempting to restart ICE");
            
            // Log failure diagnostics
            logConnectionStats();
            
            // Try to restart ICE
            pc.restartIce();
            
            // If we have unflushed candidates, try sending them
            flushIceCandidates();
            break;
            
          case "disconnected":
            log.warn("ICE connection disconnected");
            // Sometimes disconnected is temporary, wait a bit before reacting
            setTimeout(() => {
              if (peerConnectionRef.current && 
                  peerConnectionRef.current.iceConnectionState === "disconnected") {
                log.debug("Still disconnected after delay, flushing candidates");
                flushIceCandidates();
              }
            }, 1000);
            break;
        }
      };
      
      // Also track ICE gathering state
      pc.onicegatheringstatechange = () => {
        const state = pc.iceGatheringState;
        log.debug(`ICE gathering state changed: ${state}`);
        
        if (state === "complete") {
          // We've finished gathering candidates, so flush any that haven't been sent
          log.debug("ICE gathering complete, flushing all candidates");
          flushIceCandidates();
        }
      };
      
      // Store the peer connection for later use
      peerConnectionRef.current = pc;
      
      log.debug("Peer connection created successfully");
      
    } catch (err) {
      log.error("Error creating peer connection:", err);
      setConnectionError(`Failed to create connection: ${err.message}`);
      setIsConnecting(false);
    }
  };

  // Start the signaling process for WebRTC
  const startSignaling = async () => {
    // Clear any existing timeout
    if (signallingTimeoutRef.current) {
      clearTimeout(signallingTimeoutRef.current);
    }
    
    // Set a timeout for signaling
    signallingTimeoutRef.current = setTimeout(() => {
      if (!isConnected) {
        log.error("Signaling timeout reached");
        setConnectionError("Connection timed out. The other person may be having connection issues.");
        setIsConnecting(false);
      }
    }, SIGNALLING_TIMEOUT);
    
    try {
      if (!peerConnectionRef.current) {
        throw new Error("Peer connection not initialized");
      }
      
      // Check current state before proceeding
      const currentState = peerConnectionRef.current.signalingState;
      log.debug(`Current signaling state before starting: ${currentState}`);
      
      if (isIncoming) {
        // For incoming calls, wait for an offer before creating an answer
        // We won't create an answer now - we'll wait for the offer to arrive
        log.debug("Waiting for offer (this is an incoming call)");
        
        // If the call is incoming but we haven't received an offer yet,
        // we'll emit a special message to request an offer
        socketService.emit("videoSignal", {
          recipientId,
          signal: {
            type: "request-offer",
          },
          from: {
            userId,
            callId
          }
        });
      } else {
        // For outgoing calls, create an offer
        if (currentState === "stable") {
          log.debug("Creating offer for outgoing call");
          await createOffer();
        } else {
          log.warn(`Cannot create offer in state: ${currentState}, waiting for state to stabilize`);
          // Wait a bit and try again if needed
          setTimeout(() => {
            if (peerConnectionRef.current && peerConnectionRef.current.signalingState === "stable") {
              createOffer().catch(err => {
                log.error("Delayed offer creation error:", err);
              });
            }
          }, 1000);
        }
      }
    } catch (err) {
      log.error("Error in signaling process:", err);
      setConnectionError(`Signaling error: ${err.message}`);
      setIsConnecting(false);
    }
  };

  // Create an offer for outgoing calls
  const createOffer = async () => {
    try {
      if (!peerConnectionRef.current) return;
      
      // Log current state before creating offer
      const currentState = peerConnectionRef.current.signalingState;
      log.debug(`Current signaling state before creating offer: ${currentState}`);
      
      // Only create offer in the right state
      if (currentState !== 'stable') {
        log.error(`Cannot create offer in state: ${currentState}`);
        return Promise.reject(new Error(`Cannot create offer in state: ${currentState}`));
      }
      
      // Create an offer with modern options
      const offerOptions = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        iceRestart: peerConnectionRef.current.iceConnectionState === 'failed'
      };
      
      // Create the offer
      const offer = await peerConnectionRef.current.createOffer(offerOptions);
      
      // Set the local description
      await peerConnectionRef.current.setLocalDescription(offer);
      
      log.debug("Offer created and set as local description");
      
      // Now that local description is set, we can flush any queued ICE candidates
      flushIceCandidates();
      
      // Send the offer to the recipient via socket
      socketService.emit("videoSignal", {
        recipientId,
        signal: {
          type: "offer",
          sdp: offer
        },
        from: {
          userId,
          callId
        }
      });
      
      log.debug("Offer sent to recipient");
      
      // Return a resolved promise so callers can chain operations
      return Promise.resolve();
    } catch (err) {
      log.error("Error creating offer:", err);
      return Promise.reject(err);
    }
  };

  // Create an answer for incoming calls
  const createAnswer = async () => {
    try {
      if (!peerConnectionRef.current) return;
      
      // Check signaling state before creating answer
      const currentState = peerConnectionRef.current.signalingState;
      log.debug(`Current signaling state before creating answer: ${currentState}`);
      
      // Only create answer in the correct state
      if (currentState !== 'have-remote-offer') {
        log.error(`Cannot create answer in state: ${currentState}`);
        
        // If we're in a stable state and need to create an answer,
        // it probably means we need an offer first
        if (currentState === 'stable') {
          log.debug("In stable state but need to create answer - requesting offer");
          
          // Request an offer from the other peer
          socketService.emit("videoSignal", {
            recipientId,
            signal: {
              type: "request-offer"
            },
            from: {
              userId,
              callId
            }
          });
        } else {
          setConnectionError(`Cannot create answer in state: ${currentState}`);
        }
        
        return;
      }
      
      // Create an answer
      log.debug("Creating answer - signaling state is have-remote-offer");
      const answer = await peerConnectionRef.current.createAnswer();
      
      // Set the local description
      await peerConnectionRef.current.setLocalDescription(answer);
      
      log.debug("Answer created and set as local description");
      
      // Now that local description is set, we can flush ICE candidates
      flushIceCandidates();
      
      // Send the answer to the recipient via socket
      socketService.emit("videoSignal", {
        recipientId,
        signal: {
          type: "answer",
          sdp: answer
        },
        from: {
          userId,
          callId
        }
      });
      
      log.debug("Answer sent to caller");
      
      // Return a resolved promise so callers can chain operations
      return Promise.resolve();
    } catch (err) {
      log.error("Error creating answer:", err);
      
      // If we get a state error, try to recover
      if (err.message && err.message.includes("state")) {
        log.debug("Attempting to recover from state error");
        
        // Request a new offer
        socketService.emit("videoSignal", {
          recipientId,
          signal: {
            type: "request-offer"
          },
          from: {
            userId,
            callId
          }
        });
        
        // Return a rejected promise
        return Promise.reject(err);
      } else {
        throw err;
      }
    }
  };

  // Handle ICE candidates
  const handleICECandidate = (event) => {
    if (event.candidate) {
      // Analyze the candidate type
      const candidateType = analyzeCandidate(event.candidate);
      log.debug(`New ICE candidate generated: ${candidateType}`);
      
      // Check if we're in a valid state to send ICE candidates
      const canSendNow = canSendIceCandidate();
      
      if (canSendNow) {
        // Log sending of candidate
        log.debug(`Sending ICE candidate immediately: ${candidateType}`);
        
        // Send the ICE candidate to the recipient via socket
        socketService.emit("videoSignal", {
          recipientId,
          signal: {
            type: "ice-candidate",
            candidate: event.candidate
          },
          from: {
            userId,
            callId
          }
        });
      } else {
        // Queue the candidate for later
        log.debug(`Queueing ICE candidate: ${candidateType}`);
        
        // Ensure the queue exists
        if (!iceCandidateQueueRef.current) {
          iceCandidateQueueRef.current = [];
        }
        
        // Queue the candidate
        iceCandidateQueueRef.current.push(event.candidate);
        
        // If we have too many queued candidates, trim the queue more aggressively
        if (iceCandidateQueueRef.current.length > 20) {
          log.warn("ICE candidate queue is getting large, trimming more aggressively");
          
          // Separate local and remote candidates
          const localCandidates = iceCandidateQueueRef.current.filter(c => !c.isRemote);
          const remoteCandidates = iceCandidateQueueRef.current.filter(c => c.isRemote);
          
          // Find host candidates (most important for local network)
          const localHostCandidates = localCandidates.filter(c => 
            c.candidate && c.candidate.includes("host")).slice(0, 5);
          const remoteHostCandidates = remoteCandidates.filter(c => 
            c.candidate && c.candidate.includes("host")).slice(0, 5);
            
          // Get a few most recent non-host candidates of each type
          const localRecentCandidates = localCandidates
            .filter(c => !c.candidate || !c.candidate.includes("host"))
            .slice(-5);
          const remoteRecentCandidates = remoteCandidates
            .filter(c => !c.candidate || !c.candidate.includes("host"))
            .slice(-5);
            
          // Combine all selected candidates
          iceCandidateQueueRef.current = [
            ...localHostCandidates,
            ...remoteHostCandidates,
            ...localRecentCandidates,
            ...remoteRecentCandidates
          ];
          
          log.debug(`Aggressively trimmed ICE queue to ${iceCandidateQueueRef.current.length} candidates`);
        }
      }
    }
  };
  
  // Helper to determine if we can send an ICE candidate immediately
  const canSendIceCandidate = () => {
    if (!peerConnectionRef.current) return false;
    
    const signalingState = peerConnectionRef.current.signalingState;
    const connectionState = peerConnectionRef.current.connectionState || 'unknown';
    const iceConnectionState = peerConnectionRef.current.iceConnectionState || 'unknown';
    
    // Valid signaling states for sending ICE candidates
    const validSignalingStates = ["have-local-offer", "have-remote-offer", "stable"];
    
    // Only send if:
    // 1. We're in a valid signaling state AND
    // 2. Either the connection is not new or we're in stable signaling state
    return (
      validSignalingStates.includes(signalingState) && 
      (connectionState !== "new" || signalingState === "stable")
    );
  };
  
  // Helper to analyze ICE candidate types
  const analyzeCandidate = (candidate) => {
    if (!candidate || !candidate.candidate) return "unknown";
    
    const candidateStr = candidate.candidate;
    
    if (candidateStr.includes("host")) return "host";
    if (candidateStr.includes("srflx")) return "srflx (server reflexive)";
    if (candidateStr.includes("prflx")) return "prflx (peer reflexive)";
    if (candidateStr.includes("relay")) return "relay (TURN)";
    
    return "unknown";
  };

  // Handle incoming remote tracks
  const handleRemoteTrack = (event) => {
    log.debug("Received remote track");
    
    if (remoteVideoRef.current && event.streams && event.streams[0]) {
      log.debug("Setting remote video stream");
      remoteVideoRef.current.srcObject = event.streams[0];
      setIsConnected(true);
      setIsConnecting(false);
    }
  };

  // Handle incoming signals from socket
  useEffect(() => {
    if (!isActive) return;
    
    log.debug("Setting up socket signal handlers");
    
    // Handle incoming video signals
    const handleVideoSignal = (data) => {
      // Make sure the signal is from the recipient
      if (data.userId !== recipientId) return;
      
      log.debug(`Received signal of type: ${data.signal?.type}`);
      
      if (!peerConnectionRef.current) {
        log.error("Received signal but peer connection is not initialized");
        return;
      }
      
      try {
        const signal = data.signal;
        
        if (signal.type === "request-offer") {
          // The other peer is requesting an offer from us
          log.debug("Received request for offer, creating one");
          
          // Only create an offer if we're in a stable state
          if (peerConnectionRef.current.signalingState === "stable") {
            createOffer().catch(err => {
              log.error("Error creating offer after request:", err);
            });
          } else {
            log.warn(`Cannot create offer in state: ${peerConnectionRef.current.signalingState}`);
            // Try resetting the connection
            peerConnectionRef.current.close();
            createPeerConnection().then(() => {
              createOffer().catch(err => {
                log.error("Error creating offer after reset:", err);
              });
            });
          }
        }
        else if (signal.type === "offer") {
          log.debug("Processing incoming offer");
          
          // Check connection state before applying the offer
          const currentState = peerConnectionRef.current.signalingState;
          log.debug(`Current signaling state before processing offer: ${currentState}`);
          
          if (currentState === "have-local-offer") {
            // We're in a glare situation (both sides created offers)
            // Follow the perfect negotiation pattern based on polite/impolite peers
            // For simplicity, let's assume the caller is always the "impolite" peer
            const isPolite = isIncoming; // Incoming call means we're the polite peer
            
            if (isPolite) {
              log.debug("Rollback local description due to glare situation");
              try {
                // Rollback by closing and recreating the connection
                if (peerConnectionRef.current) {
                  peerConnectionRef.current.close();
                  createPeerConnection().then(() => {
                    // Process the offer with the new connection
                    peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal.sdp))
                      .then(() => createAnswer())
                      .catch(err => {
                        log.error("Error processing offer after reset:", err);
                        setConnectionError(`Error processing offer: ${err.message}`);
                      });
                  });
                  return;
                }
              } catch (err) {
                log.error("Error during rollback:", err);
                setConnectionError(`Error during signaling: ${err.message}`);
                return;
              }
            } else {
              // Impolite peer ignores the offer
              log.debug("Ignoring offer as impolite peer in glare situation");
              return;
            }
          } else if (currentState !== "stable") {
            log.warn(`Unexpected signaling state ${currentState}, attempting to reset connection`);
            // Close and recreate the peer connection
            if (peerConnectionRef.current) {
              peerConnectionRef.current.close();
              createPeerConnection().then(() => {
                // Try again with the new connection
                peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal.sdp))
                  .then(() => createAnswer())
                  .catch(err => {
                    log.error("Error processing offer after reset:", err);
                    setConnectionError(`Error processing offer: ${err.message}`);
                  });
              });
              return;
            }
          }
          
          // Set the remote description
          try {
            // In stable state, we can directly apply the offer
            if (currentState === "stable") {
              log.debug("Processing offer in stable state");
              
              // Set remote description and create answer in sequence
              peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal.sdp))
                .then(() => {
                  log.debug("Remote offer set successfully, flushing any queued ICE candidates");
                  
                  // First flush any remote candidates that were waiting for the remote description
                  flushIceCandidates();
                  
                  // Small delay to ensure state transition is complete
                  setTimeout(() => {
                    if (peerConnectionRef.current.signalingState === "have-remote-offer") {
                      log.debug("State is now have-remote-offer, creating answer");
                      createAnswer()
                        .then(() => {
                          log.debug("Answer created and sent, flushing any candidates collected during process");
                          // Flush again in case new candidates were generated
                          setTimeout(flushIceCandidates, 100);
                        })
                        .catch(err => {
                          log.error("Error creating answer after delay:", err);
                        });
                    } else {
                      log.warn(`Cannot create answer - unexpected state after offer: ${peerConnectionRef.current.signalingState}`);
                    }
                  }, 200);
                })
                .catch(err => {
                  log.error("Error setting remote description:", err);
                  setConnectionError(`Error processing offer: ${err.message}`);
                });
            } else {
              log.warn(`Not processing offer in state: ${currentState}`);
              
              // Try resetting the connection to get back to a stable state
              peerConnectionRef.current.close();
              createPeerConnection().then(() => {
                log.debug("Connection reset, trying to process offer");
                
                // Set remote description on the new connection
                peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal.sdp))
                  .then(() => {
                    if (peerConnectionRef.current.signalingState === "have-remote-offer") {
                      return createAnswer();
                    }
                  })
                  .catch(err => {
                    log.error("Error after connection reset:", err);
                    setConnectionError(`Error after reset: ${err.message}`);
                  });
              });
            }
          } catch (err) {
            log.error("Critical error in offer handling:", err);
            setConnectionError(`Critical error: ${err.message}`);
          }
        }
        else if (signal.type === "answer") {
          log.debug("Processing incoming answer");
          
          // Check connection state before applying the answer
          const currentState = peerConnectionRef.current.signalingState;
          log.debug(`Current signaling state before processing answer: ${currentState}`);
          
          // Only apply answer if we're in have-local-offer state
          if (currentState !== "have-local-offer") {
            log.warn(`Cannot set remote answer in state: ${currentState}, ignoring`);
            return;
          }
          
          // Set the remote description
          peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal.sdp))
            .then(() => {
              log.debug("Remote answer set successfully, flushing any queued candidates");
              // Now that we have set the remote description, we can flush any queued candidates
              setTimeout(flushIceCandidates, 100);
            })
            .catch(err => {
              log.error("Error processing answer:", err);
              setConnectionError(`Error processing answer: ${err.message}`);
            });
        }
        else if (signal.type === "ice-candidate") {
          // Analyze the incoming candidate
          const candidateType = analyzeCandidate(signal.candidate);
          log.debug(`Processing incoming ICE candidate: ${candidateType}`);
          
          try {
            // Check if we can process the candidate right now
            const signalingState = peerConnectionRef.current.signalingState;
            const connectionState = peerConnectionRef.current.connectionState || 'unknown';
            const iceConnectionState = peerConnectionRef.current.iceConnectionState || 'unknown';
            
            log.debug(`State before adding ICE candidate: signaling=${signalingState}, connection=${connectionState}, ice=${iceConnectionState}`);
            
            // Before trying to add candidates, check if remote description is null
            const hasRemoteDescription = peerConnectionRef.current.remoteDescription !== null;
            
            if (!hasRemoteDescription) {
              log.warn("Cannot add ICE candidate: Remote description is null");
              
              // Queue only a limited number of candidates when remote description is null
              if (!iceCandidateQueueRef.current) {
                iceCandidateQueueRef.current = [];
              }
              
              // We use a special property to mark this as a remote candidate
              const remoteCandidate = { ...signal.candidate, isRemote: true };
              
              // Only queue if we don't have too many candidates already
              if (iceCandidateQueueRef.current.filter(c => c.isRemote).length < 20) {
                iceCandidateQueueRef.current.push(remoteCandidate);
                log.debug(`Queued remote ICE candidate (${candidateType}) for when remote description is set`);
              } else if (signal.candidate.candidate && signal.candidate.candidate.includes("host")) {
                // Always keep host candidates as they're most likely to work for local connections
                iceCandidateQueueRef.current.push(remoteCandidate);
                log.debug(`Queued host remote ICE candidate despite queue size`);
              } else {
                log.debug(`Discarded remote ICE candidate (${candidateType}) due to queue size`);
              }
              
              return;
            }
            
            // If we have a remote description, check if we're in an appropriate state to add the candidate
            if (signalingState === "have-remote-offer" || 
                signalingState === "have-local-pranswer" || 
                signalingState === "stable") {
              
              // Create ICE candidate and add it
              try {
                const candidate = new RTCIceCandidate(signal.candidate);
                await peerConnectionRef.current.addIceCandidate(candidate);
                log.debug(`Successfully added ICE candidate: ${candidateType}`);
              } catch (err) {
                log.error(`Error adding ICE candidate: ${err.message}`);
                
                // If error is about remote description, queue it despite our earlier check
                // This can happen if the remote description was set but is not fully processed
                if (err.message.includes("setRemoteDescription") || 
                    err.message.includes("remote description")) {
                  
                  // Only queue if we don't have too many candidates already
                  if (!iceCandidateQueueRef.current) {
                    iceCandidateQueueRef.current = [];
                  }
                  
                  if (iceCandidateQueueRef.current.filter(c => c.isRemote).length < 10) {
                    // We use a special property to mark this as a remote candidate
                    const remoteCandidate = { ...signal.candidate, isRemote: true };
                    iceCandidateQueueRef.current.push(remoteCandidate);
                    log.debug(`Error occurred, will retry adding this candidate once remote description is fully processed`);
                  }
                }
              }
            } else {
              log.warn(`Cannot add ICE candidate in state: ${signalingState}, queueing for later`);
              
              // Queue only a limited number of candidates
              if (!iceCandidateQueueRef.current) {
                iceCandidateQueueRef.current = [];
              }
              
              // We use a special property to mark this as a remote candidate
              const remoteCandidate = { ...signal.candidate, isRemote: true };
              
              // Only queue if we don't have too many candidates already or it's a host candidate
              if (iceCandidateQueueRef.current.filter(c => c.isRemote).length < 10 || 
                 (signal.candidate.candidate && signal.candidate.candidate.includes("host"))) {
                iceCandidateQueueRef.current.push(remoteCandidate);
              }
            }
          } catch (err) {
            log.error("Critical error processing ICE candidate:", err);
          }
        }
      } catch (err) {
        log.error("Error processing signal:", err);
      }
    };
    
    // Handle media control signals
    const handleMediaControl = (data) => {
      // Make sure the signal is from the recipient
      if (data.userId !== recipientId) return;
      
      log.debug(`Received media control: ${data.type} - muted: ${data.muted}`);
      
      if (data.type === "audio") {
        setIsRemoteMuted(data.muted);
      } else if (data.type === "video") {
        setIsRemoteVideoOff(data.muted);
      }
    };
    
    // Handle hangup signals
    const handleHangup = (data) => {
      // Make sure the signal is from the recipient
      if (data.userId !== recipientId) return;
      
      log.debug("Received hangup signal");
      
      // End the call
      if (onEndCall) {
        onEndCall();
      }
    };
    
    // Handle error signals
    const handleVideoError = (data) => {
      log.error("Received video error signal:", data.error);
      setConnectionError(`Connection error: ${data.error}`);
      setIsConnecting(false);
    };
    
    // Register the event listeners
    const videoSignalListener = socketService.on("videoSignal", handleVideoSignal);
    const mediaControlListener = socketService.on("videoMediaControl", handleMediaControl);
    const hangupListener = socketService.on("videoHangup", handleHangup);
    const errorListener = socketService.on("videoError", handleVideoError);
    
    // Clean up on unmount
    return () => {
      videoSignalListener();
      mediaControlListener();
      hangupListener();
      errorListener();
    };
  }, [isActive, recipientId, userId, onEndCall, callId]);

  // Log connection statistics for debugging
  const logConnectionStats = async () => {
    try {
      if (!peerConnectionRef.current) return;
      
      log.debug("Getting connection stats...");
      
      const stats = await peerConnectionRef.current.getStats();
      let importantStats = {
        networkType: "unknown",
        localCandidateType: "unknown",
        remoteCandidateType: "unknown",
        roundTripTime: "unknown",
        packetsLost: 0,
        localAddress: "unknown",
        remoteAddress: "unknown"
      };
      
      // Process the stats
      stats.forEach(stat => {
        if (stat.type === 'transport') {
          importantStats.networkType = stat.networkType || "unknown";
        } else if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
          importantStats.roundTripTime = stat.currentRoundTripTime ? 
            `${(stat.currentRoundTripTime * 1000).toFixed(2)}ms` : "unknown";
        } else if (stat.type === 'local-candidate') {
          importantStats.localCandidateType = stat.candidateType || "unknown";
          importantStats.localAddress = stat.address ? 
            `${stat.address}:${stat.port}` : "unknown";
        } else if (stat.type === 'remote-candidate') {
          importantStats.remoteCandidateType = stat.candidateType || "unknown";
          importantStats.remoteAddress = stat.address ? 
            `${stat.address}:${stat.port}` : "unknown";
        } else if (stat.type === 'inbound-rtp' && stat.packetsLost) {
          importantStats.packetsLost += stat.packetsLost;
        }
      });
      
      log.debug("Connection stats:", JSON.stringify(importantStats, null, 2));
    } catch (err) {
      log.error("Error getting connection stats:", err);
    }
  };
  
  // Log the selected ICE candidate pair
  const logSelectedCandidatePair = async () => {
    try {
      if (!peerConnectionRef.current) return;
      
      const stats = await peerConnectionRef.current.getStats();
      let selectedPair = null;
      let localCandidate = null;
      let remoteCandidate = null;
      
      // Find the selected candidate pair
      stats.forEach(stat => {
        if (stat.type === 'candidate-pair' && stat.selected) {
          selectedPair = stat;
        } else if (stat.type === 'local-candidate') {
          localCandidate = stat;
        } else if (stat.type === 'remote-candidate') {
          remoteCandidate = stat;
        }
      });
      
      if (selectedPair && localCandidate && remoteCandidate) {
        log.info(`Selected ICE candidate pair: 
          Local: ${localCandidate.candidateType} (${localCandidate.protocol}) 
          Remote: ${remoteCandidate.candidateType} (${remoteCandidate.protocol})
          RTT: ${selectedPair.currentRoundTripTime ? 
            (selectedPair.currentRoundTripTime * 1000).toFixed(2) + 'ms' : 'unknown'}
        `);
      } else {
        log.warn("Could not find selected ICE candidate pair");
      }
    } catch (err) {
      log.error("Error getting selected candidate pair:", err);
    }
  };
  
  // Less aggressive connection recovery for temporary issues
  const attemptConnectionRecovery = () => {
    log.debug("Attempting connection recovery without full reconnect");
    
    try {
      if (!peerConnectionRef.current) return;
      
      // Log current state
      const signalingState = peerConnectionRef.current.signalingState;
      const connectionState = peerConnectionRef.current.connectionState;
      const iceConnectionState = peerConnectionRef.current.iceConnectionState;
      
      log.debug(`Recovery - Current state: signaling=${signalingState}, connection=${connectionState}, ice=${iceConnectionState}`);
      
      // Try to restart ICE if the connection exists
      if (iceConnectionState === "disconnected" || iceConnectionState === "failed") {
        log.debug("Trying to restart ICE negotiation");
        peerConnectionRef.current.restartIce();
        
        // For disconnected state, try flushing candidates again
        flushIceCandidates();
        
        // If not in a stable state, try to recover with a new offer
        if (signalingState === "stable" && !isIncoming) {
          log.debug("Creating recovery offer");
          createOffer().catch(err => {
            log.error("Error creating recovery offer:", err);
          });
        }
      }
    } catch (err) {
      log.error("Error during connection recovery:", err);
      // Fall back to full reconnect if recovery fails
      attemptReconnect();
    }
  };
  
  // Full reconnect attempt for failed connections
  const attemptReconnect = () => {
    if (retryCount >= MAX_RETRY_COUNT) {
      log.error(`Max retry count (${MAX_RETRY_COUNT}) reached`);
      setConnectionError("Failed to establish connection after multiple attempts.");
      setIsConnecting(false);
      return;
    }
    
    // Clear any existing timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    setIsConnecting(true);
    setRetryCount(prev => prev + 1);
    
    log.debug(`Attempting full reconnect (attempt ${retryCount + 1}/${MAX_RETRY_COUNT})`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      // Save ICE candidates that might be useful
      const savedCandidates = iceCandidateQueueRef.current || [];
      
      // Close the existing connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      
      // Create a new peer connection
      createPeerConnection().then(() => {
        // Restore any ICE candidates that might still be useful
        // (particularly useful for host candidates)
        const hostCandidates = savedCandidates.filter(c => 
          c && c.candidate && c.candidate.includes("host"));
          
        if (hostCandidates.length > 0) {
          log.debug(`Restoring ${hostCandidates.length} host candidates from old connection`);
          iceCandidateQueueRef.current = hostCandidates;
        }
        
        // Start signaling again
        startSignaling();
      }).catch(err => {
        log.error("Error during reconnection:", err);
        setConnectionError(`Reconnection failed: ${err.message}`);
        setIsConnecting(false);
      });
    }, 2000); // Wait 2 seconds before reconnecting
  };

  // Close the connection and clean up
  const closeConnection = () => {
    log.debug("Closing connection");
    
    // Clear any timeouts
    if (signallingTimeoutRef.current) {
      clearTimeout(signallingTimeoutRef.current);
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    // Stop all tracks in the local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Close the peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  };

  // Toggle local audio
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      
      if (audioTracks.length > 0) {
        const newMuteState = !isLocalMuted;
        audioTracks[0].enabled = !newMuteState;
        setIsLocalMuted(newMuteState);
        
        // Notify the other peer about the audio state change
        socketService.emit("videoMediaControl", {
          recipientId,
          type: "audio",
          muted: newMuteState
        });
        
        log.debug(`Local audio ${newMuteState ? 'muted' : 'unmuted'}`);
      }
    }
  };

  // Toggle local video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      
      if (videoTracks.length > 0) {
        const newVideoState = !isLocalVideoOff;
        videoTracks[0].enabled = !newVideoState;
        setIsLocalVideoOff(newVideoState);
        
        // Notify the other peer about the video state change
        socketService.emit("videoMediaControl", {
          recipientId,
          type: "video",
          muted: newVideoState
        });
        
        log.debug(`Local video ${newVideoState ? 'disabled' : 'enabled'}`);
      }
    }
  };

  // Handle ending the call
  const handleEndCall = () => {
    // Notify the other peer about the hangup
    socketService.emit("videoHangup", {
      recipientId
    });
    
    // Call the onEndCall callback
    if (onEndCall) {
      onEndCall();
    }
  };

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    const container = document.querySelector(".video-container");
    
    if (!container) return;
    
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(err => {
        toast.error(`Error entering fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Format the call duration time
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Format connection error messages for display
  const formatErrorMessage = (error) => {
    if (!error) return null;
    
    // Common error messages and their user-friendly versions
    const errorMap = {
      'Failed to access camera or microphone: Permission denied': 'Camera or microphone access was denied. Please check your browser permissions.',
      'Failed to access camera or microphone: NotFoundError': 'Could not find a camera or microphone. Please check your device.',
      'Connection timed out': 'Connection timed out. The other person may be having connection issues.',
    };
    
    // Return the mapped error or the original error if no mapping exists
    return errorMap[error] || error;
  };

  // Show/hide controls based on mouse movement
  useEffect(() => {
    let controlsTimeout;
    
    const handleMouseMove = () => {
      setShowControls(true);
      
      clearTimeout(controlsTimeout);
      
      controlsTimeout = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };
    
    const videoContainer = document.querySelector(".video-container");
    
    if (videoContainer) {
      videoContainer.addEventListener("mousemove", handleMouseMove);
    }
    
    return () => {
      clearTimeout(controlsTimeout);
      
      if (videoContainer) {
        videoContainer.removeEventListener("mousemove", handleMouseMove);
      }
    };
  }, []);

  // Main render method
  return (
    <div className="video-call">
      <div className="video-container" onMouseMove={() => setShowControls(true)}>
        {/* Remote video (large) */}
        <div className="remote-video-wrapper">
          <video
            ref={remoteVideoRef}
            className="remote-video"
            autoPlay
            playsInline
          />
          
          {/* Show camera/mic off indicators for remote video */}
          {isRemoteVideoOff && (
            <div className="video-off-indicator">
              <FaVideoSlash />
              <span>Camera Off</span>
            </div>
          )}
          
          {isRemoteMuted && (
            <div className="audio-off-indicator">
              <FaMicrophoneSlash />
            </div>
          )}
          
          {/* Connection state indicators */}
          {isConnecting && (
            <div className="connecting-indicator">
              <FaSpinner className="spin" />
              <span>Connecting...</span>
            </div>
          )}
          
          {connectionError && (
            <div className="error-indicator">
              <div className="error-message">
                <span>{formatErrorMessage(connectionError)}</span>
                {retryCount < MAX_RETRY_COUNT && (
                  <button className="retry-button" onClick={attemptReconnect}>
                    <FaUndo /> Retry
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Local video (small overlay) */}
        <div className="local-video-wrapper">
          <video
            ref={localVideoRef}
            className="local-video"
            autoPlay
            playsInline
            muted
          />
          
          {/* Show camera off indicator for local video */}
          {isLocalVideoOff && (
            <div className="local-video-off">
              <FaVideoSlash />
            </div>
          )}
        </div>
        
        {/* Call duration display */}
        <div className="call-duration">
          {formatDuration(callDuration)}
        </div>
        
        {/* Call controls */}
        <div className={`call-controls ${showControls ? 'visible' : 'hidden'}`}>
          <button
            className={`control-button ${isLocalMuted ? 'active' : ''}`}
            onClick={toggleMute}
            title={isLocalMuted ? "Unmute" : "Mute"}
          >
            {isLocalMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
          </button>
          
          <button
            className={`control-button ${isLocalVideoOff ? 'active' : ''}`}
            onClick={toggleVideo}
            title={isLocalVideoOff ? "Turn Camera On" : "Turn Camera Off"}
          >
            {isLocalVideoOff ? <FaVideoSlash /> : <FaVideo />}
          </button>
          
          <button
            className="control-button end-call"
            onClick={handleEndCall}
            title="End Call"
          >
            <FaPhoneSlash />
          </button>
          
          <button
            className={`control-button ${isFullscreen ? 'active' : ''}`}
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <FaCompressAlt /> : <FaExpandAlt />}
          </button>
        </div>
      </div>
      
      <style jsx="true">{`
        .video-call {
          width: 100%;
          height: 100%;
          position: relative;
          background-color: #000;
          overflow: hidden;
          border-radius: 8px;
        }
        
        .video-container {
          width: 100%;
          height: 100%;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .remote-video-wrapper {
          width: 100%;
          height: 100%;
          position: relative;
          overflow: hidden;
        }
        
        .remote-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          background-color: #222;
        }
        
        .local-video-wrapper {
          position: absolute;
          width: 25%;
          max-width: 180px;
          min-width: 120px;
          aspect-ratio: 4/3;
          bottom: 20px;
          right: 20px;
          border-radius: 8px;
          overflow: hidden;
          border: 2px solid #fff;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
          z-index: 10;
        }
        
        .local-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          background-color: #333;
          transform: scaleX(-1); /* Mirror local video */
        }
        
        .local-video-off {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: rgba(0, 0, 0, 0.7);
          color: #fff;
          font-size: 24px;
        }
        
        .call-controls {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 16px;
          background-color: rgba(0, 0, 0, 0.6);
          padding: 12px 16px;
          border-radius: 32px;
          transition: opacity 0.3s ease;
          z-index: 20;
        }
        
        .call-controls.visible {
          opacity: 1;
        }
        
        .call-controls.hidden {
          opacity: 0;
        }
        
        .control-button {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: none;
          background-color: rgba(255, 255, 255, 0.2);
          color: #fff;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .control-button:hover {
          background-color: rgba(255, 255, 255, 0.3);
          transform: scale(1.05);
        }
        
        .control-button.active {
          background-color: #dc3545;
        }
        
        .control-button.end-call {
          background-color: #dc3545;
        }
        
        .control-button.end-call:hover {
          background-color: #c82333;
        }
        
        .call-duration {
          position: absolute;
          top: 20px;
          left: 20px;
          background-color: rgba(0, 0, 0, 0.6);
          color: #fff;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          z-index: 20;
        }
        
        .connecting-indicator {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background-color: rgba(0, 0, 0, 0.7);
          color: #fff;
          z-index: 15;
        }
        
        .connecting-indicator span {
          margin-top: 10px;
          font-size: 16px;
        }
        
        .spin {
          animation: spin 1s infinite linear;
          font-size: 32px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .error-indicator {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: rgba(0, 0, 0, 0.7);
          color: #fff;
          z-index: 15;
        }
        
        .error-message {
          background-color: rgba(220, 53, 69, 0.8);
          padding: 16px 20px;
          border-radius: 8px;
          max-width: 80%;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .retry-button {
          background-color: rgba(255, 255, 255, 0.2);
          border: none;
          border-radius: 4px;
          color: #fff;
          padding: 8px 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin: 0 auto;
          transition: background-color 0.2s;
        }
        
        .retry-button:hover {
          background-color: rgba(255, 255, 255, 0.3);
        }
        
        .video-off-indicator {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 48px;
          background-color: rgba(0, 0, 0, 0.5);
          padding: 20px;
          border-radius: 50%;
          width: 120px;
          height: 120px;
        }
        
        .video-off-indicator span {
          font-size: 14px;
          margin-top: 8px;
        }
        
        .audio-off-indicator {
          position: absolute;
          top: 20px;
          right: 20px;
          background-color: rgba(0, 0, 0, 0.6);
          color: #dc3545;
          padding: 8px;
          border-radius: 50%;
          z-index: 10;
          font-size: 18px;
        }
      `}</style>
    </div>
  );
};

export default VideoCall;