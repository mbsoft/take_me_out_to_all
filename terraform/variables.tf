variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1" # Free tier friendly
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "mlb-itinerary"
}

variable "environment" {
  description = "Environment (dev/staging/prod)"
  type        = string
  default     = "prod"
}

variable "container_image" {
  description = "Container image URL from Artifact Registry"
  type        = string
}

# Secrets (passed via tfvars or environment)
variable "supabase_url" {
  description = "Supabase URL"
  type        = string
  sensitive   = true
}

variable "supabase_service_role_key" {
  description = "Supabase Service Role Key"
  type        = string
  sensitive   = true
}

variable "nextauth_secret" {
  description = "NextAuth Secret (64+ chars)"
  type        = string
  sensitive   = true
}

variable "google_client_id" {
  description = "Google OAuth Client ID"
  type        = string
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth Client Secret"
  type        = string
  sensitive   = true
}

variable "seatgeek_client_id" {
  description = "SeatGeek Client ID"
  type        = string
  sensitive   = true
}

variable "seatgeek_client_secret" {
  description = "SeatGeek Client Secret"
  type        = string
  sensitive   = true
}

variable "nbai_api_key" {
  description = "NextBillion.ai API Key"
  type        = string
  sensitive   = true
}

variable "domain_name" {
  description = "Custom domain (optional)"
  type        = string
  default     = ""
}
