import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { pop, settle } from "../motion";
import { C, DISPLAY, MONO } from "../theme";
import { Background, Callout, Caption, Kicker } from "../ui/Base";
import { copy } from "./copy";
import { Layer, Ring, Shot, ZoomKey } from "./Shot";
import { cue, cues, SceneKey, scenes, TOTAL } from "./timeline";

const Logo: React.FC<{ size: number }> = ({ size }) => (
  <Img src={staticFile("img/logo.png")} style={{ width: size * 1.8, height: size, objectFit: "cover", borderRadius: size * 0.22, boxShadow: "0 12px 30px rgba(0,0,0,0.45)" }} />
);

const FULL: [number, number, number, number] = [0, 0, 1600, 900];

type Step = {
  key: Exclude<SceneKey, "hook" | "closer">;
  layers: Layer[];
  zoom: ZoomKey[];
  rings?: Ring[];
  calloutAt: number;
  name: string;
};

/** Boxes are page pixels in the 1600×900 captures (public/shots, 3200×1800 at 2×). */
const steps: Step[] = [
  {
    key: "dashboard", name: "Dashboard",
    layers: [{ src: "01-dashboard.jpg", from: 0 }],
    zoom: [{ frame: 0, scale: 1, box: FULL }, { frame: 40, scale: 1.6, box: [330, 176, 790, 507] }],
    rings: [{ at: 45, box: [632, 296, 762, 324] }],
    calloutAt: 50,
  },
  {
    key: "newTrip", name: "New trip",
    layers: [{ src: "02-new.jpg", from: 0 }],
    zoom: [{ frame: 0, scale: 1, box: FULL }, { frame: 30, scale: 1.3, box: [480, 100, 1120, 772] }],
    rings: [{ at: 35, until: 75, box: [511, 292, 1089, 342] }, { at: 75, box: [511, 379, 1089, 430] }],
    calloutAt: 45,
  },
  {
    key: "generate", name: "Auto-generate",
    layers: [{ src: "03-empty.jpg", from: 0 }, { src: "06-generated.jpg", from: 80 }],
    zoom: [{ frame: 0, scale: 1, box: FULL }, { frame: 25, scale: 1.4, box: [662, 185, 1580, 892] }, { frame: 78, scale: 1.4, box: [662, 185, 1580, 892] }, { frame: 100, scale: 1.8, box: [480, 266, 1120, 634] }],
    rings: [{ at: 30, until: 76, box: [998, 428, 1244, 472] }],
    calloutAt: 105,
  },
  {
    key: "builder", name: "Builder",
    layers: [{ src: "07-builder.jpg", from: 0 }],
    zoom: [{ frame: 0, scale: 1, box: FULL }, { frame: 28, scale: 1.6, box: [662, 290, 1580, 760] }],
    rings: [{ at: 40, until: 90, box: [1052, 558, 1190, 588] }, { at: 90, box: [693, 507, 1548, 546] }],
    calloutAt: 95,
  },
  {
    key: "map", name: "Map",
    layers: [{ src: "14-map.jpg", from: 0 }],
    zoom: [{ frame: 0, scale: 1, box: FULL }, { frame: 30, scale: 1.3, box: [20, 260, 1180, 900] }, { frame: 150, scale: 1.5, box: [380, 280, 1180, 880] }],
    rings: [{ at: 60, box: [36, 820, 250, 884] }],
    calloutAt: 65,
  },
  {
    key: "details", name: "Game details",
    layers: [{ src: "08-gamedetail.jpg", from: 0 }],
    zoom: [{ frame: 0, scale: 1, box: FULL }, { frame: 28, scale: 2.2, box: [1210, 0, 1600, 700] }],
    rings: [{ at: 50, box: [1329, 222, 1472, 260] }],
    calloutAt: 55,
  },
  {
    key: "share", name: "Share",
    layers: [{ src: "09-share.jpg", from: 0 }],
    zoom: [{ frame: 0, scale: 1, box: FULL }, { frame: 30, scale: 1.35, box: [150, 20, 1450, 720] }],
    calloutAt: 40,
  },
  {
    key: "scorecard", name: "Scorecard",
    layers: [{ src: "10-scorecard.jpg", from: 0 }],
    zoom: [{ frame: 0, scale: 1, box: FULL }, { frame: 30, scale: 1.4, box: [271, 180, 1329, 760] }],
    rings: [{ at: 40, box: [271, 196, 1329, 240] }],
    calloutAt: 45,
  },
  {
    key: "admin", name: "Admin",
    layers: [{ src: "11-admin.jpg", from: 0 }, { src: "16-monitoring-app.jpg", from: 90 }, { src: "12-templates.jpg", from: 170 }],
    zoom: [{ frame: 0, scale: 1, box: FULL }, { frame: 30, scale: 1.25, box: [360, 130, 1560, 520] }, { frame: 88, scale: 1.25, box: [360, 130, 1560, 520] }, { frame: 110, scale: 1, box: FULL }],
    calloutAt: 40,
  },
];

