#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== GCP Project Setup for MLB Itinerary ===${NC}"

# Check prerequisites
command -v gcloud >/dev/null 2>&1 || { echo "Error: gcloud CLI not installed"; exit 1; }
command -v terraform >/dev/null 2>&1 || { echo "Error: terraform not installed"; exit 1; }

# Prompt for project ID
read -p "Enter GCP Project ID: " PROJECT_ID
read -p "Enter region (default: us-central1): " REGION
REGION=${REGION:-us-central1}

# Set gcloud project
gcloud config set project $PROJECT_ID

echo -e "${YELLOW}Step 1: Enabling required GCP APIs...${NC}"
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  compute.googleapis.com

echo -e "${YELLOW}Step 2: Creating Artifact Registry repository...${NC}"
gcloud artifacts repositories create mlb-itinerary-images \
  --repository-format=docker \
  --location=$REGION \
  --description="Docker images for MLB Itinerary app" \
  || echo "Repository already exists, continuing..."

echo -e "${YELLOW}Step 3: Configure Docker authentication...${NC}"
gcloud auth configure-docker ${REGION}-docker.pkg.dev

echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Create secrets: ./scripts/create-secrets.sh"
echo "2. Build and push Docker image: ./scripts/build-and-push.sh"
echo "3. Deploy with Terraform: cd terraform && terraform apply"
