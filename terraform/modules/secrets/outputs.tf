output "secret_ids" {
  description = "Map of secret keys to their secret IDs"
  value = {
    for k, v in google_secret_manager_secret.secrets : k => v.id
  }
}

output "secret_names" {
  description = "Map of secret keys to their secret names"
  value = {
    for k, v in google_secret_manager_secret.secrets : k => v.secret_id
  }
}
