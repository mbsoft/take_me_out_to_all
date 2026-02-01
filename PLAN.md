# Take Me Out To All — MVP Plan

## Overview
Full-stack web app to plan MLB ballpark-visit itineraries for the 2026 season. Users set start/end locations, choose a goal (all 30 parks, AL-only, NL-only), pick travel mode, and build an optimized schedule with drag-and-drop.

## Tech Stack
- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Next.js API routes (Route Handlers)
- **Database:** Turso (libSQL) via `@libsql/client`
- **Auth:** NextAuth.js (credentials-based for MVP, email/password)
- **Maps/Distance:** Haversine formula for distance estimates (no external API dependency for MVP)
- **Drag & Drop:** `@hello-pangea/dnd` (maintained fork of react-beautiful-dnd)
- **Deployment:** Vercel

## Database Schema (Turso/SQLite)

```sql
-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY,        -- UUID
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, -- bcrypt
  name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Static team/stadium reference
CREATE TABLE teams (
  abbr TEXT PRIMARY KEY,       -- 'NYY', 'SF', etc.
  name TEXT NOT NULL,          -- 'New York Yankees'
  league TEXT NOT NULL,        -- 'AL' or 'NL'
  division TEXT NOT NULL,      -- 'East', 'Central', 'West'
  stadium_name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL
);

-- Games (imported from JSON)
CREATE TABLE games (
  game_id INTEGER PRIMARY KEY,
  day TEXT NOT NULL,
  date_time TEXT NOT NULL,
  date_time_utc TEXT NOT NULL,
  away_team TEXT NOT NULL REFERENCES teams(abbr),
  home_team TEXT NOT NULL REFERENCES teams(abbr),
  stadium_id INTEGER NOT NULL,
  status TEXT NOT NULL
);

-- User itineraries
CREATE TABLE itineraries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  goal TEXT NOT NULL,          -- 'all', 'al', 'nl'
  travel_mode TEXT NOT NULL,   -- 'drive', 'fly', 'mixed'
  start_location TEXT,
  start_lat REAL,
  start_lon REAL,
  end_location TEXT,
  end_lat REAL,
  end_lon REAL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Games on an itinerary (ordered)
CREATE TABLE itinerary_games (
  id TEXT PRIMARY KEY,
  itinerary_id TEXT NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  game_id INTEGER NOT NULL REFERENCES games(game_id),
  sort_order INTEGER NOT NULL,
  notes TEXT
);
```

## Feature Breakdown

### 1. Seed Data & Reference Data
- Import `2026_mlb_schedule.json` into `games` table (filter out canceled)
- Seed `teams` table with 30 teams, league/division, stadium coords
- Classify day games (start before 5pm local) vs night games

### 2. Auth & User Profile
- Registration (email + password) and login pages
- NextAuth.js credentials provider with bcrypt password hashing
- Simple profile page showing saved itineraries

### 3. Itinerary Builder (core feature)
- **Step 1 — Setup:** User enters start city, end city, selects goal (all/AL/NL), travel mode (drive/fly/mixed)
- **Step 2 — Schedule View:** Calendar/list view of all home games at target ballparks
  - Filter by date range, team, day/night preference
  - "Favor day games" toggle highlights/prioritizes day games
- **Step 3 — Drag & Drop:** Two-panel layout
  - Left: available games (filterable list)
  - Right: itinerary (ordered list, drag to reorder)
  - Drag games from available → itinerary
  - Reorder games within itinerary
  - Remove games from itinerary
- **Step 4 — Progress Tracker:** Visual indicator showing:
  - Ballparks visited vs remaining (e.g., 12/30)
  - Progress bar with team logos or abbreviations
  - Color-coded: visited (green), scheduled (yellow), remaining (gray)
  - Separate tracking for AL/NL if relevant

### 4. Smart Suggestions
- Given current itinerary + travel mode, suggest next-best game based on:
  - Geographic proximity (haversine distance)
  - Date feasibility (enough travel time between games)
  - Day game preference weight
  - Unvisited ballpark priority
- Simple greedy algorithm for MVP (not full TSP solver)

### 5. Itinerary Summary
- List of games in order with dates, teams, stadiums
- Estimated travel distances between stops
- Total trip stats (days, miles, parks visited)

## Pages / Routes

```
/                     — Landing page
/login                — Login
/register             — Register
/dashboard            — User's saved itineraries
/itinerary/new        — Create new itinerary (setup wizard)
/itinerary/[id]       — View/edit existing itinerary (builder)
```

## API Routes

```
POST   /api/auth/register
GET    /api/games?team=&startDate=&endDate=&dayOnly=
GET    /api/teams
POST   /api/itineraries
GET    /api/itineraries
GET    /api/itineraries/[id]
PUT    /api/itineraries/[id]
DELETE /api/itineraries/[id]
POST   /api/itineraries/[id]/games     — add game
DELETE /api/itineraries/[id]/games/[gameId]
PUT    /api/itineraries/[id]/games/reorder
GET    /api/suggest?itineraryId=        — smart next-game suggestion
```

## Implementation Order

1. **Project setup** — Next.js, Tailwind, shadcn/ui, Turso client, env config
2. **Database** — Schema creation, seed teams, import schedule JSON
3. **Auth** — NextAuth setup, register/login pages
4. **Teams & Schedule API** — endpoints to query games and teams
5. **Itinerary CRUD** — create/read/update/delete itineraries
6. **Builder UI** — two-panel drag-and-drop with game filtering
7. **Progress tracker** — visual progress toward goal
8. **Smart suggestions** — proximity-based next game recommendations
9. **Dashboard** — list saved itineraries
10. **Polish** — responsive layout, loading states, error handling

## Key Design Decisions
- **No external map API for MVP** — use haversine for distances, static stadium coords. Map visualization can be added later.
- **No real flight/drive time API** — estimate drive time at ~60mph avg, flight as 2.5hr + distance/500mph. Good enough for planning.
- **Day game classification** — game_time before 17:00 local = day game
- **Greedy suggestions** — simple nearest-unvisited + date-feasible algorithm, not full optimization