for (const s of steps) {
  const from = scenes[s.key].from;
  cue(from, 0, "whoosh", 0.35);
  for (const l of s.layers.slice(1)) cue(from, l.from, "click", 0.6);
  for (const r of s.rings ?? []) cue(from, r.at, "tick", 0.5);
  cue(from, s.calloutAt, "pop", 0.55);
}
cue(scenes.hook.from, 8, "swish", 0.5);
cue(scenes.hook.from, 40, "swish", 0.5);
cue(scenes.hook.from, 62, "pop", 0.6);
cue(scenes.closer.from, 36, "chime", 0.6);

const StepScene: React.FC<{ step: Step }> = ({ step }) => {
  const c = copy[step.key];
  return (
    <AbsoluteFill>
      <Background />
      <Shot layers={step.layers} zoom={step.zoom} rings={step.rings} />
      <Kicker text={c.kicker} start={2} x={1340} y={260} />
      <Caption text={c.caption} start={6} x={1340} y={340} width={540} size={58} />
      <Callout text={c.callout} at={step.calloutAt} x={1340} y={640} width={540} size={38} />
    </AbsoluteFill>
  );
};

const Brand: React.FC<{ at: number; sub: string }> = ({ at, sub }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = Math.min(1, pop(frame, fps, at));
  return (
    <div style={{ marginTop: 64, display: "inline-flex", alignItems: "center", gap: 24, opacity: c, transform: `scale(${0.85 + 0.15 * c})` }}>
      <Logo size={64} />
      <div style={{ textAlign: "left" }}>
        <div style={{ fontSize: 42, fontWeight: 800 }}>{copy.closer.brand}</div>
        <div style={{ fontSize: 26, color: C.muted, fontWeight: 600 }}>{sub}</div>
      </div>
    </div>
  );
};

const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = settle(frame, fps, 8), b = settle(frame, fps, 40);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Background />
      <div style={{ textAlign: "center", fontFamily: DISPLAY, color: C.text }}>
        <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -2, opacity: a, transform: `translateY(${(1 - a) * 30}px)` }}>{copy.hook.line1}</div>
        <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -2, color: C.accent2, marginTop: 10, opacity: b, transform: `translateY(${(1 - b) * 30}px)` }}>{copy.hook.line2}</div>
        <Brand at={62} sub={copy.hook.tag} />
      </div>
    </AbsoluteFill>
  );
};

const Closer: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = settle(frame, fps, 6), u = settle(frame, fps, 60);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Background />
      <div style={{ textAlign: "center", fontFamily: DISPLAY, color: C.text }}>
        <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -2, opacity: a, transform: `translateY(${(1 - a) * 30}px)` }}>{copy.closer.line}</div>
        <Brand at={36} sub={copy.closer.powered} />
        <div style={{ marginTop: 44, fontSize: 40, fontFamily: MONO, color: C.cream, opacity: u }}>{copy.closer.url}</div>
      </div>
    </AbsoluteFill>
  );
};

const Scene: React.FC<{ range: { from: number; to: number }; name: string; children: React.ReactNode }> = ({ range, name, children }) => (
  <Sequence from={range.from} durationInFrames={range.to - range.from} name={name}>{children}</Sequence>
);

export const Demo: React.FC = () => {
  const musicVolume = (f: number) => {
    const fadeIn = interpolate(f, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const fadeOut = interpolate(f, [TOTAL - 80, TOTAL - 6], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return 0.4 * Math.min(fadeIn, fadeOut);
  };
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Scene range={scenes.hook} name="0 Hook"><Hook /></Scene>
      {steps.map((s, i) => (
        <Scene key={s.key} range={scenes[s.key]} name={`${i + 1} ${s.name}`}><StepScene step={s} /></Scene>
      ))}
      <Scene range={scenes.closer} name="Closer"><Closer /></Scene>
      <Sequence from={0} name="Music"><Audio src={staticFile("audio/music.mp3")} volume={musicVolume} /></Sequence>
      {cues.map((c, i) => (
        <Sequence key={i} from={c.frame} durationInFrames={45} name={`sfx:${c.sfx}`}>
          <Audio src={staticFile(`audio/sfx/${c.sfx}.mp3`)} volume={c.volume ?? 1} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/** Poster: the trip map with the hook line (static text, so a one-frame still renders it fully). */
export const Poster: React.FC = () => (
  <AbsoluteFill>
    <Background />
    <Shot layers={[{ src: "14-map.jpg", from: 0 }]} zoom={[{ frame: 0, scale: 1.3, box: [20, 260, 1180, 900] }]} />
    <div style={{ position: "absolute", left: 1340, top: 290, width: 540, fontFamily: DISPLAY, color: C.text }}>
      <Logo size={56} />
      <div style={{ marginTop: 30, fontSize: 60, fontWeight: 800, lineHeight: 1.06, letterSpacing: -1.5 }}>Plan the whole ballpark road trip.</div>
      <div style={{ marginTop: 24, fontSize: 26, color: C.muted, fontWeight: 600 }}>{copy.closer.url}</div>
    </div>
  </AbsoluteFill>
);
