import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { getAllAds } from '../services/dynamoService';
import { createLogger } from '../utils/logger';
import { ApiResponse } from '../types';

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

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext?.requestId ?? uuidv4();
  const logger = createLogger(requestId);

  logger.info('Received get all ads request');

  try {
    const ads = await getAllAds();
    logger.info('Ads retrieved successfully', { count: ads.length });
    return respond(200, { ads });
  } catch (err) {
    logger.error('Failed to retrieve ads', { error: (err as Error).message });
    return respond(500, { message: 'Internal server error' });
  }
};
