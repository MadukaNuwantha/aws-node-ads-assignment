import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: process.env.REGION ?? 'ap-southeast-1' });

export async function uploadImage(id: string, imageBase64: string): Promise<string> {
  const bucketName = process.env.BUCKET_NAME;
  if (!bucketName) throw new Error('BUCKET_NAME environment variable is not set');

  const key = `ads/${id}.jpg`;
  const imageBuffer = Buffer.from(imageBase64, 'base64');

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: imageBuffer,
      ContentType: 'image/jpeg',
    })
  );

  return `https://${bucketName}.s3.amazonaws.com/${key}`;
}
