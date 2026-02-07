# Take Me Out to the Ballparks ⚾

[![CI](https://github.com/mbsoft/take_me_out_to_all/actions/workflows/test.yml/badge.svg)](https://github.com/mbsoft/take_me_out_to_all/actions/workflows/test.yml)

A full-stack web application for planning MLB ballpark visit itineraries for the 2026 season. Users can create optimized travel schedules to visit multiple ballparks, view game information, get ticket prices, and plan their ultimate baseball road trip.

## Features

### Core Features
- **Itinerary Builder:** Create custom ballpark visit schedules with drag-and-drop interface
- **Smart Routing:** Optimize travel between stadiums with driving directions and distance calculations
- **Auto-Generate:** AI-powered itinerary generation that creates optimal routes to visit all target ballparks
- **Game Schedule:** Browse the complete 2026 MLB schedule with filtering by team, date, and day/night games
- **Ticket Prices:** View real-time ticket prices via SeatGeek integration
- **Trip Cost Estimation:** Get estimated costs including gas, flights, hotels, food, and tickets

### Map & Visualization
- **Interactive Maps:** Visualize your itinerary on an interactive MapLibre GL map with route polylines
- **Flight Paths:** Animated airplane markers for air travel segments with great-circle arc rendering
- **Ballpark Markers:** See all MLB stadiums with visited/unvisited status
- **3D Stadium Viewer:** View 3D stadium models (Three.js integration)

### Travel Planning
- **Travel Modes:** Support for driving, air travel, or mixed transportation per segment
- **Stopovers:** Add custom stopovers between games (cities, attractions, etc.)
- **Start/End Locations:** Set custom departure and return locations
- **Progress Tracking:** Track which ballparks you've visited with goal options:
  - All 30 MLB ballparks
  - American League only (15 parks)
  - National League only (15 parks)
  - Custom team selection

### Sharing & Collaboration
- **Shareable Links:** Generate public links to share itineraries with friends
- **Revokable Shares:** Disable share links when no longer needed

### User Features
- **User Profile:** Manage account settings with avatar display
- **Password Management:** Change password for credentials-based accounts
- **Ballpark Scorecard:** Track personal ballpark visits independent of itineraries
- **Account Deletion:** Self-service account removal with data cleanup
- **Photo Gallery:** Upload and manage photos from your ballpark visits

### Admin Features
- **Admin Dashboard:** Manage users, itineraries, and system settings
- **User Management:** View, edit, export, and toggle user accounts
- **Itinerary Templates:** Create and manage templates for new user onboarding
- **API Monitoring:** Track API usage and performance metrics
- **Cloud Run Stats:** Monitor deployment health and metrics

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **UI Components:** shadcn/ui, Radix UI, Lucide Icons
- **Backend:** Next.js API Routes
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (game photos)
- **Authentication:** NextAuth.js v5 (credentials + Google OAuth)
- **Maps:** MapLibre GL, NextBillion.ai
- **3D Graphics:** Three.js
- **Drag & Drop:** @hello-pangea/dnd
- **Email:** Resend (transactional emails)
- **External APIs:** SeatGeek (tickets), NextBillion.ai (routing/directions)
- **Testing:** Vitest, React Testing Library

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- SeatGeek API credentials
- NextBillion.ai API key
- Resend API key (for email)
- Google OAuth credentials (optional, for SSO)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/mbsoft/take_me_out_to_all.git
   cd take_me_out_to_all
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**

   Create a `.env.local` file in the root directory:

   ```bash
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   # NextAuth
   NEXTAUTH_SECRET=your-random-secret
   NEXTAUTH_URL=http://localhost:3000

   # Google OAuth (optional, for SSO)
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret

   # External APIs
   SEATGEEK_CLIENT_ID=your-seatgeek-client-id
   SEATGEEK_CLIENT_SECRET=your-seatgeek-client-secret
   NEXT_PUBLIC_NBAI_API_KEY=your-nextbillion-api-key
   NBAI_API_KEY=your-nextbillion-api-key

   # Email (Resend)
   RESEND_API_KEY=your-resend-api-key

   # Admin
   ADMIN_SECRET=your-admin-secret
   ```

4. **Set up Supabase database:**

   - Go to your Supabase project
   - Navigate to SQL Editor
   - Run the schema from `src/lib/schema.sql`
   - Run migrations from `scripts/migrations/` (in order)

5. **Seed the database:**
   ```bash
   npm run seed
   ```

6. **Run the development server:**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
.
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── api/                    # API Routes
│   │   │   ├── admin/              # Admin APIs (users, templates, monitoring)
│   │   │   ├── auth/               # Authentication (NextAuth, register, password reset)
│   │   │   ├── directions/         # Route planning with caching
│   │   │   ├── discover/           # Discovery/exploration features
│   │   │   ├── games/              # Game schedule API
│   │   │   ├── itineraries/        # Itinerary CRUD + games, stopovers, share, costs
│   │   │   ├── seatgeek/           # Ticket pricing proxy
│   │   │   ├── share/              # Public share access
│   │   │   ├── suggest/            # Smart game suggestions
│   │   │   ├── teams/              # MLB teams data
│   │   │   └── user/               # User profile, password, visited parks
│   │   ├── admin/                  # Admin dashboard pages
│   │   ├── dashboard/              # User dashboard
│   │   ├── itinerary/              # Itinerary builder pages
│   │   ├── onboarding/             # New user onboarding
│   │   ├── profile/                # User profile page
│   │   ├── share/                  # Public share view
│   │   └── (auth pages)/           # Login, register, reset-password, verify-email
│   ├── components/                 # React Components
│   │   ├── ui/                     # shadcn/ui components
│   │   ├── __tests__/              # Component tests
│   │   ├── admin-sidebar.tsx       # Admin navigation
│   │   ├── game-detail-panel.tsx   # Game details sidebar
│   │   ├── itinerary-map.tsx       # Interactive map with routes
│   │   ├── navbar.tsx              # Main navigation with avatar
│   │   ├── place-autocomplete.tsx  # Location search
│   │   ├── stadium-viewer.tsx      # 3D stadium view
│   │   ├── team-logo.tsx           # Team logo component
│   │   ├── team-picker.tsx         # Multi-team selector
│   │   └── trip-cost-summary.tsx   # Cost breakdown display
│   └── lib/                        # Utilities & Services
│       ├── __tests__/              # Unit tests
│       ├── auth.ts                 # NextAuth configuration
│       ├── admin-auth.ts           # Admin authentication
│       ├── api-logger.ts           # API call logging
│       ├── cost-calculator.ts      # Trip cost estimation
│       ├── db.ts                   # Supabase client
│       ├── email.ts                # Email service (Resend)
│       ├── goal-utils.ts           # Goal filtering utilities
│       ├── haversine.ts            # Distance calculations
│       ├── route-optimizer.ts      # TSP route optimization
│       ├── nb-route-optimizer.ts   # NextBillion.ai optimizer
│       ├── team-logos.ts           # Logo URL utilities
│       ├── teams-data.ts           # Static team data
│       └── template-seeder.ts      # Template initialization
├── scripts/
│   ├── migrations/                 # Database migrations
│   ├── seed.ts                     # Database seeding
│   ├── download-mlb-logos.ts       # Logo downloader
│   └── (deployment scripts)/       # GCP/Terraform scripts
├── terraform/                      # Infrastructure as Code
├── public/
│   └── images/                     # Team logos and assets
├── Dockerfile                      # Container definition
└── package.json                    # Dependencies and scripts
```

## Deployment

This application is deployed on **Google Cloud Platform** using **Cloud Run** (serverless containers) with **Terraform** for infrastructure management.

### Quick Deploy to GCP

```bash
# 1. Initial setup (one-time)
./scripts/gcp-setup.sh

# 2. Create secrets
./scripts/create-secrets.sh

# 3. Build and push Docker image
./scripts/build-and-push.sh

# 4. Deploy with Terraform
cd terraform
terraform init
terraform apply
```

For detailed deployment instructions, troubleshooting, and production setup, see [DEPLOYMENT.md](DEPLOYMENT.md).

### Architecture

- **Compute:** Cloud Run (serverless, 2M requests/month free)
- **Database:** Supabase PostgreSQL (external, 500MB free tier)
- **Storage:** Supabase Storage (external, 1GB free tier)
- **Registry:** Artifact Registry (0.5GB free)
- **Secrets:** Secret Manager (6 secret versions free)
- **IaC:** Terraform modules
- **CI/CD:** Cloud Build (120 build-minutes/day free)

### Cost Estimate

**$0/month** for moderate traffic (within GCP free tier limits)

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run seed` | Seed database with teams and games |
| `npm run download-mlb-logos` | Download team logos |

## API Endpoints

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/*` | * | NextAuth authentication |
| `/api/auth/register` | POST | User registration |
| `/api/auth/forgot-password` | POST | Request password reset |
| `/api/auth/reset-password` | POST | Reset password with token |
| `/api/auth/verify-email` | POST | Verify email address |

### Core APIs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/games` | GET | Get MLB games with filters |
| `/api/teams` | GET | Get all MLB teams |
| `/api/directions` | POST | Get route directions (cached) |
| `/api/seatgeek` | GET | Get ticket prices |
| `/api/suggest` | GET | Get smart game suggestions |

### Itineraries
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/itineraries` | GET/POST | List or create itineraries |
| `/api/itineraries/[id]` | GET/PUT/DELETE | CRUD operations |
| `/api/itineraries/[id]/games` | POST | Add game to itinerary |
| `/api/itineraries/[id]/games/[gameId]` | PATCH/DELETE | Update or remove game |
| `/api/itineraries/[id]/games/reorder` | PUT | Reorder games |
| `/api/itineraries/[id]/games/[gameId]/photos` | GET/POST | Manage game photos |
| `/api/itineraries/[id]/stopovers` | POST | Add stopover |
| `/api/itineraries/[id]/stopovers/[id]` | DELETE | Remove stopover |
| `/api/itineraries/[id]/share` | POST/DELETE | Create/revoke share link |
| `/api/itineraries/[id]/costs` | GET | Get trip cost breakdown |
| `/api/itineraries/[id]/auto-generate` | POST | Auto-generate itinerary |

### User
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/user` | GET/DELETE | Get user info / delete account |
| `/api/user/password` | POST | Change password |
| `/api/user/visited-parks` | GET/POST | Manage visited parks |

### Admin
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/users` | GET | List all users |
| `/api/admin/users/[id]` | GET/PUT | User details |
| `/api/admin/users/[id]/toggle-active` | POST | Activate/deactivate user |
| `/api/admin/users/[id]/export` | GET | Export user data |
| `/api/admin/templates` | GET/POST | Manage templates |
| `/api/admin/monitoring/*` | GET | API and system metrics |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key | Yes |
| `NEXTAUTH_SECRET` | NextAuth secret key | Yes |
| `NEXTAUTH_URL` | Application base URL | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | No |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | No |
| `SEATGEEK_CLIENT_ID` | SeatGeek API client ID | Yes |
| `SEATGEEK_CLIENT_SECRET` | SeatGeek API secret | Yes |
| `NEXT_PUBLIC_NBAI_API_KEY` | NextBillion.ai API key (client) | Yes |
| `NBAI_API_KEY` | NextBillion.ai API key (server) | Yes |
| `RESEND_API_KEY` | Resend email API key | Yes |
| `ADMIN_SECRET` | Admin authentication secret | Yes |

## Development

### Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run tests with coverage report
npm run test:coverage
```

**Test Coverage:** 150+ tests across 11 test files covering:
- Utility functions (haversine, goal-utils, team-logos, route-optimizer, cost-calculator)
- Auth API routes (register, forgot-password, reset-password)
- Itinerary CRUD APIs
- React components (TeamPicker, PlaceAutocomplete)

### Local Docker Testing

Test the Docker build locally:

```bash
./scripts/test-local-docker.sh
```

### Code Style

This project uses ESLint and TypeScript for code quality:

```bash
npm run lint
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- MLB Schedule data for the 2026 season
- [Next.js](https://nextjs.org/) - React framework
- [Supabase](https://supabase.com/) - Backend as a Service
- [SeatGeek](https://seatgeek.com/) - Ticket pricing data
- [NextBillion.ai](https://nextbillion.ai/) - Routing and maps
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [MapLibre GL](https://maplibre.org/) - Open-source maps
- [Three.js](https://threejs.org/) - 3D graphics

## Support

For questions, issues, or feature requests, please open an issue on GitHub.

## Roadmap

### Completed ✓
- [x] User authentication with OAuth providers (Google)
- [x] Sharing of itineraries via public links
- [x] Trip cost estimation with breakdown
- [x] User profile management
- [x] Ballpark visit tracking (scorecard)
- [x] Admin dashboard with user management
- [x] Itinerary templates for onboarding
- [x] Smart game suggestions
- [x] Auto-generate optimized itineraries
- [x] Mixed travel modes (drive/fly per segment)
- [x] Stopovers between games

### Planned
- [ ] Weather forecast integration
- [ ] Mobile app (React Native)
- [ ] Hotel recommendations near stadiums
- [ ] Budget tracking and limits
- [ ] Social features (follow friends' trips)
- [ ] Printable itinerary PDFs
- [ ] Calendar export (iCal/Google Calendar)
- [ ] Push notifications for game reminders

---

**Built with ❤️ for baseball fans everywhere**
