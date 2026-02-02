resource "google_secret_manager_secret" "secrets" {
  for_each = var.secret_names

  secret_id = replace(each.value, "_", "-")

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "secret_versions" {
  for_each = var.secret_names

  secret      = google_secret_manager_secret.secrets[each.value].id
  secret_data = var.secret_values[each.value]
}

# Grant Cloud Run service account access to secrets
resource "google_secret_manager_secret_iam_member" "cloud_run_access" {
  for_each = var.secret_names

  secret_id = google_secret_manager_secret.secrets[each.value].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.project_number}-compute@developer.gserviceaccount.com"
}
