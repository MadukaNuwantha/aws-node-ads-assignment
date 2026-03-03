import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { saveAd } from '../services/dynamoService';
import { uploadImage } from '../services/s3Service';
import { publishAdCreated } from '../services/snsService';
import { createLogger } from '../utils/logger';
import { Ad, CreateAdInput, ApiResponse } from '../types';

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

function validateInput(body: unknown): { input: CreateAdInput; error?: never } | { input?: never; error: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Request body must be a JSON object' };
  }

  const { title, price, imageBase64 } = body as Record<string, unknown>;

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return { error: 'title is required and must be a non-empty string' };
  }

  if (price === undefined || price === null) {
    return { error: 'price is required' };
  }

  if (typeof price !== 'number' || isNaN(price) || price < 0) {
    return { error: 'price must be a non-negative number' };
  }

  if (imageBase64 !== undefined && typeof imageBase64 !== 'string') {
    return { error: 'imageBase64 must be a string' };
  }

  return { input: { title: title.trim(), price, imageBase64: imageBase64 as string | undefined } };
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext?.requestId ?? uuidv4();
  const logger = createLogger(requestId);

  logger.info('Received create ad request');

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

  const { title, price, imageBase64 } = validation.input!;

  const adId = uuidv4();
  const createdAt = new Date().toISOString();

  let imageUrl: string | undefined;

  try {
    if (imageBase64) {
      logger.info('Uploading image to S3', { adId });
      imageUrl = await uploadImage(adId, imageBase64);
      logger.info('Image uploaded successfully', { adId, imageUrl });
    }

    const ad: Ad = { adId, title, price, createdAt, ...(imageUrl ? { imageUrl } : {}) };

    logger.info('Saving ad to DynamoDB', { adId });
    await saveAd(ad);
    logger.info('Ad saved to DynamoDB', { adId });

    logger.info('Publishing SNS notification', { adId });
    await publishAdCreated(ad);
    logger.info('SNS notification published', { adId });

    return respond(201, { message: 'Ad created successfully', ad });
  } catch (err) {
    logger.error('Failed to create ad', { error: (err as Error).message, adId });
    return respond(500, { message: 'Internal server error' });
  }
};
