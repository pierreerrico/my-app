"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

/**
 * Mobile browsers can reclaim a WebGL context while the atlas is loading or
 * while its slide is off-screen. Prevent the browser's default permanent loss
 * and ask the parent to mount a fresh renderer.
 */
export function MapCanvasRecovery({
  onContextLost,
}: {
  onContextLost: () => void;
}) {
  const canvas = useThree((state) => state.gl.domElement);

  useEffect(() => {
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      onContextLost();
    };

    canvas.addEventListener("webglcontextlost", handleContextLost);
    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
    };
  }, [canvas, onContextLost]);

  return null;
}
