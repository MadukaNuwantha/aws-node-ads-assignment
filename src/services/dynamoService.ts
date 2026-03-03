import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Ad } from '../types';

const client = new DynamoDBClient({ region: process.env.REGION ?? 'ap-southeast-1' });
const docClient = DynamoDBDocumentClient.from(client);

export async function saveAd(ad: Ad): Promise<void> {
  const tableName = process.env.TABLE_NAME;
  if (!tableName) throw new Error('TABLE_NAME environment variable is not set');

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: ad,
    })
  );
}
