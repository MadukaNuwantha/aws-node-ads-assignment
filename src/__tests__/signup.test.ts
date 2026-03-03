import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handler } from '../handlers/signup';

jest.mock('../services/cognitoService');

import { signUpUser } from '../services/cognitoService';

const mockSignUpUser = signUpUser as jest.MockedFunction<typeof signUpUser>;

function makeEvent(body: unknown, overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /auth/signup',
    rawPath: '/auth/signup',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      domainName: 'example.com',
      domainPrefix: 'example',
      http: { method: 'POST', path: '/auth/signup', protocol: 'HTTP/1.1', sourceIp: '1.2.3.4', userAgent: 'test' },
      requestId: 'test-request-id',
      routeKey: 'POST /auth/signup',
      stage: '$default',
      time: '2026-01-01T00:00:00Z',
      timeEpoch: 1735689600000,
    },
    body: JSON.stringify(body),
    isBase64Encoded: false,
    ...overrides,
  } as APIGatewayProxyEventV2;
}

describe('signup handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.COGNITO_APP_CLIENT_ID = 'test-client-id';
  });

  describe('happy path', () => {
    it('should return 201 on successful signup', async () => {
      mockSignUpUser.mockResolvedValueOnce({
        message: 'User registered successfully. Please check your email to confirm your account.',
        userId: 'user-sub-123',
      });

      const result = await handler(makeEvent({ email: 'test@example.com', password: 'Password1!' }));

      expect(result).toMatchObject({ statusCode: 201 });
      const body = JSON.parse((result as any).body);
      expect(body.message).toContain('registered successfully');
      expect(body.userId).toBe('user-sub-123');
    });

    it('should call signUpUser with email and password', async () => {
      mockSignUpUser.mockResolvedValueOnce({ message: 'User registered successfully. Please check your email to confirm your account.', userId: 'uid' });

      await handler(makeEvent({ email: 'user@example.com', password: 'SecurePass1!' }));

      expect(mockSignUpUser).toHaveBeenCalledWith({ email: 'user@example.com', password: 'SecurePass1!' });
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

    it('should return 400 when password is too short', async () => {
      const result = await handler(makeEvent({ email: 'test@example.com', password: 'Aa1!' }));

      expect(result).toMatchObject({ statusCode: 400 });
      expect(JSON.parse((result as any).body).message).toContain('password');
    });

    it('should return 400 when password lacks uppercase', async () => {
      const result = await handler(makeEvent({ email: 'test@example.com', password: 'password1!' }));

      expect(result).toMatchObject({ statusCode: 400 });
    });

    it('should return 400 when password lacks lowercase', async () => {
      const result = await handler(makeEvent({ email: 'test@example.com', password: 'PASSWORD1!' }));

      expect(result).toMatchObject({ statusCode: 400 });
    });

    it('should return 400 when password lacks digit', async () => {
      const result = await handler(makeEvent({ email: 'test@example.com', password: 'Password!!' }));

      expect(result).toMatchObject({ statusCode: 400 });
    });

    it('should return 400 when password lacks special character', async () => {
      const result = await handler(makeEvent({ email: 'test@example.com', password: 'Password1' }));

      expect(result).toMatchObject({ statusCode: 400 });
    });
  });

  describe('Cognito error mapping', () => {
    it('should return 409 for UsernameExistsException', async () => {
      const err = Object.assign(new Error('User exists'), { name: 'UsernameExistsException' });
      mockSignUpUser.mockRejectedValueOnce(err);

      const result = await handler(makeEvent({ email: 'test@example.com', password: 'Password1!' }));

      expect(result).toMatchObject({ statusCode: 409 });
      expect(JSON.parse((result as any).body).message).toContain('already exists');
    });

    it('should return 400 for InvalidPasswordException', async () => {
      const err = Object.assign(new Error('Password does not meet requirements'), { name: 'InvalidPasswordException' });
      mockSignUpUser.mockRejectedValueOnce(err);

      const result = await handler(makeEvent({ email: 'test@example.com', password: 'Password1!' }));

      expect(result).toMatchObject({ statusCode: 400 });
    });

    it('should return 400 for InvalidParameterException', async () => {
      const err = Object.assign(new Error('Invalid parameter'), { name: 'InvalidParameterException' });
      mockSignUpUser.mockRejectedValueOnce(err);

      const result = await handler(makeEvent({ email: 'test@example.com', password: 'Password1!' }));

      expect(result).toMatchObject({ statusCode: 400 });
    });

    it('should return 500 for unknown errors', async () => {
      mockSignUpUser.mockRejectedValueOnce(new Error('Unknown error'));

      const result = await handler(makeEvent({ email: 'test@example.com', password: 'Password1!' }));

      expect(result).toMatchObject({ statusCode: 500 });
      expect(JSON.parse((result as any).body).message).toBe('Internal server error');
    });
  });

  describe('edge cases', () => {
    it('should handle missing requestContext gracefully', async () => {
      mockSignUpUser.mockResolvedValueOnce({ message: 'User registered successfully. Please check your email to confirm your account.', userId: 'uid' });
      const event = makeEvent({ email: 'test@example.com', password: 'Password1!' });
      delete (event as any).requestContext;

      const result = await handler(event);

      expect(result).toMatchObject({ statusCode: 201 });
    });
  });
});
