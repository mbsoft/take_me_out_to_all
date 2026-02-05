# Import existing artifact registry
import {
  to = module.artifact_registry.google_artifact_registry_repository.docker_repo
  id = "projects/takemeout-486217/locations/us-central1/repositories/mlb-itinerary-images"
}

# Import existing secrets
import {
  to = module.secrets.google_secret_manager_secret.secrets["supabase_url"]
  id = "projects/takemeout-486217/secrets/supabase-url"
}

import {
  to = module.secrets.google_secret_manager_secret.secrets["supabase_service_role_key"]
  id = "projects/takemeout-486217/secrets/supabase-service-role-key"
}

import {
  to = module.secrets.google_secret_manager_secret.secrets["nextauth_secret"]
  id = "projects/takemeout-486217/secrets/nextauth-secret"
}

import {
  to = module.secrets.google_secret_manager_secret.secrets["google_client_id"]
  id = "projects/takemeout-486217/secrets/google-client-id"
}

import {
  to = module.secrets.google_secret_manager_secret.secrets["google_client_secret"]
  id = "projects/takemeout-486217/secrets/google-client-secret"
}

import {
  to = module.secrets.google_secret_manager_secret.secrets["seatgeek_client_id"]
  id = "projects/takemeout-486217/secrets/seatgeek-client-id"
}

import {
  to = module.secrets.google_secret_manager_secret.secrets["seatgeek_client_secret"]
  id = "projects/takemeout-486217/secrets/seatgeek-client-secret"
}

import {
  to = module.secrets.google_secret_manager_secret.secrets["nbai_api_key"]
  id = "projects/takemeout-486217/secrets/nbai-api-key"
}

import {
  to = module.secrets.google_secret_manager_secret.secrets["resend_api_key"]
  id = "projects/takemeout-486217/secrets/resend-api-key"
}

# Get current project data
data "google_project" "current" {
  project_id = var.project_id
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudbuild.googleapis.com",
  ])

  service            = each.key
  disable_on_destroy = false
}

# Artifact Registry for container images
module "artifact_registry" {
  source = "./modules/artifact_registry"

  project_id      = var.project_id
  region          = var.region
  repository_name = "${var.app_name}-images"

  depends_on = [google_project_service.required_apis]
}

# Secret Manager for environment variables
module "secrets" {
  source = "./modules/secrets"

  project_id     = var.project_id
  project_number = data.google_project.current.number
  secret_names = toset([
    "supabase_url",
    "supabase_service_role_key",
    "nextauth_secret",
    "google_client_id",
    "google_client_secret",
    "seatgeek_client_id",
    "seatgeek_client_secret",
    "nbai_api_key",
    "resend_api_key",
  ])
  secret_values = {
    supabase_url              = var.supabase_url
    supabase_service_role_key = var.supabase_service_role_key
    nextauth_secret           = var.nextauth_secret
    google_client_id          = var.google_client_id
    google_client_secret      = var.google_client_secret
    seatgeek_client_id        = var.seatgeek_client_id
    seatgeek_client_secret    = var.seatgeek_client_secret
    nbai_api_key              = var.nbai_api_key
    resend_api_key            = var.resend_api_key
  }

  depends_on = [google_project_service.required_apis]
}

# Cloud Run service
module "cloud_run" {
  source = "./modules/cloud_run"

  project_id      = var.project_id
  region          = var.region
  service_name    = "${var.app_name}-${var.environment}"
  container_image = var.container_image

  env_vars = {
    NODE_ENV                = "production"
    NEXT_TELEMETRY_DISABLED = "1"
    AUTH_TRUST_HOST         = "true"
    NEXT_PUBLIC_APP_URL     = "https://takemeout.mbsoft.com"
    EMAIL_FROM              = "noreply@mbsoft.com"
  }

  secret_env_vars = {
    NEXT_PUBLIC_SUPABASE_URL  = module.secrets.secret_ids["supabase_url"]
    SUPABASE_SERVICE_ROLE_KEY = module.secrets.secret_ids["supabase_service_role_key"]
    NEXTAUTH_SECRET           = module.secrets.secret_ids["nextauth_secret"]
    GOOGLE_CLIENT_ID          = module.secrets.secret_ids["google_client_id"]
    GOOGLE_CLIENT_SECRET      = module.secrets.secret_ids["google_client_secret"]
    SEATGEEK_CLIENT_ID        = module.secrets.secret_ids["seatgeek_client_id"]
    SEATGEEK_CLIENT_SECRET    = module.secrets.secret_ids["seatgeek_client_secret"]
    NBAI_API_KEY              = module.secrets.secret_ids["nbai_api_key"]
    RESEND_API_KEY            = module.secrets.secret_ids["resend_api_key"]
  }

  # Cloud Run config optimized for free tier
  min_instances = 0 # Scale to zero
  max_instances = 10
  cpu           = "1"
  memory        = "512Mi"
  timeout       = 300

  # Public access (adjust for your needs)
  allow_unauthenticated = true

  # NextAuth URL - set to the Cloud Run service URL
  nextauth_url = "https://takemeout.mbsoft.com"

  depends_on = [
    module.artifact_registry,
    module.secrets,
  ]
}

# Custom domain mapping (optional)
resource "google_cloud_run_domain_mapping" "custom_domain" {
  count = var.domain_name != "" ? 1 : 0

  location = var.region
  name     = var.domain_name

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = module.cloud_run.service_name
  }
}
