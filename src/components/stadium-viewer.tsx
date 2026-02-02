"use client";

import { useEffect, useRef, useState } from "react";

const STADIUM_BASE_URL = "https://fv-assets.mlb.com/ballparks";

interface StadiumViewerProps {
  abbr: string;
  stadiumName?: string;
  className?: string;
}

export function StadiumViewer({ abbr, stadiumName, className = "" }: StadiumViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: import("three").WebGLRenderer | null = null;
    let scene: import("three").Scene | null = null;
    let camera: import("three").PerspectiveCamera | null = null;
    let controls: { dispose: () => void; update: () => boolean } | null = null;
    let model: import("three").Group | null = null;
    let frameId: number | null = null;

    function getSize(): { width: number; height: number } {
      if (!container) return { width: 640, height: 480 };
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width) || container.clientWidth || 640);
      const h = Math.max(1, Math.round(rect.height) || container.clientHeight || 480);
      return { width: w, height: h };
    }

    function setSize() {
      if (!camera || !renderer || !container) return;
      const { width, height } = getSize();
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      const canvas = renderer.domElement;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
    }

    async function init() {
      const three = await import("three");
      const { Scene, PerspectiveCamera, WebGLRenderer, Color, AmbientLight, DirectionalLight, Box3, Vector3 } = three;
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");

      const { width, height } = getSize();

      scene = new Scene();
      scene.background = new Color(0xf0f4f8);

      camera = new PerspectiveCamera(40, width / height, 0.01, 100);
      camera.position.set(0, 0.25, 0.75);
      camera.lookAt(0, 0, 0);

      const ambient = new AmbientLight(0xffffff, 0.7);
      scene.add(ambient);
      const dir = new DirectionalLight(0xffffff, 0.8);
      dir.position.set(10, 20, 10);
      scene.add(dir);

      renderer = new WebGLRenderer({ antialias: true, alpha: false });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      const canvas = renderer.domElement;
      canvas.style.display = "block";
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      canvas.style.touchAction = "none";
      container.appendChild(canvas);

      controls = new OrbitControls(camera, canvas);
      controls.target.set(0, 0, 0);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.minDistance = 0.04;
      controls.maxDistance = 4;
      controls.maxPolarAngle = Math.PI * 0.9;

      const url = `${STADIUM_BASE_URL}/Stadium_${abbr}.glb`;
      const loader = new GLTFLoader();
      loader.load(
        url,
        (gltf) => {
          if (!scene || !camera) return;
          model = gltf.scene;
          const box = new Box3().setFromObject(model);
          const center = box.getCenter(new Vector3());
          const size = box.getSize(new Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          if (maxDim <= 0) {
            scene.add(model);
            setStatus("ready");
            return;
          }
          const scale = 1 / maxDim;
          model.scale.setScalar(scale);
          model.position.copy(center).multiplyScalar(-scale);
          scene.add(model);
          camera.position.set(0, 0.25, 0.75);
          camera.lookAt(0, 0, 0);
          if (controls) controls.target.set(0, 0, 0);
          setSize();
          setStatus("ready");
        },
        undefined,
        (err) => {
          console.error("Stadium load error:", err);
          setStatus("error");
          setErrorMessage(err?.message || "Failed to load stadium model");
        }
      );

      function animate() {
        frameId = requestAnimationFrame(animate);
        if (controls) controls.update();
        if (renderer && scene && camera) renderer.render(scene, camera);
      }
      animate();
    }

    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        init();
      });
    });

    const ro = new ResizeObserver(() => setSize());
    ro.observe(container);
    const onWindowResize = () => setSize();
    window.addEventListener("resize", onWindowResize);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener("resize", onWindowResize);
      if (frameId != null) cancelAnimationFrame(frameId);
      controls?.dispose();
      if (renderer?.domElement?.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      renderer?.dispose();
    };
  }, [abbr]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="w-full rounded-lg bg-muted overflow-hidden flex-shrink-0"
        style={{ width: "100%", height: 420, minHeight: 320, position: "relative" }}
      />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/90 rounded-lg pointer-events-none">
          <p className="text-sm text-muted-foreground">Loading stadium…</p>
        </div>
      )}
      {status === "error" && (
        <div className="mt-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {errorMessage ?? "Stadium model not available"}
        </div>
      )}
      {status === "ready" && (
        <>
          <p className="mt-2 text-xs text-muted-foreground text-center">
            Drag to rotate · Scroll to zoom · Right-drag to pan
          </p>
          {stadiumName && (
            <p className="mt-0.5 text-sm font-medium text-center text-muted-foreground">{stadiumName}</p>
          )}
        </>
      )}
    </div>
  );
}
