import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Ad } from '../types';

const client = new DynamoDBClient({ region: process.env.REGION ?? 'ap-southeast-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'AdsTable';

export async function getAllAds(): Promise<Ad[]> {
  const result = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
  return (result.Items ?? []) as Ad[];
}

export async function saveAd(ad: Ad): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: ad,
    })
  );
}
