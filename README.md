# Take Me Out to the Ballparks 🌍⚾

A full-stack web application for planning MLB ballpark visit itineraries for the 2026 season. Users can create optimized travel schedules to visit multiple ballparks, view game information, get ticket prices, and plan their ultimate baseball road trip.

## Features

- **Itinerary Builder:** Create custom ballpark visit schedules with drag-and-drop interface
- **Smart Routing:** Optimize travel between stadiums with driving directions and distance calculations
- **Game Schedule:** Browse the complete 2026 MLB schedule with filtering options
- **Ticket Prices:** View real-time ticket prices via SeatGeek integration
- **Interactive Maps:** Visualize your itinerary on an interactive map with route polylines
- **Photo Gallery:** Upload and manage photos from your ballpark visits
- **Progress Tracking:** Track which ballparks you've visited (all 30, AL-only, or NL-only)
- **Travel Modes:** Support for driving, air travel, or mixed transportation

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **UI Components:** shadcn/ui, Radix UI
- **Backend:** Next.js API Routes
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (game photos)
- **Authentication:** NextAuth.js v5
- **Maps:** MapLibre GL, NextBillion.ai
- **Drag & Drop:** @hello-pangea/dnd
- **External APIs:** SeatGeek (tickets), NextBillion.ai (routing)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- SeatGeek API credentials
- NextBillion.ai API key

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/take_me_out_to_all.git
   cd take_me_out_to_all
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**

   Create a [.env.local](.env.local) file in the root directory:

   ```bash
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   # NextAuth
   NEXTAUTH_SECRET=your-random-secret
   NEXTAUTH_URL=http://localhost:3000

   # Google OAuth (for SSO)
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret

   # External APIs
   SEATGEEK_CLIENT_ID=your-seatgeek-client-id
   SEATGEEK_CLIENT_SECRET=your-seatgeek-client-secret
   NEXT_PUBLIC_NBAI_API_KEY=your-nextbillion-api-key
   ```

4. **Set up Supabase database:**

   - Go to your Supabase project
   - Navigate to SQL Editor
   - Run the schema from [src/lib/schema.sql](src/lib/schema.sql)
   - Run migrations from [scripts/migrations/](scripts/migrations/) (if any)

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
│   ├── app/                    # Next.js App Router pages and API routes
│   │   ├── api/                # API endpoints
│   │   │   ├── auth/           # NextAuth configuration
│   │   │   ├── directions/     # Route planning API
│   │   │   ├── games/          # Game schedule API
│   │   │   ├── itineraries/    # Itinerary CRUD API
│   │   │   └── seatgeek/       # Ticket pricing API
│   │   ├── itinerary/          # Itinerary pages
│   │   └── contact/, privacy/, terms/  # Static pages
│   ├── components/             # React components
│   │   ├── game-detail-*.tsx   # Game detail views
│   │   ├── itinerary-map.tsx   # Interactive map
│   │   └── navbar.tsx          # Navigation
│   └── lib/
│       ├── auth.ts             # NextAuth configuration
│       ├── db.ts               # Supabase client
│       ├── schema.sql          # Database schema
│       └── teams-data.ts       # MLB team data
├── scripts/
│   ├── seed.ts                 # Database seeding script
│   ├── gcp-setup.sh            # GCP project setup
│   ├── create-secrets.sh       # Secret Manager setup
│   ├── build-and-push.sh       # Docker build and push
│   └── terraform-deploy.sh     # Terraform deployment
├── terraform/                  # Infrastructure as Code
│   ├── main.tf                 # Core Terraform config
│   ├── variables.tf            # Input variables
│   ├── outputs.tf              # Output values
│   └── modules/                # Terraform modules
├── public/                     # Static assets
├── Dockerfile                  # Docker container definition
├── cloudbuild.yaml             # Cloud Build CI/CD config
└── package.json                # Dependencies and scripts
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
| `npm run seed` | Seed database with teams and games |
| `npm run download-mlb-logos` | Download team logos |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/*` | * | NextAuth authentication |
| `/api/games` | GET | Get MLB games with filters |
| `/api/teams` | GET | Get all MLB teams |
| `/api/itineraries` | GET/POST | List or create itineraries |
| `/api/itineraries/[id]` | GET/PUT/DELETE | CRUD operations on itinerary |
| `/api/itineraries/[id]/games` | POST | Add game to itinerary |
| `/api/itineraries/[id]/games/[gameId]` | DELETE | Remove game from itinerary |
| `/api/itineraries/[id]/games/[gameId]/photos` | GET/POST/DELETE | Manage game photos |
| `/api/seatgeek` | GET | Get ticket prices |
| `/api/directions` | POST | Get route directions |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key | Yes |
| `NEXTAUTH_SECRET` | NextAuth secret key | Yes |
| `NEXTAUTH_URL` | Application base URL | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Yes |
| `SEATGEEK_CLIENT_ID` | SeatGeek API client ID | Yes |
| `SEATGEEK_CLIENT_SECRET` | SeatGeek API secret | Yes |
| `NEXT_PUBLIC_NBAI_API_KEY` | NextBillion.ai API key | Yes |

## Development

### Running Tests

```bash
# No tests configured yet
# TODO: Add Jest/Vitest tests
```

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
- [Vercel](https://vercel.com/) - Original deployment platform inspiration

## Support

For questions, issues, or feature requests, please open an issue on GitHub.

## Roadmap

- [ ] Add user authentication with OAuth providers
- [ ] Implement sharing of itineraries
- [ ] Add weather forecast integration
- [ ] Create mobile app (React Native)
- [ ] Add hotel recommendations near stadiums
- [ ] Implement budget tracking
- [ ] Add social features (follow friends' trips)
- [ ] Create printable itinerary PDFs

---

**Built with ❤️ for baseball fans everywhere**
