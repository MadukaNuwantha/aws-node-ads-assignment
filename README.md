# Ads API

A serverless REST API for creating ad listings, built with AWS Lambda, API Gateway, DynamoDB, S3, and SNS.

## Architecture

```
POST /ads (API Gateway HTTP API)
    │
    ▼ (Cognito JWT Auth)
    │
    ▼
Lambda (createAd)
    ├── DynamoDB (AdsTable) — persist ad record
    ├── S3 (ads-api-assignment-s3-bucket) — store image (optional)
    └── SNS (ads-api-ad-created) — notify subscribers
```

## Prerequisites

- Node.js 22+
- AWS CLI configured (`aws configure`)
- AWS SAM CLI (`brew install aws-sam-cli`)

## Local Development

```bash
# Install dependencies
npm install

# Type check
npm run lint

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build TypeScript
npm run build
```

## Deployment

### 1. Get SNS Topic ARN

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
- Stack name: `ads-api`
- Region: `ap-southeast-1`
- `SnsTopicArn`: the ARN from step 1
- All other parameters have defaults pre-filled

### 3. Cognito Setup — Create a Test User

```bash
# Create user
aws cognito-idp admin-create-user \
  --user-pool-id ap-southeast-1_EE5VEeHgK \
  --username testuser \
  --temporary-password TempPass1! \
  --region ap-southeast-1

# Set permanent password (skip forced reset)
aws cognito-idp admin-set-user-password \
  --user-pool-id ap-southeast-1_EE5VEeHgK \
  --username testuser \
  --password MyPassword1! \
  --permanent \
  --region ap-southeast-1
```

### 4. Get a JWT Token

```bash
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=testuser,PASSWORD=MyPassword1! \
  --client-id 6du49t555mi37vrd9i63nbecn6 \
  --region ap-southeast-1
```

Copy the `IdToken` from the response.

### 5. Test the API

```bash
# Replace <API_URL> with the output from sam deploy
# Replace <JWT_TOKEN> with the IdToken from step 4

curl -X POST https://<API_URL>/ads \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title": "My First Ad", "price": 49.99}'
```

**With image:**

```bash
curl -X POST https://<API_URL>/ads \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"Ad with Image\", \"price\": 99.99, \"imageBase64\": \"$(base64 < image.jpg)\"}"
```

## API Reference

### POST /ads

**Headers:**
- `Authorization: Bearer <JWT_TOKEN>` (required)
- `Content-Type: application/json`

**Request Body:**
```json
{
  "title": "string (required)",
  "price": 0.00,
  "imageBase64": "base64-encoded-jpeg (optional)"
}
```

**Response 201:**
```json
{
  "message": "Ad created successfully",
  "ad": {
    "id": "uuid",
    "title": "string",
    "price": 0.00,
    "imageUrl": "https://... (if image provided)",
    "createdAt": "ISO-8601 timestamp"
  }
}
```

**Response 400:**
```json
{ "message": "title is required and must be a non-empty string" }
```

## GitHub Actions CI

The CI pipeline runs on every push/PR to `main`:
1. Install dependencies
2. TypeScript type check
3. Run tests with coverage (≥90% required)
4. Build

## AWS Resources

| Resource | Name/ID |
|---|---|
| Cognito User Pool | ap-southeast-1_EE5VEeHgK |
| Cognito App Client | 6du49t555mi37vrd9i63nbecn6 |
| DynamoDB Table | AdsTable |
| S3 Bucket | ads-api-assignment-s3-bucket |
| SNS Topic | ads-api-ad-created |
