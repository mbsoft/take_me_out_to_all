import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { pop, settle, window as fadeWindow } from "../motion";
import { BG, C, DISPLAY, SANS } from "../theme";

/** Deep navy with a slow blue glow and a faint drifting grid of map pins. */
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const pins = [{ x: 8, y: 14 }, { x: 92, y: 22 }, { x: 86, y: 80 }, { x: 10, y: 84 }, { x: 52, y: 6 }];
  return (
    <AbsoluteFill style={{ background: BG }}>
      {pins.map((m, i) => (
        <svg key={i} viewBox="0 0 24 24" style={{ position: "absolute", left: `${m.x}%`, top: `${(m.y + frame * 0.02 * (i % 2 ? 1 : -1) + 100) % 100}%`, width: 48 + i * 8, opacity: 0.08 }}>
          <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" fill="#ffffff" />
        </svg>
      ))}
    </AbsoluteFill>
  );
};

/** Big headline caption in the right-hand column. */
export const Caption: React.FC<{ text: string; start?: number; end?: number; x?: number; y?: number; width?: number; size?: number }> = ({
  text, start = 6, end, x = 1340, y = 330, width = 540, size = 60,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = settle(frame, fps, start);
  const o = fadeWindow(frame, start, end ?? durationInFrames, 8, 8);
  return (
    <div style={{ position: "absolute", left: x, top: y, width, fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 1.08, letterSpacing: -1.5, color: C.text, opacity: o, transform: `translateY(${(1 - s) * 30}px)`, textShadow: "0 6px 30px rgba(0,0,0,0.5)" }}>
      {text}
    </div>
  );
};

export const Kicker: React.FC<{ text: string; start?: number; x?: number; y?: number }> = ({ text, start = 0, x = 1340, y = 250 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = settle(frame, fps, start);
  return (
    <div style={{ position: "absolute", left: x, top: y, padding: "10px 22px", borderRadius: 999, background: "rgba(37,99,235,0.22)", border: `2px solid ${C.accent}`, color: C.accent2, fontFamily: DISPLAY, fontWeight: 700, fontSize: 28, letterSpacing: 1, textTransform: "uppercase", opacity: s, transform: `translateY(${(1 - s) * 16}px)` }}>
      {text}
    </div>
  );
};

/** Pull-out text repeating a scene's key value at phone-readable size. */
export const Callout: React.FC<{ text: string; at: number; until?: number; x: number; y: number; width: number; size?: number; accent?: string }> = ({ text, at, until, x, y, width, size = 52, accent = C.accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at || (until !== undefined && frame >= until)) return null;
  const s = pop(frame, fps, at);
  return (
    <div style={{ position: "absolute", left: x, top: y, width, padding: "20px 28px", borderRadius: 26, background: "#0d1a3a", border: `4px solid ${accent}`, color: C.text, fontFamily: SANS, fontWeight: 700, fontSize: size, lineHeight: 1.15, transform: `scale(${0.8 + 0.2 * Math.min(1, s)})`, transformOrigin: "left center", opacity: Math.min(1, s * 1.4), boxShadow: "0 30px 60px -24px rgba(0,0,0,0.8)", zIndex: 10 }}>
      {text}
    </div>
  );
};
