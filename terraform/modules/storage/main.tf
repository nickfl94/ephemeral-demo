# Storage module for ephemeral environments
# Creates S3 buckets and policies for application data and static assets

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }
}

# Random suffix for bucket names to ensure uniqueness
resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}

# S3 bucket for application assets
resource "aws_s3_bucket" "app_assets" {
  bucket = "${var.environment_name}-assets-${random_string.bucket_suffix.result}"

  tags = merge(var.tags, {
    Name = "${var.environment_name}-assets"
    Type = "s3-bucket"
    Purpose = "application-assets"
  })
}

# S3 bucket versioning
resource "aws_s3_bucket_versioning" "app_assets" {
  bucket = aws_s3_bucket.app_assets.id
  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Suspended"
  }
}

# S3 bucket server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "app_assets" {
  bucket = aws_s3_bucket.app_assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# S3 bucket public access block
resource "aws_s3_bucket_public_access_block" "app_assets" {
  bucket = aws_s3_bucket.app_assets.id

  block_public_acls       = !var.enable_public_read
  block_public_policy     = !var.enable_public_read
  ignore_public_acls      = !var.enable_public_read
  restrict_public_buckets = !var.enable_public_read
}

# S3 bucket policy for public read access (if enabled)
resource "aws_s3_bucket_policy" "app_assets_public" {
  count  = var.enable_public_read ? 1 : 0
  bucket = aws_s3_bucket.app_assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.app_assets.arn}/*"
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.app_assets]
}

# S3 bucket for application data/uploads
resource "aws_s3_bucket" "app_data" {
  bucket = "${var.environment_name}-data-${random_string.bucket_suffix.result}"

  tags = merge(var.tags, {
    Name = "${var.environment_name}-data"
    Type = "s3-bucket"
    Purpose = "application-data"
  })
}

# S3 bucket versioning for data bucket
resource "aws_s3_bucket_versioning" "app_data" {
  bucket = aws_s3_bucket.app_data.id
  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Suspended"
  }
}

# S3 bucket server-side encryption for data bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "app_data" {
  bucket = aws_s3_bucket.app_data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# S3 bucket public access block for data bucket (always private)
resource "aws_s3_bucket_public_access_block" "app_data" {
  bucket = aws_s3_bucket.app_data.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 bucket lifecycle configuration for cost optimization
resource "aws_s3_bucket_lifecycle_configuration" "app_assets" {
  count  = var.enable_lifecycle_rules ? 1 : 0
  bucket = aws_s3_bucket.app_assets.id

  rule {
    id     = "ephemeral_lifecycle"
    status = "Enabled"

    # Delete objects after the environment lifetime
    expiration {
      days = var.object_expiration_days
    }

    # Clean up incomplete multipart uploads
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }

    # Transition to IA storage class for cost savings
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
  }
}

# S3 bucket lifecycle configuration for data bucket
resource "aws_s3_bucket_lifecycle_configuration" "app_data" {
  count  = var.enable_lifecycle_rules ? 1 : 0
  bucket = aws_s3_bucket.app_data.id

  rule {
    id     = "ephemeral_data_lifecycle"
    status = "Enabled"

    # Delete objects after the environment lifetime
    expiration {
      days = var.object_expiration_days
    }

    # Clean up incomplete multipart uploads
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

# S3 bucket notification configuration (optional)
resource "aws_s3_bucket_notification" "app_data_notification" {
  count  = var.enable_notifications ? 1 : 0
  bucket = aws_s3_bucket.app_data.id

  # Example: SNS notification for object creation
  topic {
    topic_arn = var.notification_topic_arn
    events    = ["s3:ObjectCreated:*"]
  }
}

# IAM policy document for S3 access
data "aws_iam_policy_document" "s3_access" {
  # Allow read/write access to assets bucket
  statement {
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket"
    ]
    resources = [
      aws_s3_bucket.app_assets.arn,
      "${aws_s3_bucket.app_assets.arn}/*"
    ]
  }

  # Allow read/write access to data bucket
  statement {
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket"
    ]
    resources = [
      aws_s3_bucket.app_data.arn,
      "${aws_s3_bucket.app_data.arn}/*"
    ]
  }
}

# IAM policy for S3 access
resource "aws_iam_policy" "s3_access" {
  name_prefix = "${var.environment_name}-s3-access-"
  description = "Policy for S3 access in ${var.environment_name}"
  policy      = data.aws_iam_policy_document.s3_access.json

  tags = merge(var.tags, {
    Name = "${var.environment_name}-s3-policy"
    Type = "iam-policy"
  })
}

# CloudFront distribution for static assets (optional)
resource "aws_cloudfront_distribution" "assets" {
  count = var.enable_cloudfront ? 1 : 0

  origin {
    domain_name = aws_s3_bucket.app_assets.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.app_assets.id}"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.assets[0].cloudfront_access_identity_path
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.app_assets.id}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = merge(var.tags, {
    Name = "${var.environment_name}-cloudfront"
    Type = "cloudfront-distribution"
  })
}

# CloudFront Origin Access Identity
resource "aws_cloudfront_origin_access_identity" "assets" {
  count   = var.enable_cloudfront ? 1 : 0
  comment = "OAI for ${var.environment_name} assets"
}

# S3 bucket policy for CloudFront access
resource "aws_s3_bucket_policy" "cloudfront_access" {
  count  = var.enable_cloudfront ? 1 : 0
  bucket = aws_s3_bucket.app_assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.assets[0].iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.app_assets.arn}/*"
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.app_assets]
}