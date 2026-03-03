import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { signUpUser } from '../services/cognitoService';
import { createLogger } from '../utils/logger';
import { SignupInput, ApiResponse } from '../types';

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
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

function validateInput(body: unknown): { input: SignupInput; error?: never } | { input?: never; error: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Request body must be a JSON object' };
  }

  const { email, password } = body as Record<string, unknown>;

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    return { error: 'email must be a valid email address' };
  }

  if (!password || typeof password !== 'string') {
    return { error: 'password is required' };
  }

  if (!PASSWORD_REGEX.test(password)) {
    return { error: 'password must be at least 8 characters and contain uppercase, lowercase, digit, and special character' };
  }

  return { input: { email, password } };
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext?.requestId ?? uuidv4();
  const logger = createLogger(requestId);

  logger.info('Received signup request');

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
    const result = await signUpUser(validation.input!);
    logger.info('User signed up successfully', { userId: result.userId });
    return respond(201, result);
  } catch (err) {
    const error = err as Error & { name?: string };
    logger.error('Signup failed', { error: error.message });

    switch (error.name) {
      case 'UsernameExistsException':
        return respond(409, { message: 'An account with this email already exists' });
      case 'InvalidPasswordException':
        return respond(400, { message: error.message });
      case 'InvalidParameterException':
        return respond(400, { message: error.message });
      default:
        return respond(500, { message: 'Internal server error' });
    }
  }
};
