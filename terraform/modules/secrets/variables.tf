variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "project_number" {
  description = "GCP Project Number"
  type        = string
}

variable "secret_names" {
  description = "List of secret names to create"
  type        = set(string)
}

variable "secret_values" {
  description = "Map of secret names to secret values"
  type        = map(string)
  sensitive   = true
}
