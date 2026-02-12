import React, { useEffect, useState } from "react";
import { Splash } from "@/components/auth/Splash";
import { WelcomeScreen } from "@/components/auth/WelcomeScreen";

const SPLASH_MIN_DURATION_MS = 800;
const WELCOME_BACKGROUND_SRC = "/updateproduce.png";

export function Welcome() {
  const [showSplash, setShowSplash] = useState(true);
  const [transitionDurationMs, setTransitionDurationMs] = useState(450);
  const [hasShownMinimumSplash, setHasShownMinimumSplash] = useState(false);
  const [isWelcomeBackgroundReady, setIsWelcomeBackgroundReady] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      setTransitionDurationMs(0);
    }

    const timer = window.setTimeout(() => {
      setHasShownMinimumSplash(true);
    }, SPLASH_MIN_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const image = new Image();

    const handleReady = () => setIsWelcomeBackgroundReady(true);
    const handleError = () => {
      console.error(`Failed to preload ${WELCOME_BACKGROUND_SRC}`);
      setIsWelcomeBackgroundReady(true);
    };

    image.addEventListener("load", handleReady);
    image.addEventListener("error", handleError);
    image.src = WELCOME_BACKGROUND_SRC;

    if (image.complete) {
      setIsWelcomeBackgroundReady(true);
    }

    return () => {
      image.removeEventListener("load", handleReady);
      image.removeEventListener("error", handleError);
    };
  }, []);

  useEffect(() => {
    if (hasShownMinimumSplash && isWelcomeBackgroundReady) {
      setShowSplash(false);
    }
  }, [hasShownMinimumSplash, isWelcomeBackgroundReady]);

  return (
    <div className="fixed inset-0 overflow-hidden overscroll-none touch-none bg-prox">
      <div
        className={`absolute inset-0 transition-opacity ease-in-out ${
          showSplash ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ transitionDuration: `${transitionDurationMs}ms` }}
      >
        <Splash />
      </div>

      <div
        className={`absolute inset-0 transition-opacity ease-in-out ${
          showSplash ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        style={{ transitionDuration: `${transitionDurationMs}ms` }}
      >
        <WelcomeScreen />
      </div>
    </div>
  );
}
