output "landing_bucket" {
  description = "Upload files under incoming/ to start the pipeline"
  value       = aws_s3_bucket.landing.bucket
}

output "queue_url" {
  value = aws_sqs_queue.ingest.url
}

output "dlq_url" {
  value = aws_sqs_queue.ingest_dlq.url
}
