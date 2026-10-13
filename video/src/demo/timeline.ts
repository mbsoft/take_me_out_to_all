/**
 * Scene timing (frames at 30 fps). Music: "Infinity" by Arulo (Mixkit), 112 BPM; scene cuts snap to the nearest beat.
 */
export const FPS = 30;
export const BPM = 112;
export const BEAT = (60 / BPM) * FPS;

const at = (seconds: number) => Math.round(Math.round((seconds * FPS) / BEAT) * BEAT);

export const scenes = {
  hook: { from: 0, to: at(5) },
  dashboard: { from: at(5), to: at(12) },
  newTrip: { from: at(12), to: at(19) },
  generate: { from: at(19), to: at(28) },
  builder: { from: at(28), to: at(36) },
  map: { from: at(36), to: at(46) },
  details: { from: at(46), to: at(52) },
  share: { from: at(52), to: at(58) },
  scorecard: { from: at(58), to: at(64) },
  admin: { from: at(64), to: at(73) },
  closer: { from: at(73), to: at(80) },
} as const;

export type SceneKey = keyof typeof scenes;
export const TOTAL = scenes.closer.to;

export type Cue = { frame: number; sfx: string; volume?: number };
export const cues: Cue[] = [];
export const cue = (sceneFrom: number, frame: number, sfx: string, volume = 1) => {
  cues.push({ frame: sceneFrom + frame, sfx, volume });
};
