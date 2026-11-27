resource "aws_sqs_queue" "ingest_dlq" {
  name                      = "${local.name}-dlq"
  message_retention_seconds = 1209600 # 14 days to investigate failures
  sqs_managed_sse_enabled   = true
}

resource "aws_sqs_queue" "ingest" {
  name                       = local.name
  visibility_timeout_seconds = 60     # at least 6x the worker's timeout
  message_retention_seconds  = 345600 # 4 days
  receive_wait_time_seconds  = 20     # long polling: fewer empty, billable receives
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.ingest_dlq.arn
    maxReceiveCount     = 3
  })
}

# Only the ingest queue may send failed messages to this DLQ.
resource "aws_sqs_queue_redrive_allow_policy" "ingest_dlq" {
  queue_url = aws_sqs_queue.ingest_dlq.id
  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.ingest.arn]
  })
}

data "aws_iam_policy_document" "ingest_queue" {
  statement {
    sid       = "AllowEventsFromLandingBucketOnly"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.ingest.arn]
    principals {
      type        = "Service"
      identifiers = ["s3.amazonaws.com"]
    }
    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_s3_bucket.landing.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_sqs_queue_policy" "ingest" {
  queue_url = aws_sqs_queue.ingest.id
  policy    = data.aws_iam_policy_document.ingest_queue.json
}

resource "aws_s3_bucket_notification" "landing" {
  bucket = aws_s3_bucket.landing.id

  queue {
    queue_arn     = aws_sqs_queue.ingest.arn
    events        = ["s3:ObjectCreated:*"]
    filter_prefix = "incoming/"
  }

  depends_on = [aws_sqs_queue_policy.ingest]
}
