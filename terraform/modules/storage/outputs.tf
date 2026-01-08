# Outputs for the storage module

output "assets_bucket_name" {
  description = "Name of the assets S3 bucket"
  value       = aws_s3_bucket.app_assets.id
}

output "assets_bucket_arn" {
  description = "ARN of the assets S3 bucket"
  value       = aws_s3_bucket.app_assets.arn
}

output "assets_bucket_domain_name" {
  description = "Domain name of the assets S3 bucket"
  value       = aws_s3_bucket.app_assets.bucket_domain_name
}

output "assets_bucket_regional_domain_name" {
  description = "Regional domain name of the assets S3 bucket"
  value       = aws_s3_bucket.app_assets.bucket_regional_domain_name
}

output "data_bucket_name" {
  description = "Name of the data S3 bucket"
  value       = aws_s3_bucket.app_data.id
}

output "data_bucket_arn" {
  description = "ARN of the data S3 bucket"
  value       = aws_s3_bucket.app_data.arn
}

output "data_bucket_domain_name" {
  description = "Domain name of the data S3 bucket"
  value       = aws_s3_bucket.app_data.bucket_domain_name
}

output "data_bucket_regional_domain_name" {
  description = "Regional domain name of the data S3 bucket"
  value       = aws_s3_bucket.app_data.bucket_regional_domain_name
}

output "s3_access_policy_arn" {
  description = "ARN of the IAM policy for S3 access"
  value       = aws_iam_policy.s3_access.arn
}

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.assets[0].id : null
}

output "cloudfront_distribution_arn" {
  description = "ARN of the CloudFront distribution"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.assets[0].arn : null
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.assets[0].domain_name : null
}

output "cloudfront_hosted_zone_id" {
  description = "Hosted zone ID of the CloudFront distribution"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.assets[0].hosted_zone_id : null
}

output "assets_url" {
  description = "URL to access static assets"
  value       = var.enable_cloudfront ? "https://${aws_cloudfront_distribution.assets[0].domain_name}" : "https://${aws_s3_bucket.app_assets.bucket_regional_domain_name}"
}