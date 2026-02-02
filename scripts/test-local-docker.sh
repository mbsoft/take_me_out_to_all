#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Testing Docker Image Locally ===${NC}"

# Source .env.local
if [ ! -f .env.local ]; then
  echo "Error: .env.local not found"
  exit 1
fi

set -a
source .env.local
set +a

# Build image
echo -e "${YELLOW}Building Docker image...${NC}"
docker build -t mlb-itinerary-test .

# Run container
echo -e "${YELLOW}Starting container on port 3000...${NC}"
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  -e SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  -e NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  -e SEATGEEK_CLIENT_ID="$SEATGEEK_CLIENT_ID" \
  -e SEATGEEK_CLIENT_SECRET="$SEATGEEK_CLIENT_SECRET" \
  -e NEXT_PUBLIC_NBAI_API_KEY="$NEXT_PUBLIC_NBAI_API_KEY" \
  -e NODE_ENV="production" \
  mlb-itinerary-test

echo -e "${GREEN}Container stopped.${NC}"
