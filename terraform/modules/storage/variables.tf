# Variables for the storage module

variable "environment_name" {
  description = "Name of the environment"
  type        = string
}

variable "enable_versioning" {
  description = "Whether to enable S3 bucket versioning"
  type        = bool
  default     = false
}

variable "enable_public_read" {
  description = "Whether to allow public read access to the assets bucket"
  type        = bool
  default     = false
}

variable "enable_lifecycle_rules" {
  description = "Whether to enable S3 lifecycle rules for cost optimization"
  type        = bool
  default     = true
}

variable "object_expiration_days" {
  description = "Number of days after which objects will be deleted"
  type        = number
  default     = 30
}

variable "enable_cloudfront" {
  description = "Whether to create a CloudFront distribution for static assets"
  type        = bool
  default     = false
}

variable "enable_notifications" {
  description = "Whether to enable S3 bucket notifications"
  type        = bool
  default     = false
}

variable "notification_topic_arn" {
  description = "ARN of the SNS topic for S3 notifications"
  type        = string
  default     = null
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}