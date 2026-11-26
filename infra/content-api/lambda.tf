data "archive_file" "content_api" {
  type        = "zip"
  source_file = "${path.module}/../../services/content-api/dist/index.mjs"
  output_path = "${path.module}/.build/content-api.zip"
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.name}"
  retention_in_days = 7
}

resource "aws_lambda_function" "content_api" {
  function_name    = local.name
  role             = aws_iam_role.lambda.arn
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  handler          = "index.handler"
  filename         = data.archive_file.content_api.output_path
  source_code_hash = data.archive_file.content_api.output_base64sha256
  memory_size      = 256
  timeout          = 5

  environment {
    variables = {
      CONTENT_BUCKET = aws_s3_bucket.content.bucket
    }
  }

  depends_on = [aws_cloudwatch_log_group.lambda, aws_iam_role_policy.lambda]
}
