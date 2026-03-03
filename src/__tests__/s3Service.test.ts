import { uploadImage } from '../services/s3Service';

jest.mock('@aws-sdk/client-s3', () => {
  const mockSend = jest.fn();
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
    PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    _mockSend: mockSend,
  };
});

const mockS3Send = (jest.requireMock('@aws-sdk/client-s3') as any)._mockSend as jest.Mock;

describe('s3Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BUCKET_NAME = 'ads-api-assignment-s3-bucket';
  });

  afterEach(() => {
    delete process.env.BUCKET_NAME;
  });

  it('should upload an image and return the S3 URL', async () => {
    mockS3Send.mockResolvedValueOnce({});
    const imageBase64 = Buffer.from('fake-image-data').toString('base64');

    const result = await uploadImage('test-id-123', imageBase64);

    expect(result).toBe('https://ads-api-assignment-s3-bucket.s3.amazonaws.com/ads/test-id-123.jpg');
    expect(mockS3Send).toHaveBeenCalledTimes(1);
  });

  it('should use the correct S3 key format', async () => {
    mockS3Send.mockResolvedValueOnce({});
    const { PutObjectCommand } = jest.requireMock('@aws-sdk/client-s3');

    await uploadImage('my-ad-id', 'base64data');

    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: 'ads/my-ad-id.jpg',
        ContentType: 'image/jpeg',
      })
    );
  });

  it('should throw when BUCKET_NAME is not set', async () => {
    delete process.env.BUCKET_NAME;

    await expect(uploadImage('test-id', 'base64data')).rejects.toThrow(
      'BUCKET_NAME environment variable is not set'
    );
    expect(mockS3Send).not.toHaveBeenCalled();
  });

  it('should propagate S3 errors', async () => {
    mockS3Send.mockRejectedValueOnce(new Error('S3 upload failed'));

    await expect(uploadImage('test-id', 'base64data')).rejects.toThrow('S3 upload failed');
  });
});
