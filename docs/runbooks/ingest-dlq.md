# Runbook: ingest dead-letter queue

## When this applies

The alarm `cml-ingest-dlq-not-empty` fires. An upload failed processing three times and SQS moved it to the dead-letter queue (DLQ). The original file is still in the landing bucket and nothing has been lost.

Run the commands from `infra/ingest` with a valid AWS session. Add `--profile <name>` if you use named profiles.

## 1. Find the cause

~~~bash
aws logs tail "/aws/lambda/$(terraform output -raw worker_function_name)" --since 1h | grep '"level":"error"'
~~~

Each line names the SQS `messageId` and the error.

| Error | Likely cause |
|---|---|
| `NoSuchBucket` | `CONTENT_BUCKET` points to the wrong bucket |
| `AccessDenied` | The worker role is missing a permission |
| Task timed out | A slow dependency, or the timeout is too low |

## 2. Check for drift

~~~bash
terraform plan
~~~

If the plan shows changes that nobody committed, the stack was changed outside Terraform. Review them, then apply to restore the committed configuration.

## 3. Replay the failed messages

Only replay after the cause is fixed. Otherwise the messages fail three more times and return to the DLQ.

~~~bash
DLQ_ARN=$(aws sqs get-queue-attributes --queue-url "$(terraform output -raw dlq_url)" \
  --attribute-names QueueArn --query Attributes.QueueArn --output text)
aws sqs start-message-move-task --source-arn "$DLQ_ARN"
aws sqs list-message-move-tasks --source-arn "$DLQ_ARN" \
  --query 'Results[0].[Status,ApproximateNumberOfMessagesMoved]' --output text
~~~

## 4. Confirm recovery

- The DLQ holds 0 messages.
- The alarm returns to OK and sends a recovery email.
- The published content is reachable through the content API.

## Drill record: 2026-11-27

The worker was misconfigured on purpose to prove the safety nets work end to end.

| Time (ET) | Event |
|---|---|
| 10:27 | `CONTENT_BUCKET` changed outside Terraform to a bucket that does not exist; a valid page uploaded |
| 10:27–10:31 | Three failed attempts, each logged with the same `messageId` and `NoSuchBucket` |
| 10:31 | Message moved to the DLQ |
| 10:34 | Alarm fired and sent an email |
| 10:37 | `terraform plan` detected the drift as one change; apply restored the configuration |
| 10:39 | Redrive moved one message back; the page was published (HTTP 200) and the DLQ emptied |

Result: no data lost. The alarm fired three minutes after the message reached the DLQ.
