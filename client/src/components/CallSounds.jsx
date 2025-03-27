import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
//                                                           ^^^^^^^^ Added here
import PropTypes from 'prop-types';

// --- Constants ---
const SOUND_FILES = {
  ringtone: '/sounds/ringtone.mp3',
  callEnd: '/sounds/call-end.mp3',
  callConnect: '/sounds/call-connect.mp3',
  // Add other sounds if needed
};
const SYNTHETIC_VOLUME_FACTOR = 0.15; // Lower volume for synthetic sounds
const RETRY_DELAY = 100; // Short delay before retrying play after user interaction

// --- Helper Functions ---
/**
 * Attempts to unlock the Web Audio API AudioContext.
 * Should be called after user interaction (click/touch).
 * @param {AudioContext} context - The AudioContext instance.
 */
const unlockAudioContext = (context) => {
  if (context && context.state === 'suspended') {
    context.resume().catch(err => console.warn('AudioContext resume failed:', err));
  }
};

/**
 * Creates and plays a synthetic beep using Web Audio API.
 * @param {AudioContext} context - The AudioContext instance.
 * @param {string} soundType - Type of sound ('ringtone', 'callEnd', 'callConnect').
 * @param {number} volume - Base volume level (0 to 1).
 * @param {boolean} loop - Whether the sound should loop (only for ringtone).
 * @returns {Function | null} A cleanup function to stop the looping sound, or null.
 */
const playSyntheticSound = (context, soundType, volume, loop) => {
  if (!context) {
    console.warn('Cannot play synthetic sound: No AudioContext.');
    return null;
  }

  unlockAudioContext(context); // Ensure context is active

  let oscillator;
  let gainNode;
  let repeatTimeoutId = null;
  let isCancelled = false; // Flag to stop looping

  const stopSound = () => {
    isCancelled = true;
    if (repeatTimeoutId) clearTimeout(repeatTimeoutId);
    try {
      if (oscillator) oscillator.stop();
    } catch (e) { /* Ignore errors if already stopped */ }
  };

  const createAndPlayBeep = (startTime = context.currentTime) => {
    if (isCancelled) return;

    try {
        oscillator = context.createOscillator();
        gainNode = context.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        gainNode.gain.setValueAtTime(SYNTHETIC_VOLUME_FACTOR * volume, startTime);

        let freq = 440; // Default A4
        let duration = 0.2;

        if (soundType === 'ringtone') {
            freq = 440; duration = 0.2;
        } else if (soundType === 'callEnd') {
            freq = 220; duration = 0.5;
        } else if (soundType === 'callConnect') {
            freq = 660; duration = 0.3;
        }

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, startTime);
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);

        oscillator.onended = () => {
            if (soundType === 'ringtone' && loop && !isCancelled) {
                // Schedule the next beep for looping ringtone
                repeatTimeoutId = setTimeout(() => createAndPlayBeep(), 1000 - duration * 1000); // Adjust delay for beep duration
            }
        };
    } catch (e) {
        console.warn(`Web Audio API fallback failed for ${soundType}:`, e);
    }
  };

  createAndPlayBeep(); // Start the first beep

  // Return a cleanup function specifically for stopping loops
  return loop && soundType === 'ringtone' ? stopSound : null;
};


