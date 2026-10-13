import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import { lin } from "../motion";
import { C, MONO, SANS } from "../theme";

/** Screenshots are 3200×1800 captures of a 1600×900 browser viewport; boxes are in those 1600×900 page pixels. */
export const PAGE_W = 1600;
export const PAGE_H = 900;
type Box = [number, number, number, number];

export type Layer = { src: string; from: number; to?: number };
export type ZoomKey = { frame: number; scale: number; box: Box };
export type Ring = { at: number; until?: number; box: Box };

const STAGE_X = 50, STAGE_W = 1240, BAR = 40;
const STAGE_H = (STAGE_W * PAGE_H) / PAGE_W;
const STAGE_Y = Math.round((1080 - STAGE_H - BAR) / 2);
const BASE = STAGE_W / PAGE_W;

const smooth = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const zoomAt = (frame: number, zoom: ZoomKey[]): { scale: number; box: Box } => {
  if (!zoom.length) return { scale: 1, box: [0, 0, PAGE_W, PAGE_H] };
  if (frame <= zoom[0].frame) return zoom[0];
  const last = zoom[zoom.length - 1];
  if (frame >= last.frame) return last;
  for (let i = 1; i < zoom.length; i++) {
    if (frame <= zoom[i].frame) {
      const a = zoom[i - 1], b = zoom[i];
      const t = smooth((frame - a.frame) / (b.frame - a.frame));
      return { scale: lerp(a.scale, b.scale, t), box: [0, 1, 2, 3].map((j) => lerp(a.box[j], b.box[j], t)) as Box };
    }
  }
  return last;
};

/**
 * A real app screenshot in a browser window, with push-ins (each key centres a box at a scale, clamped so the page never
 * pulls off the window edge), cross-fades between screenshots, and pulsing rings on what was clicked.
 */
export const Shot: React.FC<{ layers: Layer[]; zoom?: ZoomKey[]; rings?: Ring[] }> = ({ layers, zoom = [], rings = [] }) => {
  const frame = useCurrentFrame();
  const k = zoomAt(frame, zoom);
  const [x1, y1, x2, y2] = k.box;
  const s = Math.max(1, Math.min(k.scale, PAGE_W / Math.max(1, x2 - x1), PAGE_H / Math.max(1, y2 - y1)));
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const tx = clamp(PAGE_W / 2 - (s * (x1 + x2)) / 2, PAGE_W - s * PAGE_W, 0);
  const ty = clamp(PAGE_H / 2 - (s * (y1 + y2)) / 2, PAGE_H - s * PAGE_H, 0);
  return (
    <div style={{ position: "absolute", left: STAGE_X, top: STAGE_Y, width: STAGE_W, height: STAGE_H + BAR, borderRadius: 18, overflow: "hidden", background: "#f7f5f0", boxShadow: "0 60px 120px -30px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.08)", fontFamily: SANS }}>
      <div style={{ height: BAR, background: "#1b2232", display: "flex", alignItems: "center", padding: "0 16px", gap: 8 }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => <div key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />)}
        <div style={{ marginLeft: 20, padding: "4px 16px", borderRadius: 8, background: "#0f1421", color: C.muted, fontSize: 14, fontFamily: MONO }}>takemeout.mbsoft.com</div>
      </div>
      <div style={{ position: "relative", width: STAGE_W, height: STAGE_H, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: PAGE_W, height: PAGE_H, transformOrigin: "0 0", transform: `scale(${BASE})` }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: PAGE_W, height: PAGE_H, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${s})` }}>
            {layers.map((l, i) => {
              const fadeIn = i === 0 ? 1 : lin(frame, l.from, l.from + 10);
              const visible = frame >= l.from - 1 && (l.to === undefined || frame < l.to + 10);
              if (!visible) return null;
              return <Img key={l.src} src={staticFile(`shots/${l.src}`)} style={{ position: "absolute", left: 0, top: 0, width: PAGE_W, height: PAGE_H, opacity: fadeIn }} />;
            })}
            {rings.map((r, i) => {
              if (frame < r.at || (r.until !== undefined && frame >= r.until)) return null;
              const t = frame - r.at;
              const pulse = 0.5 + 0.5 * Math.cos((t / 18) * Math.PI * 2);
              const o = Math.min(1, t / 6);
              const [a, b, c, d] = r.box;
              return <div key={i} style={{ position: "absolute", left: a - 6, top: b - 6, width: c - a + 12, height: d - b + 12, borderRadius: 12, border: `${4 / s}px solid ${C.accent}`, boxShadow: `0 0 ${18 + 14 * pulse}px rgba(37,99,235,${0.35 + 0.35 * pulse})`, opacity: o }} />;
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
