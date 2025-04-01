import SimplePeer from 'simple-peer';
import 'webrtc-adapter'; // Import adapter for better browser compatibility
import logger from './logger';

/**
 * WebRTC utility functions for managing peer connections
 */

// Create a logger specific to WebRTC utilities
const log = logger.create('WebRTC');

// Default ICE servers configuration
const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  // Add TURN servers for production (requires authentication)
  // {
  //   urls: 'turn:your-turn-server.com:3478',
  //   username: 'username',
  //   credential: 'password'
  // }
];

/**
 * Create a new WebRTC peer connection
 * @param {boolean} isInitiator - Whether this peer is initiating the connection
 * @param {MediaStream} stream - Local media stream
 * @param {Object} options - Additional options
 * @returns {SimplePeer} Peer instance
 */
export const createPeer = (isInitiator, stream, options = {}) => {
  const {
    iceServers = DEFAULT_ICE_SERVERS,
    debug = false,
    config = {},
    sdpTransform = sdp => sdp,
  } = options;

  // Configure the SimplePeer instance
  const peer = new SimplePeer({
    initiator: isInitiator,
    stream,
    trickle: true, // Enable incremental ICE candidate gathering
    config: {
      iceServers,
      ...config
    },
    sdpTransform,
    debug: debug ? (data) => log.debug('SimplePeer Debug:', data) : undefined,
  });

  return peer;
};

/**
 * Get user media with graceful fallbacks
 * @param {Object} constraints - MediaStreamConstraints
 * @returns {Promise<MediaStream>} Media stream
 */
export const getUserMedia = async (constraints = { video: true, audio: true }) => {
  try {
    // Try to get media with specified constraints
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    log.error('Error getting media with specified constraints:', error);

    // If video fails, try audio only
    if (constraints.video && constraints.audio) {
      try {
        log.info('Trying audio only...');
        return await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      } catch (audioError) {
        log.error('Audio only failed:', audioError);
        // If all fails, throw the original error
        throw error;
      }
    }

    // If no fallbacks worked, throw the error
    throw error;
  }
};

/**
 * Check if the browser supports WebRTC
 * @returns {boolean} Whether WebRTC is supported
 */
export const isWebRTCSupported = () => {
  return !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    window.RTCPeerConnection
  );
};

/**
 * Handle connection errors gracefully
 * @param {Error} error - The connection error
 * @returns {Object} Structured error info
 */
export const handleConnectionError = (error) => {
  let errorType = 'unknown';
  let errorMessage = 'An unknown error occurred';
  let isCritical = true;

  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
    errorType = 'permission';
    errorMessage = 'Camera or microphone permission denied';
    isCritical = true;
  } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
    errorType = 'devices';
    errorMessage = 'Camera or microphone not found';
    isCritical = true;
  } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
    errorType = 'hardware';
    errorMessage = 'Camera or microphone is already in use or not working properly';
    isCritical = true;
  } else if (error.name === 'OverconstrainedError') {
    errorType = 'constraints';
    errorMessage = 'Camera constraints cannot be satisfied';
    isCritical = false;
  } else if (error.message === 'Failed to construct \'RTCPeerConnection\'') {
    errorType = 'connection';
    errorMessage = 'Failed to create peer connection';
    isCritical = true;
  } else if (error.message && error.message.includes('ICE')) {
    errorType = 'ice';
    errorMessage = 'Connection issue: ICE connection failed';
    isCritical = true;
  }

  return {
    type: errorType,
    message: errorMessage,
    original: error,
    isCritical,
  };
};

/**
 * Process and enhance video tracks for better performance
 * @param {MediaStreamTrack} videoTrack - The video track to process
 * @param {Object} options - Processing options
 */
