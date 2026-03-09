"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface IntroVideoProps {
  onComplete: () => void;
}

export function IntroVideo({ onComplete }: IntroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);

  const skipIntro = useCallback(() => {
    if (fading) return;
    setFading(true);
    if (videoRef.current) {
      videoRef.current.pause();
    }
    document.cookie = "chs_intro_seen=1; max-age=86400; path=/; SameSite=Lax";
    setTimeout(() => {
      onComplete();
    }, 1400);
  }, [fading, onComplete]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        document.cookie = "chs_intro_seen=1; max-age=86400; path=/; SameSite=Lax";
        onComplete();
      });
    }

    const handleTimeUpdate = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    const handleEnded = () => {
      skipIntro();
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
    };
  }, [onComplete, skipIntro]);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center cursor-pointer"
      style={{
        opacity: fading ? 0 : 1,
        transition: "opacity 1.4s cubic-bezier(0.4, 0, 0, 1)",
      }}
      onClick={skipIntro}
      data-testid="intro-video-overlay"
    >
      <video
        ref={videoRef}
        muted
        playsInline
        className="w-full h-full object-cover"
        data-testid="intro-video"
      >
        <source src="/video/chs-intro.mp4" type="video/mp4" />
      </video>

      {/* Progress bar */}
      <div
        className="fixed bottom-0 left-0 h-[3px] z-[10000]"
        style={{
          width: `${progress}%`,
          background: "linear-gradient(90deg, #1565C0, #42A5F5, #1976D2)",
          boxShadow:
            "0 0 12px rgba(33, 150, 243, 0.6), 0 0 4px rgba(33, 150, 243, 0.4)",
          transition: "width 0.1s linear",
        }}
        data-testid="intro-progress-bar"
      />

      {/* Skip button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          skipIntro();
        }}
        className="fixed bottom-8 right-8 z-[10001] chs-skip-btn"
        data-testid="button-skip-intro"
      >
        Saltar intro
      </button>
    </div>
  );
}
