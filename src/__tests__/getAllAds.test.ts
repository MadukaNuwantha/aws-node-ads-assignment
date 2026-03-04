import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handler } from '../handlers/getAllAds';

jest.mock('../services/dynamoService');

import { getAllAds } from '../services/dynamoService';

const mockGetAllAds = getAllAds as jest.MockedFunction<typeof getAllAds>;

function makeEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'GET /ads',
    rawPath: '/ads',
    rawQueryString: '',
    headers: { authorization: 'Bearer token' },
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      domainName: 'example.com',
      domainPrefix: 'example',
      http: { method: 'GET', path: '/ads', protocol: 'HTTP/1.1', sourceIp: '1.2.3.4', userAgent: 'test' },
      requestId: 'test-request-id',
      routeKey: 'GET /ads',
      stage: '$default',
      time: '2026-01-01T00:00:00Z',
      timeEpoch: 1735689600000,
    },
    isBase64Encoded: false,
    ...overrides,
  } as APIGatewayProxyEventV2;
}

describe('getAllAds handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 200 with an array of ads', async () => {
    const sampleAds = [
      { adId: 'id-1', title: 'First Ad', price: 100, createdAt: '2026-01-01T00:00:00.000Z' },
      { adId: 'id-2', title: 'Second Ad', price: 200, createdAt: '2026-01-02T00:00:00.000Z' },
    ];
    mockGetAllAds.mockResolvedValueOnce(sampleAds);

    const result = await handler(makeEvent());

    expect(result).toMatchObject({ statusCode: 200 });
    const body = JSON.parse((result as any).body);
    expect(body.ads).toHaveLength(2);
    expect(body.ads[0]).toMatchObject({ adId: 'id-1', title: 'First Ad', price: 100 });
    expect(body.ads[1]).toMatchObject({ adId: 'id-2', title: 'Second Ad', price: 200 });
  });

  it('should return 200 with empty array when no ads exist', async () => {
    mockGetAllAds.mockResolvedValueOnce([]);

    const result = await handler(makeEvent());

    expect(result).toMatchObject({ statusCode: 200 });
    const body = JSON.parse((result as any).body);
    expect(body.ads).toEqual([]);
  });

  it('should return 500 when DynamoDB throws', async () => {
    mockGetAllAds.mockRejectedValueOnce(new Error('DynamoDB scan failed'));

    const result = await handler(makeEvent());

    expect(result).toMatchObject({ statusCode: 500 });
    const body = JSON.parse((result as any).body);
    expect(body.message).toBe('Internal server error');
  });

  it('should handle missing requestContext gracefully', async () => {
    mockGetAllAds.mockResolvedValueOnce([]);
    const event = makeEvent();
    delete (event as any).requestContext;

    const result = await handler(event);

    expect(result).toMatchObject({ statusCode: 200 });
  });
});
