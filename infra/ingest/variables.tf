variable "alert_email" {
  description = "Email for DLQ alerts. Set via TF_VAR_alert_email so it never lands in git."
  type        = string
  default     = null
}
