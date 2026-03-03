import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { loginUser } from '../services/cognitoService';
import { createLogger } from '../utils/logger';
import { LoginInput, ApiResponse } from '../types';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

function respond(statusCode: number, body: unknown): ApiResponse {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateInput(body: unknown): { input: LoginInput; error?: never } | { input?: never; error: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Request body must be a JSON object' };
  }

  const { email, password } = body as Record<string, unknown>;

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    return { error: 'email must be a valid email address' };
  }

  if (!password || typeof password !== 'string' || password.trim() === '') {
    return { error: 'password is required' };
  }

  return { input: { email, password } };
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext?.requestId ?? uuidv4();
  const logger = createLogger(requestId);

  logger.info('Received login request');

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(event.body ?? '{}');
  } catch {
    logger.warn('Failed to parse request body');
    return respond(400, { message: 'Invalid JSON in request body' });
  }

  const validation = validateInput(parsedBody);
  if (validation.error) {
    logger.warn('Validation failed', { error: validation.error });
    return respond(400, { message: validation.error });
  }

  try {
    const tokens = await loginUser(validation.input!);
    logger.info('User logged in successfully');
    return respond(200, tokens);
  } catch (err) {
    const error = err as Error & { name?: string };
    logger.error('Login failed', { error: error.message });

    switch (error.name) {
      case 'NotAuthorizedException':
      case 'UserNotFoundException':
        return respond(401, { message: 'Incorrect email or password' });
      case 'UserNotConfirmedException':
        return respond(403, { message: 'User account is not confirmed. Please check your email.' });
      case 'InvalidParameterException':
        return respond(400, { message: error.message });
      default:
        return respond(500, { message: 'Internal server error' });
    }
  }
};
