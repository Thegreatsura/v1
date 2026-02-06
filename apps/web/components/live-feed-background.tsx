"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// --- Grid configuration ---
const COLS = 80;
const ROWS = 50;
const COUNT = COLS * ROWS;
const GRID_W = 20;
const GRID_D = 14;
const MAX_BURSTS = 6;
const MAX_LABELS = 4;

// --- GLSL Shaders ---
const vertexShader = /* glsl */ `
  uniform float u_time;
  uniform vec2 u_mouse;
  uniform vec3 u_bursts[${MAX_BURSTS}];

  attribute float a_scale;
  attribute float a_brightness;

  varying float v_alpha;

  void main() {
    vec3 pos = position;

    // Slow global drift
    pos.x += sin(u_time * 0.1) * 0.5;
    pos.z += cos(u_time * 0.08) * 0.3;

    // Multi-layered wave displacement
    float y = 0.0;
    y += sin(pos.x * 0.8 + u_time * 0.4) * 0.25;
    y += sin(pos.x * 0.4 + pos.z * 0.6 + u_time * 0.25) * 0.18;
    y += cos(pos.z * 0.7 + u_time * 0.35) * 0.15;
    y += sin(pos.x * 1.5 - pos.z * 0.4 + u_time * 0.55) * 0.1;
    pos.y += y;

    // Mouse ripple — push particles upward near cursor
    float mouseDist = length(pos.xz - u_mouse);
    float mouseRipple = smoothstep(3.0, 0.0, mouseDist);
    pos.y += mouseRipple * 0.8;

    // Package burst ring-waves
    float burstGlow = 0.0;
    for (int i = 0; i < ${MAX_BURSTS}; i++) {
      vec3 b = u_bursts[i];
      if (b.z > 0.0) {
        float age = u_time - b.z;
        if (age >= 0.0 && age < 3.5) {
          float d = length(pos.xz - b.xy);
          float expandR = age * 2.5;
          float ringW = 1.2;
          float ring = smoothstep(expandR + ringW, expandR, d)
                     * smoothstep(expandR - ringW, expandR, d);
          float fade = 1.0 - smoothstep(0.0, 3.5, age);
          float wave = sin(d * 4.0 - age * 6.0) * 0.5 + 0.5;
          burstGlow += ring * fade * wave * 3.0;
          pos.y += ring * fade * 0.4;
        }
      }
    }

    v_alpha = a_brightness * (1.0 + burstGlow + mouseRipple * 0.8);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = a_scale * (45.0 / -mvPosition.z);
    gl_PointSize = max(1.0, gl_PointSize);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float u_opacity;
  uniform vec3 u_color;

  varying float v_alpha;

  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    float softEdge = smoothstep(0.5, 0.1, dist);
    float alpha = softEdge * u_opacity * min(v_alpha, 3.0);

    gl_FragColor = vec4(u_color, alpha);
  }
`;

// --- Mutable store (module-scoped, avoids React re-renders) ---
const feedStore = {
  bursts: Array.from({ length: MAX_BURSTS }, () => new THREE.Vector3(0, 0, 0)),
  burstIdx: 0,
  time: 0,
};

// Pre-allocated temp vectors for mouse projection
const _ndc = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _mouseWorld = new THREE.Vector2(999, 999);

