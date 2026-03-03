import { signUpUser, loginUser } from '../services/cognitoService';

jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  const mockSend = jest.fn();
  return {
    CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
    SignUpCommand: jest.fn().mockImplementation((input) => ({ input })),
    InitiateAuthCommand: jest.fn().mockImplementation((input) => ({ input })),
    _mockSend: mockSend,
  };
});

const mockSend = (jest.requireMock('@aws-sdk/client-cognito-identity-provider') as any)._mockSend as jest.Mock;

describe('cognitoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.COGNITO_APP_CLIENT_ID = 'test-client-id';
    process.env.COGNITO_CLIENT_SECRET = 'test-client-secret';
  });

  afterEach(() => {
    delete process.env.COGNITO_APP_CLIENT_ID;
    delete process.env.COGNITO_CLIENT_SECRET;
  });

  describe('signUpUser', () => {
    it('should sign up a user and return message and userId', async () => {
      mockSend.mockResolvedValueOnce({ UserSub: 'user-sub-123' });

      const result = await signUpUser({ email: 'test@example.com', password: 'Password1!' });

      expect(result).toEqual({
        message: expect.stringContaining('registered successfully'),
        userId: 'user-sub-123',
      });
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should call SignUpCommand with correct parameters', async () => {
      mockSend.mockResolvedValueOnce({ UserSub: 'user-sub-456' });
      const { SignUpCommand } = jest.requireMock('@aws-sdk/client-cognito-identity-provider');

      await signUpUser({ email: 'user@example.com', password: 'SecurePass1!' });

      expect(SignUpCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ClientId: 'test-client-id',
          Username: 'user@example.com',
          Password: 'SecurePass1!',
          SecretHash: expect.any(String),
          UserAttributes: [{ Name: 'email', Value: 'user@example.com' }],
        })
      );
    });

    it('should throw when COGNITO_APP_CLIENT_ID is not set', async () => {
      delete process.env.COGNITO_APP_CLIENT_ID;

      await expect(signUpUser({ email: 'test@example.com', password: 'Password1!' }))
        .rejects.toThrow('COGNITO_APP_CLIENT_ID environment variable is not set');
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should propagate Cognito errors', async () => {
      const err = Object.assign(new Error('User already exists'), { name: 'UsernameExistsException' });
      mockSend.mockRejectedValueOnce(err);

      await expect(signUpUser({ email: 'test@example.com', password: 'Password1!' }))
        .rejects.toThrow('User already exists');
    });
  });

  describe('loginUser', () => {
    it('should return tokens on successful login', async () => {
      mockSend.mockResolvedValueOnce({
        AuthenticationResult: {
          AccessToken: 'access-token-123',
          IdToken: 'id-token-123',
          RefreshToken: 'refresh-token-123',
        },
      });

      const result = await loginUser({ email: 'test@example.com', password: 'Password1!' });

      expect(result).toEqual({
        accessToken: 'access-token-123',
        idToken: 'id-token-123',
        refreshToken: 'refresh-token-123',
      });
    });

    it('should call InitiateAuthCommand with USER_PASSWORD_AUTH flow', async () => {
      mockSend.mockResolvedValueOnce({
        AuthenticationResult: { AccessToken: 'a', IdToken: 'b', RefreshToken: 'c' },
      });
      const { InitiateAuthCommand } = jest.requireMock('@aws-sdk/client-cognito-identity-provider');

      await loginUser({ email: 'user@example.com', password: 'Password1!' });

      expect(InitiateAuthCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          AuthFlow: 'USER_PASSWORD_AUTH',
          ClientId: 'test-client-id',
          AuthParameters: {
            USERNAME: 'user@example.com',
            PASSWORD: 'Password1!',
            SECRET_HASH: expect.any(String),
          },
        })
      );
    });

    it('should throw when COGNITO_APP_CLIENT_ID is not set', async () => {
      delete process.env.COGNITO_APP_CLIENT_ID;

      await expect(loginUser({ email: 'test@example.com', password: 'Password1!' }))
        .rejects.toThrow('COGNITO_APP_CLIENT_ID environment variable is not set');
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should propagate NotAuthorizedException', async () => {
      const err = Object.assign(new Error('Incorrect username or password'), { name: 'NotAuthorizedException' });
      mockSend.mockRejectedValueOnce(err);

      await expect(loginUser({ email: 'test@example.com', password: 'WrongPass1!' }))
        .rejects.toThrow('Incorrect username or password');
    });

    it('should propagate UserNotConfirmedException', async () => {
      const err = Object.assign(new Error('User is not confirmed'), { name: 'UserNotConfirmedException' });
      mockSend.mockRejectedValueOnce(err);

      await expect(loginUser({ email: 'test@example.com', password: 'Password1!' }))
        .rejects.toThrow('User is not confirmed');
    });
  });
});
