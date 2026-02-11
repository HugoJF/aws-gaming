output "lambda_function_name" {
  description = "API Lambda function name"
  value       = aws_lambda_function.api.function_name
}

output "lambda_function_arn" {
  description = "API Lambda function ARN"
  value       = aws_lambda_function.api.arn
}

output "lambda_function_url" {
  description = "API Lambda Function URL endpoint"
  value       = aws_lambda_function_url.api.function_url
}

output "lambda_role_arn" {
  description = "IAM role ARN used by API Lambda"
  value       = aws_iam_role.lambda.arn
}

output "dynamodb_table_name" {
  description = "DynamoDB table name used by the API"
  value       = aws_dynamodb_table.api.name
}

output "dynamodb_table_arn" {
  description = "DynamoDB table ARN used by the API"
  value       = aws_dynamodb_table.api.arn
}
