"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

export function MapRenderScheduler({
  active,
  assetsReady,
  targetFps,
  prewarmFrames,
  onReady,
}: {
  active: boolean;
  assetsReady: boolean;
  targetFps: number;
  prewarmFrames: number;
  onReady: () => void;
}) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const readyReportedRef = useRef(false);

  useEffect(() => {
    if (!assetsReady) {
      readyReportedRef.current = false;
    }
  }, [assetsReady]);

  useEffect(() => {
    if (!assetsReady || readyReportedRef.current) return;

    let cancelled = false;

    const warmUp = async () => {
      try {
        /*
         * Nelle versioni correnti di Three.js compileAsync è già dichiarato
         * su WebGLRenderer. Non va ridefinito con un'interfaccia opzionale:
         * quella ridefinizione rendeva incompatibile il tipo durante la build.
         */
        const compileAsync = gl.compileAsync;

        if (typeof compileAsync === "function") {
          await compileAsync.call(gl, scene, camera);
        } else {
          gl.compile(scene, camera);
        }
      } catch {
        // Il warm-up è un'ottimizzazione: un errore non deve bloccare la mappa.
      }

      for (let frame = 0; frame < prewarmFrames; frame += 1) {
        if (cancelled) return;
        invalidate();
        await nextAnimationFrame();
      }

      if (cancelled) return;
      readyReportedRef.current = true;
      onReady();
    };

    void warmUp();

    return () => {
      cancelled = true;
    };
  }, [
    assetsReady,
    camera,
    gl,
    invalidate,
    onReady,
    prewarmFrames,
    scene,
  ]);

  useEffect(() => {
    if (!active) return;

    const frameDuration = 1000 / Math.max(1, targetFps);
    let animationFrame = 0;
    let lastFrame = performance.now() - frameDuration;

    const renderAtBudget = (now: number) => {
      const elapsed = now - lastFrame;

      if (elapsed >= frameDuration) {
        lastFrame = now - (elapsed % frameDuration);
        invalidate();
      }

      animationFrame = window.requestAnimationFrame(renderAtBudget);
    };

    invalidate();
    animationFrame = window.requestAnimationFrame(renderAtBudget);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [active, invalidate, targetFps]);

  return null;
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}
