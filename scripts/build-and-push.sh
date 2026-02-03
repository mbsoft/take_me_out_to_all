#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Building and Pushing Docker Image ===${NC}"

# Load environment variables from .env.local if it exists
if [ -f .env.local ]; then
  echo -e "${YELLOW}Loading environment variables from .env.local${NC}"
  export $(grep -v '^#' .env.local | xargs)
fi

# Verify required NEXT_PUBLIC_* variables are set
# Note: NBAI_API_KEY is NOT needed at build time - it's proxied server-side at runtime
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo -e "${RED}Error: NEXT_PUBLIC_SUPABASE_URL is not set${NC}"
  echo "Please set it in .env.local or as an environment variable"
  exit 1
fi

# Get project ID from gcloud
PROJECT_ID=$(gcloud config get-value project)
REGION=${REGION:-us-central1}
REPO_NAME="mlb-itinerary-images"
IMAGE_NAME="mlb-itinerary"
TAG=${1:-latest}

FULL_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:${TAG}"

echo -e "${YELLOW}Building image: ${FULL_IMAGE}${NC}"

# Build with BuildKit for better caching
# Pass NEXT_PUBLIC_* variables as build arguments (required at build time for Next.js)
# Note: NBAI_API_KEY is NOT passed - it's a runtime secret used by the server-side proxy
DOCKER_BUILDKIT=1 docker build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  -t $FULL_IMAGE \
  --cache-from=${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:latest \
  .

echo -e "${YELLOW}Pushing image to Artifact Registry...${NC}"
docker push $FULL_IMAGE

# Also tag as latest
if [ "$TAG" != "latest" ]; then
  LATEST_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:latest"
  docker tag $FULL_IMAGE $LATEST_IMAGE
  docker push $LATEST_IMAGE
fi

echo -e "${GREEN}Image pushed successfully!${NC}"
echo "Image URL: $FULL_IMAGE"
