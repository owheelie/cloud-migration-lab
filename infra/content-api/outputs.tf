output "content_url" {
  description = "Base URL for content requests, e.g. <content_url>/about-us"
  value       = "${trimsuffix(aws_apigatewayv2_stage.default.invoke_url, "/")}/api/content"
}

output "content_bucket" {
  description = "Bucket that holds published content under content/"
  value       = aws_s3_bucket.content.bucket
}

output "function_name" {
  value = aws_lambda_function.content_api.function_name
}
