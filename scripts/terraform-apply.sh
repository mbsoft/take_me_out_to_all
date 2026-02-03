#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Applying Terraform Changes ===${NC}"

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

# Get container image URL
CONTAINER_IMAGE=${CONTAINER_IMAGE:-"us-central1-docker.pkg.dev/takemeout-486217/mlb-itinerary-images/mlb-itinerary:latest"}
PROJECT_ID=${PROJECT_ID:-"takemeout-486217"}

cd terraform

echo -e "${YELLOW}Running terraform plan...${NC}"
terraform plan \
  -var="project_id=$PROJECT_ID" \
  -var="container_image=$CONTAINER_IMAGE" \
  -var="supabase_url=$NEXT_PUBLIC_SUPABASE_URL" \
  -var="supabase_service_role_key=$SUPABASE_SERVICE_ROLE_KEY" \
  -var="nextauth_secret=$NEXTAUTH_SECRET" \
  -var="google_client_id=$GOOGLE_CLIENT_ID" \
  -var="google_client_secret=$GOOGLE_CLIENT_SECRET" \
  -var="seatgeek_client_id=$SEATGEEK_CLIENT_ID" \
  -var="seatgeek_client_secret=$SEATGEEK_CLIENT_SECRET" \
  -var="nbai_api_key=$NEXT_PUBLIC_NBAI_API_KEY"

echo -e "${YELLOW}Do you want to apply these changes? (yes/no)${NC}"
read -r response

if [ "$response" = "yes" ]; then
  terraform apply \
    -var="project_id=$PROJECT_ID" \
    -var="container_image=$CONTAINER_IMAGE" \
    -var="supabase_url=$NEXT_PUBLIC_SUPABASE_URL" \
    -var="supabase_service_role_key=$SUPABASE_SERVICE_ROLE_KEY" \
    -var="nextauth_secret=$NEXTAUTH_SECRET" \
    -var="google_client_id=$GOOGLE_CLIENT_ID" \
    -var="google_client_secret=$GOOGLE_CLIENT_SECRET" \
    -var="seatgeek_client_id=$SEATGEEK_CLIENT_ID" \
    -var="seatgeek_client_secret=$SEATGEEK_CLIENT_SECRET" \
    -var="nbai_api_key=$NEXT_PUBLIC_NBAI_API_KEY"

  echo -e "${GREEN}Terraform apply completed!${NC}"
else
  echo "Apply cancelled"
  exit 1
fi

cd ..
