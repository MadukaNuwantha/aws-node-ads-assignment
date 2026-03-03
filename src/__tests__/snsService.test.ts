import { publishAdCreated } from '../services/snsService';
import { Ad } from '../types';

jest.mock('@aws-sdk/client-sns', () => {
  const mockSend = jest.fn();
  return {
    SNSClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
    PublishCommand: jest.fn().mockImplementation((input) => ({ input })),
    _mockSend: mockSend,
  };
});

const mockSnsSend = (jest.requireMock('@aws-sdk/client-sns') as any)._mockSend as jest.Mock;

const sampleAd: Ad = {
  adId: 'test-id-123',
  title: 'Test Ad',
  price: 100,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('snsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SNS_TOPIC_ARN = 'arn:aws:sns:ap-southeast-1:123456789:ads-api-ad-created';
  });

  afterEach(() => {
    delete process.env.SNS_TOPIC_ARN;
  });

  it('should publish an SNS notification successfully', async () => {
    mockSnsSend.mockResolvedValueOnce({ MessageId: 'msg-123' });

    await expect(publishAdCreated(sampleAd)).resolves.toBeUndefined();
    expect(mockSnsSend).toHaveBeenCalledTimes(1);
  });

  it('should publish with correct message content', async () => {
    mockSnsSend.mockResolvedValueOnce({});
    const { PublishCommand } = jest.requireMock('@aws-sdk/client-sns');

    await publishAdCreated(sampleAd);

    expect(PublishCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        TopicArn: 'arn:aws:sns:ap-southeast-1:123456789:ads-api-ad-created',
        Message: JSON.stringify(sampleAd),
        Subject: 'New Ad Created',
      })
    );
  });

  it('should throw when SNS_TOPIC_ARN is not set', async () => {
    delete process.env.SNS_TOPIC_ARN;

    await expect(publishAdCreated(sampleAd)).rejects.toThrow('SNS_TOPIC_ARN environment variable is not set');
    expect(mockSnsSend).not.toHaveBeenCalled();
  });

  it('should propagate SNS errors', async () => {
    mockSnsSend.mockRejectedValueOnce(new Error('SNS publish failed'));

    await expect(publishAdCreated(sampleAd)).rejects.toThrow('SNS publish failed');
  });
});
