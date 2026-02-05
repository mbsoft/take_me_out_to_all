#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Creating GCP Secrets ===${NC}"

# Check for .env.local
if [ ! -f .env.local ]; then
  echo "Error: .env.local not found"
  echo "Create .env.local with your secrets first"
  exit 1
fi

# Source environment variables
set -a
source .env.local
set +a

# Create secrets
echo -e "${YELLOW}Creating secrets in Secret Manager...${NC}"

create_secret() {
  local name=$1
  local value=$2

  if [ -z "$value" ]; then
    echo "Warning: $name is empty, skipping..."
    return
  fi

  # Delete existing secret if it exists
  gcloud secrets delete $name --quiet 2>/dev/null || true

  # Create new secret
  echo -n "$value" | gcloud secrets create $name \
    --data-file=- \
    --replication-policy="automatic"

  echo "✓ Created secret: $name"
}

create_secret "supabase-url" "$NEXT_PUBLIC_SUPABASE_URL"
create_secret "supabase-service-role-key" "$SUPABASE_SERVICE_ROLE_KEY"
create_secret "nextauth-secret" "$NEXTAUTH_SECRET"
create_secret "google-client-id" "$GOOGLE_CLIENT_ID"
create_secret "google-client-secret" "$GOOGLE_CLIENT_SECRET"
create_secret "seatgeek-client-id" "$SEATGEEK_CLIENT_ID"
create_secret "seatgeek-client-secret" "$SEATGEEK_CLIENT_SECRET"
create_secret "nbai-api-key" "$NEXT_PUBLIC_NBAI_API_KEY"
create_secret "resend-api-key" "$RESEND_API_KEY"

echo -e "${GREEN}All secrets created successfully!${NC}"
