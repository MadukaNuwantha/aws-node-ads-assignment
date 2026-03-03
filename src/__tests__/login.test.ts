import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handler } from '../handlers/login';

jest.mock('../services/cognitoService');

import { loginUser } from '../services/cognitoService';

const mockLoginUser = loginUser as jest.MockedFunction<typeof loginUser>;

function makeEvent(body: unknown, overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /auth/login',
    rawPath: '/auth/login',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      domainName: 'example.com',
      domainPrefix: 'example',
      http: { method: 'POST', path: '/auth/login', protocol: 'HTTP/1.1', sourceIp: '1.2.3.4', userAgent: 'test' },
      requestId: 'test-request-id',
      routeKey: 'POST /auth/login',
      stage: '$default',
      time: '2026-01-01T00:00:00Z',
      timeEpoch: 1735689600000,
    },
    body: JSON.stringify(body),
    isBase64Encoded: false,
    ...overrides,
  } as APIGatewayProxyEventV2;
}

const sampleTokens = {
  accessToken: 'access-token-abc',
  idToken: 'id-token-abc',
  refreshToken: 'refresh-token-abc',
};

describe('login handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.COGNITO_APP_CLIENT_ID = 'test-client-id';
  });

  describe('happy path', () => {
    it('should return 200 with tokens on successful login', async () => {
      mockLoginUser.mockResolvedValueOnce(sampleTokens);

      const result = await handler(makeEvent({ email: 'test@example.com', password: 'Password1!' }));

      expect(result).toMatchObject({ statusCode: 200 });
      const body = JSON.parse((result as any).body);
      expect(body).toEqual(sampleTokens);
    });

    it('should call loginUser with email and password', async () => {
      mockLoginUser.mockResolvedValueOnce(sampleTokens);

      await handler(makeEvent({ email: 'user@example.com', password: 'Password1!' }));

      expect(mockLoginUser).toHaveBeenCalledWith({ email: 'user@example.com', password: 'Password1!' });
    });
  });

  describe('validation errors', () => {
    it('should return 400 for invalid JSON body', async () => {
      const result = await handler(makeEvent({}, { body: '{invalid}' }));

      expect(result).toMatchObject({ statusCode: 400 });
      expect(JSON.parse((result as any).body).message).toContain('JSON');
    });

    it('should return 400 when body is not an object', async () => {
      const result = await handler(makeEvent({}, { body: '"string"' }));

      expect(result).toMatchObject({ statusCode: 400 });
    });

    it('should return 400 when email is missing', async () => {
      const result = await handler(makeEvent({ password: 'Password1!' }));

      expect(result).toMatchObject({ statusCode: 400 });
      expect(JSON.parse((result as any).body).message).toContain('email');
    });

    it('should return 400 when email is invalid', async () => {
      const result = await handler(makeEvent({ email: 'not-an-email', password: 'Password1!' }));

      expect(result).toMatchObject({ statusCode: 400 });
      expect(JSON.parse((result as any).body).message).toContain('email');
    });

    it('should return 400 when password is missing', async () => {
      const result = await handler(makeEvent({ email: 'test@example.com' }));

      expect(result).toMatchObject({ statusCode: 400 });
      expect(JSON.parse((result as any).body).message).toContain('password');
    });

    it('should return 400 when password is empty string', async () => {
      const result = await handler(makeEvent({ email: 'test@example.com', password: '   ' }));

      expect(result).toMatchObject({ statusCode: 400 });
    });
  });

  describe('Cognito error mapping', () => {
    it('should return 401 for NotAuthorizedException', async () => {
      const err = Object.assign(new Error('Incorrect username or password'), { name: 'NotAuthorizedException' });
      mockLoginUser.mockRejectedValueOnce(err);

      const result = await handler(makeEvent({ email: 'test@example.com', password: 'WrongPass1!' }));

      expect(result).toMatchObject({ statusCode: 401 });
      expect(JSON.parse((result as any).body).message).toBe('Incorrect email or password');
    });

    it('should return 401 for UserNotFoundException (prevents user enumeration)', async () => {
      const err = Object.assign(new Error('User does not exist'), { name: 'UserNotFoundException' });
      mockLoginUser.mockRejectedValueOnce(err);

      const result = await handler(makeEvent({ email: 'nouser@example.com', password: 'Password1!' }));

      expect(result).toMatchObject({ statusCode: 401 });
      expect(JSON.parse((result as any).body).message).toBe('Incorrect email or password');
    });

    it('should return 403 for UserNotConfirmedException', async () => {
      const err = Object.assign(new Error('User is not confirmed'), { name: 'UserNotConfirmedException' });
      mockLoginUser.mockRejectedValueOnce(err);

      const result = await handler(makeEvent({ email: 'test@example.com', password: 'Password1!' }));

      expect(result).toMatchObject({ statusCode: 403 });
      expect(JSON.parse((result as any).body).message).toContain('not confirmed');
    });

    it('should return 400 for InvalidParameterException', async () => {
      const err = Object.assign(new Error('Invalid parameter'), { name: 'InvalidParameterException' });
      mockLoginUser.mockRejectedValueOnce(err);

      const result = await handler(makeEvent({ email: 'test@example.com', password: 'Password1!' }));

      expect(result).toMatchObject({ statusCode: 400 });
    });

    it('should return 500 for unknown errors', async () => {
      mockLoginUser.mockRejectedValueOnce(new Error('Unknown error'));

      const result = await handler(makeEvent({ email: 'test@example.com', password: 'Password1!' }));

      expect(result).toMatchObject({ statusCode: 500 });
      expect(JSON.parse((result as any).body).message).toBe('Internal server error');
    });
  });

  describe('edge cases', () => {
    it('should handle missing requestContext gracefully', async () => {
      mockLoginUser.mockResolvedValueOnce(sampleTokens);
      const event = makeEvent({ email: 'test@example.com', password: 'Password1!' });
      delete (event as any).requestContext;

      const result = await handler(event);

      expect(result).toMatchObject({ statusCode: 200 });
    });
  });
});
