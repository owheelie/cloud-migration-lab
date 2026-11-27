resource "aws_s3_bucket" "landing" {
  bucket = "cml-landing-${local.suffix}"

  # Uploads are transient; lets `terraform destroy` remove the bucket with its objects.
  force_destroy = true
}

resource "aws_s3_bucket_ownership_controls" "landing" {
  bucket = aws_s3_bucket.landing.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "landing" {
  bucket                  = aws_s3_bucket.landing.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "landing" {
  bucket = aws_s3_bucket.landing.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Uploads are copied to the content bucket once processed, so the originals expire after a week.
resource "aws_s3_bucket_lifecycle_configuration" "landing" {
  bucket = aws_s3_bucket.landing.id

  rule {
    id     = "expire-uploads"
    status = "Enabled"
    filter {}

    expiration {
      days = 7
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

data "aws_iam_policy_document" "landing_bucket" {
  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.landing.arn, "${aws_s3_bucket.landing.arn}/*"]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "landing" {
  bucket     = aws_s3_bucket.landing.id
  policy     = data.aws_iam_policy_document.landing_bucket.json
  depends_on = [aws_s3_bucket_public_access_block.landing]
}
