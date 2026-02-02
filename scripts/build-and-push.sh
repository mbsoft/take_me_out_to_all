#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Building and Pushing Docker Image ===${NC}"

# Get project ID from gcloud
PROJECT_ID=$(gcloud config get-value project)
REGION=${REGION:-us-central1}
REPO_NAME="mlb-itinerary-images"
IMAGE_NAME="mlb-itinerary-prod"
TAG=${1:-latest}

FULL_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:${TAG}"

echo -e "${YELLOW}Building image: ${FULL_IMAGE}${NC}"

# Build with BuildKit for better caching
DOCKER_BUILDKIT=1 docker build \
  --platform linux/amd64 \
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
