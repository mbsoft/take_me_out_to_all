# Take Me Out to the Ballparks: demo video

An ~80 s Remotion video built from real screenshots of the live app (takemeout.mbsoft.com, 2026-10-13). It's its own
npm project, separate from the Next.js app (the root `tsconfig.json`, ESLint config and `.dockerignore` exclude `video/`).

```sh
cd video
npm install
npm run preview   # Remotion Studio
npm run render    # out/take-me-out-demo.mp4 (1920x1080, 30 fps)
npm run poster    # out/poster.png
npm run typecheck
```

- `public/shots/*.jpg`: 3200×1800 captures of a 1600×900 browser window, signed in as the owner, using a throwaway demo
  itinerary ("NL Summer Road Trip (demo)": National League goal, mixed travel, start Chicago) that was deleted afterwards.
  Other users' names and emails on the admin screens are blurred; news photos on the dashboard are blurred.
- `src/demo/Demo.tsx`: the scenes. Push-in boxes are in those 1600×900 page pixels.
- `src/demo/copy.ts`: every word on screen, with the numbers from that run. `src/demo/timeline.ts`: scene timing.
- Audio: Mixkit (free licence), see `public/audio/LICENSES.md`.