// --- Three.js particle wave field ---
function ParticleWaves({ isDark }: { isDark: boolean }) {
  const { camera } = useThree();
  const mouseNDC = useRef({ x: 0, y: 0 });

  // Track mouse globally (canvas wrapper has pointer-events: none)
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseNDC.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseNDC.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Build particle grid geometry (once)
  const geometry = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const scales = new Float32Array(COUNT);
    const brightness = new Float32Array(COUNT);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const i = row * COLS + col;
        positions[i * 3] = (col / (COLS - 1) - 0.5) * GRID_W;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = (row / (ROWS - 1) - 0.5) * GRID_D;
        scales[i] = 0.6 + Math.random() * 1.0;
        brightness[i] = 0.3 + Math.random() * 0.7;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("a_scale", new THREE.BufferAttribute(scales, 1));
    geo.setAttribute("a_brightness", new THREE.BufferAttribute(brightness, 1));
    return geo;
  }, []);

  // Build shader material (once)
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        u_time: { value: 0 },
        u_mouse: { value: new THREE.Vector2(999, 999) },
        u_color: { value: new THREE.Color(1, 1, 1) },
        u_opacity: { value: 0.12 },
        u_bursts: { value: feedStore.bursts },
      },
    });
  }, []);

  // Sync theme → uniforms
  useEffect(() => {
    if (isDark) {
      material.uniforms.u_color.value.setRGB(1, 1, 1);
      material.uniforms.u_opacity.value = 0.12;
      material.blending = THREE.AdditiveBlending;
    } else {
      material.uniforms.u_color.value.setRGB(0.12, 0.12, 0.12);
      material.uniforms.u_opacity.value = 0.08;
      material.blending = THREE.NormalBlending;
    }
    material.needsUpdate = true;
  }, [isDark, material]);

  // Per-frame animation
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1); // cap to avoid jumps on tab-refocus
    feedStore.time += dt;
    material.uniforms.u_time.value = feedStore.time;

    // Project screen-space mouse to y=0 world plane
    const { x, y } = mouseNDC.current;
    _ndc.set(x, y, 0.5).unproject(camera);
    _dir.copy(_ndc).sub(camera.position).normalize();
    if (Math.abs(_dir.y) > 0.001) {
      const t = -camera.position.y / _dir.y;
      if (t > 0) {
        _mouseWorld.set(camera.position.x + _dir.x * t, camera.position.z + _dir.z * t);
      }
    }
    material.uniforms.u_mouse.value.copy(_mouseWorld);
  });

  return <points geometry={geometry} material={material} />;
}

// Point camera at origin after mount
function CameraRig() {
  const { camera } = useThree();
  useEffect(() => {
    camera.lookAt(0, 0, 0);
  }, [camera]);
  return null;
}

// --- Floating label helpers ---
interface FloatingLabel {
  id: string;
  name: string;
  x: number;
  y: number;
  createdAt: number;
}

/** Random position in a ring around viewport center (avoids the search bar area) */
function getLabelPosition() {
  const angle = Math.random() * Math.PI * 2;
  const r = 25 + Math.random() * 18;
  return {
    x: Math.max(8, Math.min(92, 50 + Math.cos(angle) * r)),
    y: Math.max(8, Math.min(92, 50 + Math.sin(angle) * r)),
  };
}

// SVG noise tile for film grain effect
const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

