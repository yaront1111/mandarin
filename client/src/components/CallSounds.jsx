"use client"

import { useEffect, useRef, useState } from "react"

// Audio file URLs
const AUDIO_FILES = {
  RING: "/sounds/ring.mp3",
  CALL_CONNECT: "/sounds/call-connect.mp3",
  CALL_END: "/sounds/call-end.mp3",
}

const CallSounds = ({ callStatus, isIncoming }) => {
  const [audioEnabled, setAudioEnabled] = useState(true)
  const ringRef = useRef(null)
  const connectRef = useRef(null)
  const endRef = useRef(null)
  const audioContextRef = useRef(null)

  // Initialize audio context on user interaction
  const initAudioContext = () => {
    if (!audioContextRef.current) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext
        audioContextRef.current = new AudioContext()
        return true
      } catch (err) {
        console.error("Failed to create AudioContext:", err)
        return false
      }
    }
    return true
  }

  // Preload audio files
  useEffect(() => {
    // Create audio elements
    ringRef.current = new Audio(AUDIO_FILES.RING)
    ringRef.current.loop = true
    ringRef.current.volume = 0.7

    connectRef.current = new Audio(AUDIO_FILES.CALL_CONNECT)
    connectRef.current.volume = 0.5

    endRef.current = new Audio(AUDIO_FILES.CALL_END)
    endRef.current.volume = 0.5

    // Add user interaction listener to initialize audio context
    const handleUserInteraction = () => {
      if (initAudioContext()) {
        document.removeEventListener("click", handleUserInteraction)
        document.removeEventListener("touchstart", handleUserInteraction)
      }
    }

    document.addEventListener("click", handleUserInteraction)
    document.addEventListener("touchstart", handleUserInteraction)

    return () => {
      // Clean up
      if (ringRef.current) {
        ringRef.current.pause()
        ringRef.current.src = ""
      }

      if (connectRef.current) {
        connectRef.current.pause()
        connectRef.current.src = ""
      }

      if (endRef.current) {
        endRef.current.pause()
        endRef.current.src = ""
      }

      document.removeEventListener("click", handleUserInteraction)
      document.removeEventListener("touchstart", handleUserInteraction)
    }
  }, [])

  // Play audio based on call status
  useEffect(() => {
    if (!audioEnabled) return

    const playAudio = async (audioElement) => {
      try {
        if (audioElement) {
          await audioElement.play()
        }
      } catch (err) {
        console.warn("Audio play was prevented:", err)

        // Try to resume audio context if it's suspended
        if (audioContextRef.current && audioContextRef.current.state === "suspended") {
          try {
            await audioContextRef.current.resume()
            // Try playing again
            await audioElement.play()
          } catch (resumeErr) {
            console.warn("Still prevented:", resumeErr)
          }
        }
      }
    }

    // Stop all sounds first
    if (ringRef.current) ringRef.current.pause()
    if (connectRef.current) connectRef.current.pause()
    if (endRef.current) endRef.current.pause()

    // Play appropriate sound based on status
    if (callStatus === "connecting" && isIncoming) {
      playAudio(ringRef.current)
    } else if (callStatus === "connected") {
      playAudio(connectRef.current)
    } else if (callStatus === "ended") {
      playAudio(endRef.current)
    }

    return () => {
      // Pause sounds when component unmounts or status changes
      if (ringRef.current) ringRef.current.pause()
      if (connectRef.current) connectRef.current.pause()
      if (endRef.current) endRef.current.pause()
    }
  }, [callStatus, isIncoming, audioEnabled])

  // Toggle audio
  const toggleAudio = () => {
    setAudioEnabled(!audioEnabled)

    if (!audioEnabled) {
      // If we're enabling audio, try to resume AudioContext
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume()
      }
    } else {
      // If we're disabling audio, pause all sounds
      if (ringRef.current) ringRef.current.pause()
      if (connectRef.current) connectRef.current.pause()
      if (endRef.current) endRef.current.pause()
    }
  }

  return (
    <div className="call-sounds">
      <button
        className={`sound-toggle ${audioEnabled ? "enabled" : "disabled"}`}
        onClick={toggleAudio}
        aria-label={audioEnabled ? "Mute call sounds" : "Unmute call sounds"}
      >
        <i className={`fas ${audioEnabled ? "fa-volume-up" : "fa-volume-mute"}`}></i>
      </button>
    </div>
  )
}

export default CallSounds
