terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Optional: Use GCS backend for state management (free tier: 5GB)
  # Uncomment and configure after initial setup
  # backend "gcs" {
  #   bucket = "your-project-terraform-state"
  #   prefix = "terraform/state"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
