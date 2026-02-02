#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd terraform

echo -e "${GREEN}=== Terraform Deployment ===${NC}"

# Get project info
PROJECT_ID=$(gcloud config get-value project)
REGION=${REGION:-us-central1}

# Get image URL
IMAGE_URL="${REGION}-docker.pkg.dev/${PROJECT_ID}/mlb-itinerary-images/mlb-itinerary-prod:latest"

echo -e "${YELLOW}Initializing Terraform...${NC}"
terraform init

echo -e "${YELLOW}Planning deployment...${NC}"
terraform plan \
  -var="project_id=$PROJECT_ID" \
  -var="region=$REGION" \
  -var="container_image=$IMAGE_URL" \
  -out=tfplan

read -p "Apply this plan? (yes/no): " CONFIRM

if [ "$CONFIRM" = "yes" ]; then
  echo -e "${YELLOW}Applying Terraform configuration...${NC}"
  terraform apply tfplan

  echo -e "${GREEN}Deployment complete!${NC}"
  terraform output
else
  echo "Deployment cancelled"
  rm -f tfplan
fi