export const optimizeVideoTrack = (videoTrack, options = {}) => {
  const {
    maxBitrate = 800000, // 800kbps
    maxFramerate = 30,
    scaleDownResolution = false,
  } = options;

  // Apply constraints if the browser supports them
  if (videoTrack.getConstraints && videoTrack.applyConstraints) {
    const constraints = {};

    if (scaleDownResolution) {
      constraints.width = { ideal: 640 };
      constraints.height = { ideal: 480 };
    }

    constraints.frameRate = { max: maxFramerate };

    // Apply the constraints to the track
    videoTrack.applyConstraints(constraints)
      .catch(error => log.error('Error applying video constraints:', error));
  }

  // Set content hints if supported
  if (videoTrack.contentHint !== undefined) {
    // 'motion' is optimized for fluidity over quality
    videoTrack.contentHint = 'motion';
  }

  return videoTrack;
};

/**
 * Detect network quality and adjust video parameters accordingly
 * @param {RTCPeerConnection} peerConnection - The RTCPeerConnection
 * @param {function} qualityCallback - Callback with quality information
 */
export const monitorConnectionQuality = (peerConnection, qualityCallback) => {
  let lastResult;
  let intervalId;

  const getStats = async () => {
    try {
      const stats = await peerConnection.getStats();
      let videoPacketsLost = 0;
      let videoPacketsSent = 0;
      let videoBytesReceived = 0;
      let videoFramesDecoded = 0;
      let currentRoundTripTime = 0;

      stats.forEach(report => {
        if (report.type === 'outbound-rtp' && report.mediaType === 'video') {
          videoPacketsLost = report.packetsLost || 0;
          videoPacketsSent = report.packetsSent || 0;
        } else if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
          videoBytesReceived = report.bytesReceived || 0;
          videoFramesDecoded = report.framesDecoded || 0;
        } else if (report.type === 'remote-candidate') {
          currentRoundTripTime = report.currentRoundTripTime || 0;
        }
      });

      // Calculate packet loss percentage
      const packetLossPercent = videoPacketsSent > 0
        ? (videoPacketsLost / videoPacketsSent) * 100
        : 0;

      // Determine connection quality
      let quality = 'good';
      if (packetLossPercent > 5 || currentRoundTripTime > 0.3) {
        quality = 'poor';
      } else if (packetLossPercent > 2 || currentRoundTripTime > 0.15) {
        quality = 'average';
      }

      // Calculate bitrate if we have previous data
      let bitrate = 0;
      if (lastResult && lastResult.timestamp) {
        const timeDiff = (stats.timestamp - lastResult.timestamp) / 1000; // in seconds
        if (timeDiff > 0) {
          const bytesDiff = videoBytesReceived - (lastResult.videoBytesReceived || 0);
          bitrate = (bytesDiff * 8) / timeDiff; // bits per second
        }
      }

      lastResult = {
        timestamp: stats.timestamp,
        videoBytesReceived,
        videoFramesDecoded,
      };

      // Call the callback with quality information
      qualityCallback({
        quality,
        packetLossPercent,
        roundTripTime: currentRoundTripTime * 1000, // convert to ms
        bitrate,
      });
    } catch (error) {
      log.error('Error getting connection stats:', error);
    }
  };

  // Start monitoring
  intervalId = setInterval(getStats, 2000);

  // Return function to stop monitoring
  return () => {
    clearInterval(intervalId);
  };
};

/**
 * Add a track to a peer connection
 * @param {RTCPeerConnection} peerConnection - RTCPeerConnection instance
 * @param {MediaStreamTrack} track - The track to add
 * @param {MediaStream} stream - The stream the track belongs to
 */
export const addTrackToPeer = (peerConnection, track, stream) => {
  try {
    peerConnection.addTrack(track, stream);
  } catch (error) {
    log.error('Error adding track to peer connection:', error);
  }
};

/**
 * Remove a track from a peer connection
 * @param {RTCPeerConnection} peerConnection - RTCPeerConnection instance
 * @param {MediaStreamTrack} track - The track to remove
 */
export const removeTrackFromPeer = (peerConnection, track) => {
  try {
    const senders = peerConnection.getSenders();
    const sender = senders.find(s => s.track === track);
    if (sender) {
      peerConnection.removeTrack(sender);
    }
  } catch (error) {
    log.error('Error removing track from peer connection:', error);
  }
};
