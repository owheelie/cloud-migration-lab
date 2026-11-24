# cloud-migration-lab

Migrating a legacy "on-prem" website backend to AWS, built entirely with Terraform.

## Stack
TypeScript/Node · AWS Lambda · API Gateway · SQS · S3 · IAM · Bedrock · Terraform · Jenkins · Ansible

## Security & cost principles
- No root user and no long-lived access keys: all access uses short-lived role credentials (`aws login`)
- Least-privilege IAM role per workload
- Encrypted, versioned Terraform state with locking
- Everything destroyable with one command; budget alerts on

## Roadmap
- [ ] Phase 1: Terraform foundation (remote state, guardrails)
- [ ] Phase 2: TypeScript content API
- [ ] Phase 3: S3 → SQS → Lambda ingest pipeline
- [ ] Phase 4: Legacy server (Ansible) → AWS migration
- [ ] Phase 5: Jenkins CI/CD
- [ ] Phase 6: Bedrock document tagging
- [ ] Phase 7: Docs, diagram, DNS cutover plan
