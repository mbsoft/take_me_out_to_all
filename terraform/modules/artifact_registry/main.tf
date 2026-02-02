resource "google_artifact_registry_repository" "docker_repo" {
  location      = var.region
  repository_id = var.repository_name
  format        = "DOCKER"
  description   = "Docker repository for ${var.repository_name}"

  # Cleanup policy to stay within free tier (0.5GB)
  cleanup_policy_dry_run = false
  cleanup_policies {
    id     = "keep-minimum-versions"
    action = "KEEP"
    most_recent_versions {
      keep_count = 5
    }
  }
}
