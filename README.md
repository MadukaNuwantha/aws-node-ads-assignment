# Ads API

A serverless REST API for managing ad listings, built with **TypeScript**, **AWS Lambda**, **API Gateway**, **DynamoDB**, **S3**, **SNS**, and **Cognito**. Deployed and managed with AWS SAM, with a full CI/CD pipeline via GitHub Actions.

---

## Table of Contents

- [Architecture](#architecture)
- [Technologies](#technologies)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Running Locally](#running-locally)
- [Testing](#testing)
- [Deployment](#deployment)
- [API Reference](#api-reference)
- [CI/CD Pipeline](#cicd-pipeline)
- [AWS Resources](#aws-resources)
- [Known Issues & Limitations](#known-issues--limitations)

---

## Architecture

```
Client
  │
  ├── POST /auth/signup  ──► Lambda (signup)   ──► Cognito (register user)
  ├── POST /auth/login   ──► Lambda (login)    ──► Cognito (authenticate, return tokens)
  │
  │   [JWT required for all /ads endpoints]
  │
  ├── POST /ads          ──► Lambda (createAd) ──► DynamoDB (persist ad)
  │                                            ──► S3 (store image, if provided)
  │                                            ──► SNS (notify subscribers)
  │
  └── GET  /ads          ──► Lambda (getAllAds) ──► DynamoDB (scan all ads)
```

All endpoints are served through an **AWS API Gateway HTTP API**. The `/ads` endpoints are protected by a **Cognito JWT authorizer** — requests must include a valid `idToken` in the `Authorization` header.

---

## Technologies

| Layer | Technology |
|---|---|
| Runtime | Node.js 22, TypeScript 5 |
| Infrastructure | AWS SAM (CloudFormation) |
| API Gateway | AWS HTTP API (API Gateway v2) |
| Compute | AWS Lambda |
| Database | AWS DynamoDB |
| File Storage | AWS S3 |
| Messaging | AWS SNS |
| Authentication | AWS Cognito (User Pool + JWT) |
| Testing | Jest 29, ts-jest |
| CI/CD | GitHub Actions |

---

## Prerequisites

- **Node.js 22+** — [Download](https://nodejs.org)
- **AWS CLI** configured with appropriate permissions
  ```bash
  aws configure
  ```
- **AWS SAM CLI**
  ```bash
  brew install aws-sam-cli   # macOS
  ```
- **An AWS account** with the pre-existing resources listed in [AWS Resources](#aws-resources)

---

## Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd ads-api
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

The following environment variables are injected automatically by SAM during deployment. For local development or testing, they are set directly in test files via `process.env`.

| Variable | Description |
|---|---|
| `TABLE_NAME` | DynamoDB table name |
| `BUCKET_NAME` | S3 bucket name |
| `SNS_TOPIC_ARN` | SNS topic ARN |
| `REGION` | AWS region |
| `COGNITO_APP_CLIENT_ID` | Cognito App Client ID |
| `COGNITO_CLIENT_SECRET` | Cognito App Client secret |

### 4. Enable Cognito USER_PASSWORD_AUTH

In the AWS Console, navigate to your Cognito User Pool App Client (`6du49t555mi37vrd9i63nbecn6`) and enable **ALLOW_USER_PASSWORD_AUTH** under Authentication flows. This is required for the login endpoint to function.

---

## Running Locally

There is no local Lambda emulation configured. All development is done via TypeScript type-checking and unit tests.

```bash
# Type check (no emit)
npm run lint

# Build TypeScript to dist/
npm run build
```

---

## Testing

Tests are written with **Jest** and **ts-jest**. All AWS SDK calls are mocked — no real AWS resources are needed to run tests.

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage
```

**Current test coverage:** 78 tests across 8 test suites — all passing.

| Test Suite | Coverage |
|---|---|
| `createAd` handler | Happy path, validation, error handling |
| `getAllAds` handler | Happy path, empty result, error handling |
| `signup` handler | Happy path, validation, Cognito errors |
| `login` handler | Happy path, validation, Cognito errors |
| `dynamoService` | Save, scan, error propagation |
| `s3Service` | Upload, error propagation |
| `snsService` | Publish, error propagation |
| `cognitoService` | Signup, login, error mapping |

---

## Deployment

### 1. Get the SNS Topic ARN

```bash
aws sns list-topics --region ap-southeast-1
```

Copy the ARN for `ads-api-ad-created`.

### 2. Build and deploy

```bash
npm run build
sam build
sam deploy --guided
```

During `sam deploy --guided`, provide:

| Parameter | Value |
|---|---|
| Stack name | `ads-api` |
| Region | `ap-southeast-1` |
| `SnsTopicArn` | ARN from step 1 |
| All other parameters | Defaults are pre-filled |

### 3. Note the API URL

After deployment, the API base URL is printed as a stack output:

```
AdsApiUrl: https://<api-id>.execute-api.ap-southeast-1.amazonaws.com
```

---

## API Reference

### Authentication

#### POST /auth/signup

Registers a new user. No authentication required.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "Password123!"
}
```

**Response `201`:**
```json
{
  "message": "User registered successfully"
}
```

---

#### POST /auth/login

Authenticates a user and returns JWT tokens. No authentication required.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "Password123!"
}
```

**Response `200`:**
```json
{
  "idToken": "eyJ...",
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

> Use the `idToken` as the `Bearer` token for all `/ads` requests.

---

### Ads

> All `/ads` endpoints require `Authorization: Bearer <idToken>` header.

#### POST /ads — Create an ad

**Request:**
```json
{
  "title": "My Ad",
  "price": 49.99,
  "imageBase64": "<base64-encoded-image (optional)>"
}
```

**Response `201`:**
```json
{
  "message": "Ad created successfully",
  "ad": {
    "adId": "uuid",
    "title": "My Ad",
    "price": 49.99,
    "imageUrl": "https://... (if image provided)",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

**Response `400`:**
```json
{ "message": "title is required and must be a non-empty string" }
```

---

#### GET /ads — Retrieve all ads

No request body required.

**Response `200`:**
```json
{
  "ads": [
    {
      "adId": "uuid",
      "title": "My Ad",
      "price": 49.99,
      "imageUrl": "https://... (optional)",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### Example curl flow

```bash
# 1. Sign up
curl -X POST https://<API_URL>/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "Password123!"}'

# 2. Login and capture idToken
TOKEN=$(curl -s -X POST https://<API_URL>/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "Password123!"}' \
  | jq -r '.idToken')

# 3. Create an ad
curl -X POST https://<API_URL>/ads \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "My Ad", "price": 49.99}'

# 4. Get all ads
curl -X GET https://<API_URL>/ads \
  -H "Authorization: Bearer $TOKEN"
```

---

## CI/CD Pipeline

The **Ads API Pipeline** GitHub Actions workflow (`.github/workflows/ads-api-pipeline.yml`) runs automatically on every push and pull request to `main`, and can also be triggered manually from the GitHub Actions tab.

### Jobs

| Job | Trigger | Steps |
|---|---|---|
| **Build & Test** | push, PR, manual | Install → Type check → Test with coverage → Build |
| **Deploy to AWS** | push to `main`, manual | Validate secrets → Install → Configure AWS → SAM build → SAM deploy |

### Required GitHub Secrets

| Secret | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `SNS_TOPIC_ARN` | SNS topic ARN |
| `COGNITO_CLIENT_SECRET` | Cognito App Client secret |

### Required GitHub Variables

| Variable | Description |
|---|---|
| `DYNAMO_TABLE_NAME` | DynamoDB table name |
| `S3_BUCKET_NAME` | S3 bucket name |
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `COGNITO_APP_CLIENT_ID` | Cognito App Client ID |

---

## AWS Resources

All resources below are pre-existing and referenced by the SAM template via parameters — they are **not** created or deleted by `sam deploy`.

| Resource | Name / ID |
|---|---|
| Cognito User Pool | `ap-southeast-1_EE5VEeHgK` |
| Cognito App Client | `6du49t555mi37vrd9i63nbecn6` |
| DynamoDB Table | `AdsTable` |
| S3 Bucket | `ads-api-assignment-s3-bucket` |
| SNS Topic | `ads-api-ad-created` |

---

## Known Issues & Limitations

- **No pagination** — `GET /ads` performs a full DynamoDB `Scan`. For large datasets this will be slow and costly. Pagination with `LastEvaluatedKey` should be added before production use.
- **No filtering or sorting** — ads are returned in DynamoDB's internal scan order, not by `createdAt` or any other field.
- **Image format** — uploaded images are stored as-is from the base64 input with no validation of file type or size. Malformed or oversized payloads may cause errors.
- **Cognito USER_PASSWORD_AUTH** — must be manually enabled on the App Client in the AWS Console before the login endpoint will work. This cannot be configured via SAM as the User Pool is pre-existing.
- **Token refresh** — there is no `POST /auth/refresh` endpoint. Clients must re-login when the `idToken` expires (default: 1 hour).
- **Single environment** — the pipeline deploys directly to a single AWS environment. There is no staging/production separation.
