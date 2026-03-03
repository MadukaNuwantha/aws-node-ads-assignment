import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { Ad } from '../types';

const snsClient = new SNSClient({ region: process.env.REGION ?? 'ap-southeast-1' });

export async function publishAdCreated(ad: Ad): Promise<void> {
  const topicArn = process.env.SNS_TOPIC_ARN;
  if (!topicArn) throw new Error('SNS_TOPIC_ARN environment variable is not set');

  await snsClient.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(ad),
      Subject: 'New Ad Created',
    })
  );
}
