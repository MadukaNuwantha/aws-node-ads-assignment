import { createHmac } from 'crypto';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { SignupInput, LoginInput, SignupResponse, LoginResponse } from '../types';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.REGION ?? 'ap-southeast-1',
});

function computeSecretHash(username: string, clientId: string, clientSecret: string): string {
  return createHmac('sha256', clientSecret)
    .update(username + clientId)
    .digest('base64');
}

export async function signUpUser(input: SignupInput): Promise<SignupResponse> {
  const clientId = process.env.COGNITO_APP_CLIENT_ID;
  if (!clientId) throw new Error('COGNITO_APP_CLIENT_ID environment variable is not set');

  const clientSecret = process.env.COGNITO_CLIENT_SECRET;

  const result = await cognitoClient.send(
    new SignUpCommand({
      ClientId: clientId,
      Username: input.email,
      Password: input.password,
      ...(clientSecret && { SecretHash: computeSecretHash(input.email, clientId, clientSecret) }),
      UserAttributes: [{ Name: 'email', Value: input.email }],
    })
  );

  return { message: 'User registered successfully. Please check your email to confirm your account.', userId: result.UserSub! };
}

export async function loginUser(input: LoginInput): Promise<LoginResponse> {
  const clientId = process.env.COGNITO_APP_CLIENT_ID;
  if (!clientId) throw new Error('COGNITO_APP_CLIENT_ID environment variable is not set');

  const clientSecret = process.env.COGNITO_CLIENT_SECRET;

  const result = await cognitoClient.send(
    new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: clientId,
      AuthParameters: {
        USERNAME: input.email,
        PASSWORD: input.password,
        ...(clientSecret && { SECRET_HASH: computeSecretHash(input.email, clientId, clientSecret) }),
      },
    })
  );

  const auth = result.AuthenticationResult!;
  return {
    accessToken: auth.AccessToken!,
    idToken: auth.IdToken!,
    refreshToken: auth.RefreshToken!,
  };
}