// --- Component ---
const CallSounds = ({
  isPlaying = false,
  sound = 'ringtone',
  loop = true,
  volume = 0.7, // Default volume slightly lower
}) => {
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const playPromiseRef = useRef(null);
  const stopSyntheticLoopRef = useRef(null); // Ref to store the cleanup function for synthetic loops
  const [didInteract, setDidInteract] = useState(false); // Track user interaction

  const soundUrl = SOUND_FILES[sound] || null;

  // --- Interaction Listener ---
  useEffect(() => {
    const handleInteraction = () => {
      setDidInteract(true);
      if (audioContextRef.current) {
          unlockAudioContext(audioContextRef.current);
      }
      // Attempt to play silent audio to unlock HTMLMediaElement on some browsers
      try {
        const silentAudio = new Audio("data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABIgD/////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==");
        silentAudio.volume = 0;
        silentAudio.play().catch(() => {});
      } catch(e) {}
      // Remove listeners after first interaction
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  // --- Initialize Audio Element and Context ---
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.addEventListener('error', (e) => {
        // Log more specific error if possible
        const error = e.target?.error;
        console.error('Audio Element Error:', error?.message || 'Unknown error', 'Code:', error?.code, e);
      });
    }
    if (!audioContextRef.current) {
        try {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        } catch (err) {
            console.error("Failed to create AudioContext:", err);
        }
    }

    // Cleanup function for audio element
    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.removeAttribute('src'); // More reliable than src = ''
          audioRef.current.load(); // Reset state
        } catch (e) {
          console.warn('Error cleaning up audio element:', e);
        }
      }
      // Close audio context if desired (usually kept open)
      // if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      //   audioContextRef.current.close().catch(e => console.warn('Error closing AudioContext:', e));
      // }
    };
  }, []); // Run only once on mount


  // --- Handle Playback Logic ---
  useEffect(() => {
    const audio = audioRef.current;
    const context = audioContextRef.current;

    // Guard clauses
    if (!audio) return;
    if (isPlaying && !soundUrl) {
      console.warn(`Attempted to play sound "${sound}" but no valid URL found.`);
      return;
    }

    // Stop any ongoing synthetic sound loop if props change
    if (stopSyntheticLoopRef.current) {
        stopSyntheticLoopRef.current();
        stopSyntheticLoopRef.current = null;
    }

    // --- Configure Audio Element ---
    audio.loop = loop;
    audio.volume = Math.max(0, Math.min(1, volume)); // Clamp volume

    // --- Set Source ---
    // Check if the source needs updating
    const currentFullSrc = audio.currentSrc || audio.src;
    const newFullUrl = soundUrl ? new URL(soundUrl, window.location.origin).href : '';

    if (soundUrl && currentFullSrc !== newFullUrl) {
        console.log(`[CallSounds] Setting source to: ${soundUrl}`);
        audio.src = soundUrl;
        audio.load(); // Load the new source
    } else if (!soundUrl && currentFullSrc) {
        // If isPlaying is false or soundUrl is null, clear the source
        audio.removeAttribute('src');
        audio.load();
    }

    // --- Play / Pause Logic ---
    if (isPlaying && soundUrl) {
        // Attempt to play only after user interaction
        const attemptPlay = () => {
            if (!audioRef.current || !isPlaying) return; // Check again in case state changed

            unlockAudioContext(context); // Ensure context is active before synthetic fallback
            playPromiseRef.current = audio.play();

            if (playPromiseRef.current) {
                playPromiseRef.current
                    .then(() => {
                        console.log(`[CallSounds] Playback started for ${sound}`);
                    })
                    .catch((err) => {
                        console.warn(`[CallSounds] HTML Audio play failed for ${sound}:`, err.name, err.message);
                        // Don't fallback on AbortError, it means we intentionally stopped it
                        if (err.name !== 'AbortError') {
                            // Attempt synthetic fallback
                            console.log(`[CallSounds] Falling back to synthetic sound for ${sound}`);
                            stopSyntheticLoopRef.current = playSyntheticSound(context, sound, volume, loop);
                        }
                        // If error is NotAllowedError, prompt user interaction (already handled by didInteract?)
                        if (err.name === 'NotAllowedError' && !didInteract) {
                             console.warn('[CallSounds] Playback prevented by browser policy. Requires user interaction.');
                             // Optionally show UI message asking user to click
                        }
                    });
            }
        };

        if (didInteract) {
            attemptPlay();
        } else {
            // If no interaction yet, wait for it (or maybe try playing muted?)
            // For simplicity, we'll just log and wait for the interaction handler.
             console.log('[CallSounds] Waiting for user interaction to play sound.');
        }

    } else {
        // --- Pause ---
        // Check if a play promise is pending, if so, wait for it to settle before pausing to avoid AbortError
        const pauseAudio = () => {
             if (audio && !audio.paused) {
                audio.pause();
                console.log(`[CallSounds] Paused audio for ${sound}`);
             }
             // Also stop synthetic loop if it exists
             if (stopSyntheticLoopRef.current) {
                stopSyntheticLoopRef.current();
                stopSyntheticLoopRef.current = null;
             }
        };

        if (playPromiseRef.current) {
            playPromiseRef.current
                .then(pauseAudio) // Pause after successful play (if it completes before isPlaying becomes false)
                .catch(pauseAudio); // Pause even if play failed (handles AbortError scenario better)
            playPromiseRef.current = null; // Clear the ref
        } else {
            pauseAudio(); // No pending promise, just pause
        }
    }

    // --- Cleanup for this effect run ---
    return () => {
        console.log(`[CallSounds] Cleaning up effect for sound: ${sound}, isPlaying: ${isPlaying}`);
         // Stop synthetic loop on cleanup
         if (stopSyntheticLoopRef.current) {
            stopSyntheticLoopRef.current();
            stopSyntheticLoopRef.current = null;
         }
        // Note: Pausing is handled in the main logic based on `isPlaying` becoming false
        // Avoid calling pause directly here unless absolutely necessary to prevent AbortErrors
    };

  }, [isPlaying, sound, loop, volume, soundUrl, didInteract]); // Dependencies


  // Render nothing - this component only manages side effects
  return null;
};

CallSounds.propTypes = {
  isPlaying: PropTypes.bool,
  sound: PropTypes.oneOf(Object.keys(SOUND_FILES)),
  loop: PropTypes.bool,
  volume: PropTypes.number,
};

export default CallSounds;
