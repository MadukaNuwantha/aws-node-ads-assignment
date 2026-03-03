import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handler } from '../handlers/createAd';

// Mock all AWS services
jest.mock('../services/dynamoService');
jest.mock('../services/s3Service');
jest.mock('../services/snsService');

import { saveAd } from '../services/dynamoService';
import { uploadImage } from '../services/s3Service';
import { publishAdCreated } from '../services/snsService';

const mockSaveAd = saveAd as jest.MockedFunction<typeof saveAd>;
const mockUploadImage = uploadImage as jest.MockedFunction<typeof uploadImage>;
const mockPublishAdCreated = publishAdCreated as jest.MockedFunction<typeof publishAdCreated>;

function makeEvent(body: unknown, overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /ads',
    rawPath: '/ads',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      domainName: 'example.com',
      domainPrefix: 'example',
      http: { method: 'POST', path: '/ads', protocol: 'HTTP/1.1', sourceIp: '1.2.3.4', userAgent: 'test' },
      requestId: 'test-request-id',
      routeKey: 'POST /ads',
      stage: '$default',
      time: '2026-01-01T00:00:00Z',
      timeEpoch: 1735689600000,
    },
    body: JSON.stringify(body),
    isBase64Encoded: false,
    ...overrides,
  } as APIGatewayProxyEventV2;
}

describe('createAd handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSaveAd.mockResolvedValue(undefined);
    mockPublishAdCreated.mockResolvedValue(undefined);
    mockUploadImage.mockResolvedValue('https://bucket.s3.amazonaws.com/ads/test.jpg');
    process.env.TABLE_NAME = 'AdsTable';
    process.env.BUCKET_NAME = 'ads-api-assignment-s3-bucket';
    process.env.SNS_TOPIC_ARN = 'arn:aws:sns:ap-southeast-1:123:ads-api-ad-created';
  });

  describe('happy path', () => {
    it('should create an ad and return 201', async () => {
      const event = makeEvent({ title: 'Test Ad', price: 99.99 });

      const result = await handler(event);

      expect(result).toMatchObject({ statusCode: 201 });
      const body = JSON.parse((result as any).body);
      expect(body.message).toBe('Ad created successfully');
      expect(body.ad).toMatchObject({ title: 'Test Ad', price: 99.99 });
      expect(body.ad.adId).toBeDefined();
      expect(body.ad.createdAt).toBeDefined();
    });

    it('should call DynamoDB and SNS', async () => {
      const event = makeEvent({ title: 'Test Ad', price: 50 });

      await handler(event);

      expect(mockSaveAd).toHaveBeenCalledTimes(1);
      expect(mockPublishAdCreated).toHaveBeenCalledTimes(1);
    });

    it('should not call S3 when no imageBase64', async () => {
      const event = makeEvent({ title: 'No Image Ad', price: 25 });

      await handler(event);

      expect(mockUploadImage).not.toHaveBeenCalled();
      expect(mockSaveAd).toHaveBeenCalledTimes(1);
    });

    it('should upload image to S3 when imageBase64 is provided', async () => {
      const event = makeEvent({ title: 'Ad with Image', price: 75, imageBase64: 'base64encodedimage' });

      const result = await handler(event);

      expect(mockUploadImage).toHaveBeenCalledTimes(1);
      const body = JSON.parse((result as any).body);
      expect(body.ad.imageUrl).toBe('https://bucket.s3.amazonaws.com/ads/test.jpg');
    });

    it('should call SNS after DynamoDB succeeds', async () => {
      const callOrder: string[] = [];
      mockSaveAd.mockImplementation(async () => { callOrder.push('dynamo'); });
      mockPublishAdCreated.mockImplementation(async () => { callOrder.push('sns'); });

      await handler(makeEvent({ title: 'Order Test', price: 10 }));

      expect(callOrder).toEqual(['dynamo', 'sns']);
    });
  });

  describe('validation errors', () => {
    it('should return 400 when title is missing', async () => {
      const event = makeEvent({ price: 100 });

      const result = await handler(event);

      expect(result).toMatchObject({ statusCode: 400 });
      const body = JSON.parse((result as any).body);
      expect(body.message).toContain('title');
    });

    it('should return 400 when title is empty string', async () => {
      const event = makeEvent({ title: '   ', price: 100 });

      const result = await handler(event);

      expect(result).toMatchObject({ statusCode: 400 });
    });

    it('should return 400 when price is missing', async () => {
      const event = makeEvent({ title: 'Test Ad' });

      const result = await handler(event);

      expect(result).toMatchObject({ statusCode: 400 });
      const body = JSON.parse((result as any).body);
      expect(body.message).toContain('price');
    });

    it('should return 400 when price is negative', async () => {
      const event = makeEvent({ title: 'Test Ad', price: -10 });

      const result = await handler(event);

      expect(result).toMatchObject({ statusCode: 400 });
    });

    it('should return 400 when price is not a number', async () => {
      const event = makeEvent({ title: 'Test Ad', price: 'not-a-number' });

      const result = await handler(event);

      expect(result).toMatchObject({ statusCode: 400 });
    });

    it('should return 400 for invalid JSON body', async () => {
      const event = makeEvent({}, { body: 'not-json{{{' });

      const result = await handler(event);

      expect(result).toMatchObject({ statusCode: 400 });
      const body = JSON.parse((result as any).body);
      expect(body.message).toContain('JSON');
    });

    it('should return 400 when body is not an object', async () => {
      const event = makeEvent({}, { body: '"just a string"' });

      const result = await handler(event);

      expect(result).toMatchObject({ statusCode: 400 });
    });
  });

  describe('error handling', () => {
    it('should return 500 when DynamoDB throws', async () => {
      mockSaveAd.mockRejectedValueOnce(new Error('DynamoDB connection failed'));

      const result = await handler(makeEvent({ title: 'Test Ad', price: 50 }));

      expect(result).toMatchObject({ statusCode: 500 });
      const body = JSON.parse((result as any).body);
      expect(body.message).toBe('Internal server error');
    });

    it('should return 500 when SNS throws', async () => {
      mockPublishAdCreated.mockRejectedValueOnce(new Error('SNS error'));

      const result = await handler(makeEvent({ title: 'Test Ad', price: 50 }));

      expect(result).toMatchObject({ statusCode: 500 });
    });

    it('should return 500 when S3 throws', async () => {
      mockUploadImage.mockRejectedValueOnce(new Error('S3 upload failed'));

      const result = await handler(makeEvent({ title: 'Test Ad', price: 50, imageBase64: 'data' }));

      expect(result).toMatchObject({ statusCode: 500 });
    });

    it('should handle missing requestContext gracefully', async () => {
      const event = makeEvent({ title: 'Test Ad', price: 50 });
      delete (event as any).requestContext;

      const result = await handler(event);

      expect(result).toMatchObject({ statusCode: 201 });
    });
  });

  describe('price edge cases', () => {
    it('should accept price of 0', async () => {
      const result = await handler(makeEvent({ title: 'Free Ad', price: 0 }));
      expect(result).toMatchObject({ statusCode: 201 });
    });

    it('should accept decimal prices', async () => {
      const result = await handler(makeEvent({ title: 'Decimal Ad', price: 9.99 }));
      expect(result).toMatchObject({ statusCode: 201 });
    });
  });
});
