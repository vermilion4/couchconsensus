# ADR-0012: AWS CDK (TypeScript) in us-east-1

- Status: Accepted
- Date: 2026-10-10

## Context

The AWS integration must be documented for the AWS Builder mini challenge, and the repo must include run instructions. Click-ops infrastructure is hard to document and to reproduce for judges.

## Decision

- **AWS CDK v2 in TypeScript** under `infra/`, one stack `CouchStack`:
  - DynamoDB table `couch-rooms` (on-demand, TTL attribute `ttl`, point-in-time recovery off).
  - ECR image built from `apps/server/Dockerfile` (includes the built phone page and catalog).
  - `ApplicationLoadBalancedFargateService` (1 task, 0.5 vCPU / 1 GB, ALB idle timeout 300 s, health check `/healthz`).
  - CloudFront distribution: origin = ALB; caching disabled for `/api/*` and `/ws`; cache static assets; forward `CloudFront-Viewer-Country`.
  - Task role: `dynamodb:GetItem/PutItem/UpdateItem` on the table, `bedrock:InvokeModel*` on the chosen model/profile.
  - CloudWatch log group, 7-day retention.
- **Region**: `us-east-1`.
- Secrets live in SSM Parameter Store, never in the image: the TMDB key (ingest script only) and the household-memory pepper `/couch/household-pepper` (ADR-0013, SecureString, read by the task role).
- One command deploy: `pnpm deploy` → `cdk deploy`.

## Consequences

- The architecture diagram in the submission maps 1:1 to the stack.
- `cdk destroy` after judging removes everything; the DynamoDB table has `RemovalPolicy.DESTROY`.