// =============================================================================
// Main exported component
// =============================================================================
export function LiveFeedBackground() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [labels, setLabels] = useState<FloatingLabel[]>([]);

  useEffect(() => {
    setMounted(true);
    // Reset store on mount so time starts fresh
    feedStore.time = 0;
    feedStore.burstIdx = 0;
    feedStore.bursts.forEach((b) => b.set(0, 0, 0));
  }, []);

  // --- SSE connection for real-time npm package updates ---
  useEffect(() => {
    if (!mounted) return;

    let es: EventSource | null = null;
    let reconnectTimer: NodeJS.Timeout;
    let alive = true;

    const connect = () => {
      if (!alive) return;
      es = new EventSource(`${API_URL}/v1/updates/stream`);

      es.addEventListener("package", (event) => {
        try {
          const { name } = JSON.parse(event.data);

          // Trigger a burst in the Three.js particle field
          const bx = (Math.random() - 0.5) * GRID_W * 0.7;
          const bz = (Math.random() - 0.5) * GRID_D * 0.7;
          feedStore.bursts[feedStore.burstIdx].set(bx, bz, feedStore.time);
          feedStore.burstIdx = (feedStore.burstIdx + 1) % MAX_BURSTS;

          // Show a floating label
          const pos = getLabelPosition();
          setLabels((prev) =>
            [
              {
                id: `${name}-${Date.now()}-${Math.random()}`,
                name,
                ...pos,
                createdAt: Date.now(),
              },
              ...prev,
            ].slice(0, MAX_LABELS),
          );
        } catch {
          // ignore parse errors
        }
      });

      es.onerror = () => {
        es?.close();
        es = null;
        if (alive) reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      alive = false;
      es?.close();
      clearTimeout(reconnectTimer);
    };
  }, [mounted]);

  // Clean up expired labels
  useEffect(() => {
    const iv = setInterval(() => {
      setLabels((prev) => prev.filter((l) => Date.now() - l.createdAt < 4500));
    }, 500);
    return () => clearInterval(iv);
  }, []);

  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";

  return (
    <>
      {/* ====== Three.js particle canvas ====== */}
      <div
        aria-hidden="true"
        style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none" }}
      >
        <Canvas
          camera={{ position: [0, 5, 6], fov: 60, near: 0.1, far: 100 }}
          dpr={[1, 1.5]}
          gl={{ antialias: false, alpha: true }}
          style={{ background: "transparent" }}
        >
          <CameraRig />
          <ParticleWaves isDark={isDark} />
        </Canvas>
      </div>

      {/* ====== Floating package name labels ====== */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        {labels.map((label) => (
          <div
            key={label.id}
            className="feed-label"
            style={{
              position: "absolute",
              left: `${label.x}%`,
              top: `${label.y}%`,
              fontFamily: "var(--font-mono), monospace",
              fontSize: "11px",
              letterSpacing: "0.5px",
              whiteSpace: "nowrap",
              color: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.07)",
              textShadow: isDark
                ? "0 0 8px rgba(255,255,255,0.12), 0 0 2px rgba(255,255,255,0.2)"
                : "none",
            }}
          >
            {">"} PUBLISH{" "}
            <span style={{ color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)" }}>
              {label.name}
            </span>
          </div>
        ))}
      </div>

      {/* ====== CRT Dirt: Vignette ====== */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 52,
          pointerEvents: "none",
          background: isDark
            ? "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.55) 100%)"
            : "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.1) 100%)",
        }}
      />

      {/* ====== CRT Dirt: Film grain ====== */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 53,
          pointerEvents: "none",
          overflow: "hidden",
          opacity: isDark ? 0.04 : 0.025,
          mixBlendMode: isDark ? "screen" : "multiply",
        }}
      >
        <div
          className="feed-grain"
          style={{
            position: "absolute",
            inset: "-50%",
            width: "200%",
            height: "200%",
            backgroundImage: NOISE_SVG,
            backgroundRepeat: "repeat",
            backgroundSize: "256px 256px",
          }}
        />
      </div>

      {/* ====== CRT Dirt: Glitch bar ====== */}
      <div
        aria-hidden="true"
        className="feed-glitch-bar"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          height: "2px",
          zIndex: 54,
          pointerEvents: "none",
          background: isDark
            ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)"
            : "linear-gradient(90deg, transparent, rgba(0,0,0,0.05), transparent)",
        }}
      />

      {/* ====== Animations ====== */}
      <style jsx global>{`
        /* Floating label: fade in, hold, float up, fade out */
        .feed-label {
          animation: feedLabel 4s ease-out forwards;
        }
        @keyframes feedLabel {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) translateY(8px);
          }
          7% {
            opacity: 1;
            transform: translate(-50%, -50%) translateY(0);
          }
          70% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) translateY(-22px);
          }
        }

        /* Film grain: rapidly shifting noise tile */
        .feed-grain {
          animation: feedGrain 0.8s steps(6) infinite;
        }
        @keyframes feedGrain {
          0% {
            transform: translate(0, 0);
          }
          17% {
            transform: translate(-8%, -5%);
          }
          33% {
            transform: translate(5%, -12%);
          }
          50% {
            transform: translate(-3%, 8%);
          }
          67% {
            transform: translate(12%, 3%);
          }
          83% {
            transform: translate(-5%, -8%);
          }
          100% {
            transform: translate(0, 0);
          }
        }

        /* Horizontal glitch bar: rare VHS tracking artifact */
        .feed-glitch-bar {
          opacity: 0;
          animation: feedGlitch 12s step-end infinite;
        }
        @keyframes feedGlitch {
          0%,
          89%,
          91%,
          93%,
          100% {
            opacity: 0;
            top: 0;
          }
          90% {
            opacity: 1;
            top: 28%;
          }
          92% {
            opacity: 0.7;
            top: 67%;
          }
        }
      `}</style>
    </>
  );
}
