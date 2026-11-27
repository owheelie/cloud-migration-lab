# cloud-migration-lab

Moving a legacy website backend off a single on-prem server and onto AWS serverless, one route at a time. All infrastructure is defined in Terraform.

The legacy server stays in front for the whole migration. Each route is re-pointed from the old backend to AWS at the existing nginx proxy, so every step can be reversed with a one-line change and users never see a different URL. DNS only moves once the old backend is serving nothing.

## Architecture

![Architecture diagram](docs/architecture.png)

Generated from [`docs/architecture.py`](docs/architecture.py) with the [diagrams](https://diagrams.mingrammer.com) library.

## Components

| Component | Services | Purpose |
|---|---|---|
| Legacy host | EC2, nginx, Ansible | Stands in for the on-prem server and acts as the routing layer during migration |
| Content API | API Gateway, Lambda (TypeScript), S3 | Serves headless CMS content |
| Ingest pipeline | S3, SQS, Lambda (TypeScript) | Validates uploaded files and routes them to the correct S3 prefix; failures land in a dead-letter queue |
| Document tagging | Amazon Bedrock | Adds tags and summaries to ingested documents |
| Delivery | Jenkins, Ansible, Terraform | Test, plan, manual approval, apply |
| State | S3 | Versioned, encrypted, TLS-only, native locking |

## Security

- No root user and no long-lived access keys. All access uses short-lived role credentials.
- One least-privilege IAM role per function.
- All buckets private, encrypted at rest, TLS-only.
- Account-specific values stay out of the repository (partial backend configuration).
- Secrets are blocked at three points: a gitleaks pre-commit hook, GitHub push protection, and a gitleaks scan in CI.
- Dependabot raises security fixes immediately and groups routine updates monthly.

## Cost

- Serverless by default. No NAT gateways or load balancers.
- EC2 hosts are short-lived and destroyed after each session.
- Single region.

## Content API

`GET /api/content/{slug}` returns a page stored at `content/{slug}.json` in the content bucket.

```bash
curl https://<api-id>.execute-api.us-east-2.amazonaws.com/api/content/about
```

| Status | When |
|---|---|
| 200 | Page found (cached for 60 seconds) |
| 400 | Slug is not lowercase words separated by hyphens |
| 404 | No page with that slug |
| 500 | Storage error; details are logged, never returned |

Run the tests and build locally:

```bash
cd services/content-api
npm ci
npm test
npm run build   # also loads the bundle to catch runtime errors before deploy
```

## Ingest pipeline

Upload a file to `incoming/` in the landing bucket. S3 sends an event to SQS, and the worker Lambda decides where the file goes:

| Upload | Destination |
|---|---|
| `.json` with a valid `slug` and `title` | `content/<slug>.json`, served immediately by the content API |
| `.png` `.jpg` `.jpeg` `.webp` `.gif` | `assets/images/` |
| `.pdf` | `assets/documents/` |
| Anything else, unsafe names, files over 10 MB | Rejected and logged; not retried |

```bash
aws s3 cp page.json s3://<landing-bucket>/incoming/page.json
```

**Failure handling.** Bad input is rejected because retrying will not fix it. Transient errors are retried three times; then the message moves to a dead-letter queue and a CloudWatch alarm sends an email. Partial batch responses mean only the failed message is retried, not the whole batch. Recovery steps, and the results of a live failure drill, are in [the DLQ runbook](docs/runbooks/ingest-dlq.md).

## Repository layout

| Path | Contents |
|---|---|
| `bootstrap/` | S3 bucket for Terraform state, applied once per account |
| `docs/` | Architecture diagram and the code that generates it |
| `infra/content-api/` | Terraform for the content API: private bucket, least-privilege IAM role, Lambda, HTTP API |
| `services/content-api/` | TypeScript Lambda handler, unit tests and build script |
| `infra/ingest/` | Terraform for the ingest pipeline: landing bucket, SQS queue and DLQ, worker Lambda, DLQ alarm |
| `services/ingest-worker/` | TypeScript worker that validates uploads and routes them to the content bucket |
| `docs/runbooks/` | Operational runbooks, including DLQ recovery |
| `.github/` | Secret-scanning workflow and Dependabot configuration |

## Status

- [x] Terraform state backend
- [x] Content API
- [x] Ingest pipeline
- [ ] Legacy host and route-by-route cutover
- [ ] Jenkins pipeline
- [ ] Document tagging
- [ ] DNS cutover plan
