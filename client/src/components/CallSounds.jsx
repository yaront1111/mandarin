import React, { useEffect, useRef } from 'react';

const CallSounds = ({
  isPlaying = false,
  sound = 'ringtone',
  loop = true,
  volume = 0.7
}) => {
  const audioRef = useRef(null);
  const playPromiseRef = useRef(null);
  let pauseTimeout = null;

  // Sound file paths – files should be placed in public/sounds/
  const soundFiles = {
    ringtone: '/sounds/ringtone.mp3',
    callEnd: '/sounds/call-end.mp3',
    callConnect: '/sounds/call-connect.mp3',
    callStart: '/sounds/call-start.mp3',
  };

  const getAudioSource = () => {
    return soundFiles[sound] || null;
  };

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audioElement = audioRef.current;
    audioElement.volume = volume;
    audioElement.loop = loop;

    const sourceUrl = getAudioSource();
    if (sourceUrl && audioElement.src !== sourceUrl) {
      audioElement.src = sourceUrl;
      audioElement.load();
    }

    if (isPlaying) {
      const playPromise = audioElement.play();
      if (playPromise !== undefined && playPromise !== null) {
        playPromiseRef.current = playPromise;
        playPromise.catch(error => {
          document.addEventListener(
            'click',
            function resumeAudio() {
              audioElement.play().catch(() => {});
              document.removeEventListener('click', resumeAudio);
            },
            { once: true }
          );
        });
      }
    } else {
      pauseTimeout = setTimeout(() => {
        if (!audioElement.paused) {
          audioElement.pause();
          if (!loop) {
            audioElement.currentTime = 0;
          }
        }
      }, 100);
    }

    return () => {
      if (pauseTimeout) clearTimeout(pauseTimeout);
      try {
        if (audioRef.current) {
          audioRef.current.pause();
          if (sound !== 'ringtone') {
            // Keeping the ringtone preloaded for responsiveness
            audioRef.current.src = '';
          }
        }
      } catch (e) {}
    };
  }, [isPlaying, sound, loop, volume]);

  return null;
};

export default CallSounds;
