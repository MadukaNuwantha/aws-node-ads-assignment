import { saveAd, getAllAds } from '../services/dynamoService';
import { Ad } from '../types';

jest.mock('@aws-sdk/client-dynamodb', () => {
  const mockSend = jest.fn();
  return {
    DynamoDBClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
    _mockSend: mockSend,
  };
});

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = jest.fn();
  return {
    DynamoDBDocumentClient: {
      from: jest.fn().mockReturnValue({ send: mockSend }),
    },
    PutCommand: jest.fn().mockImplementation((input) => ({ input })),
    ScanCommand: jest.fn().mockImplementation((input) => ({ input })),
    _mockSend: mockSend,
  };
});

const mockDocSend = (jest.requireMock('@aws-sdk/lib-dynamodb') as any)._mockSend as jest.Mock;

const sampleAd: Ad = {
  adId: 'test-id-123',
  title: 'Test Ad',
  price: 100,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('dynamoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TABLE_NAME = 'AdsTable';
  });

  afterEach(() => {
    delete process.env.TABLE_NAME;
  });

  it('should save an ad to DynamoDB successfully', async () => {
    mockDocSend.mockResolvedValueOnce({});

    await expect(saveAd(sampleAd)).resolves.toBeUndefined();
    expect(mockDocSend).toHaveBeenCalledTimes(1);
  });

  it('should save an ad with imageUrl', async () => {
    mockDocSend.mockResolvedValueOnce({});
    const adWithImage: Ad = { ...sampleAd, imageUrl: 'https://bucket.s3.amazonaws.com/ads/test-id-123.jpg' };

    await expect(saveAd(adWithImage)).resolves.toBeUndefined();
    expect(mockDocSend).toHaveBeenCalledTimes(1);
  });

  it('should throw when TABLE_NAME is not set', async () => {
    delete process.env.TABLE_NAME;

    await expect(saveAd(sampleAd)).rejects.toThrow('TABLE_NAME environment variable is not set');
    expect(mockDocSend).not.toHaveBeenCalled();
  });

  it('should propagate DynamoDB errors', async () => {
    mockDocSend.mockRejectedValueOnce(new Error('DynamoDB error'));

    await expect(saveAd(sampleAd)).rejects.toThrow('DynamoDB error');
  });

  describe('getAllAds', () => {
    it('should return all ads from DynamoDB', async () => {
      const items = [
        { adId: 'id-1', title: 'Ad 1', price: 10, createdAt: '2026-01-01T00:00:00.000Z' },
        { adId: 'id-2', title: 'Ad 2', price: 20, createdAt: '2026-01-02T00:00:00.000Z' },
      ];
      mockDocSend.mockResolvedValueOnce({ Items: items });

      const result = await getAllAds();

      expect(result).toEqual(items);
      expect(mockDocSend).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when Items is undefined', async () => {
      mockDocSend.mockResolvedValueOnce({});

      const result = await getAllAds();

      expect(result).toEqual([]);
    });

    it('should throw when TABLE_NAME is not set', async () => {
      delete process.env.TABLE_NAME;

      await expect(getAllAds()).rejects.toThrow('TABLE_NAME environment variable is not set');
      expect(mockDocSend).not.toHaveBeenCalled();
    });

    it('should propagate DynamoDB scan errors', async () => {
      mockDocSend.mockRejectedValueOnce(new Error('Scan failed'));

      await expect(getAllAds()).rejects.toThrow('Scan failed');
    });
  });
});
