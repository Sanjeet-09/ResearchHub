const { getStorageAdapter, GoogleCloudStorageAdapter, LocalDiskStorageAdapter } = require('../src/storage');
const fs = require('fs');
const path = require('path');

// Mock @google-cloud/storage
jest.mock('@google-cloud/storage', () => {
  const mFile = {
    save: jest.fn().mockResolvedValue(true),
    getSignedUrl: jest.fn().mockImplementation(({ action }) => {
      if (action === 'read') return Promise.resolve(['https://storage.googleapis.com/test-bucket/download-url']);
      return Promise.resolve(['https://storage.googleapis.com/test-bucket/upload-url']);
    }),
    download: jest.fn().mockResolvedValue([Buffer.from('gcs content')]),
    delete: jest.fn().mockResolvedValue(true),
    exists: jest.fn().mockResolvedValue([true]),
  };

  const mBucket = {
    file: jest.fn(() => mFile),
  };

  const mStorage = jest.fn(() => ({
    bucket: jest.fn(() => mBucket),
  }));

  return { Storage: mStorage };
});

describe('Storage Adapter Unit Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GCS_BUCKET;
    delete process.env.STORAGE_BUCKET;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('getStorageAdapter returns LocalDiskStorageAdapter when no bucket env vars are set', () => {
    const adapter = getStorageAdapter();
    expect(adapter).toBeInstanceOf(LocalDiskStorageAdapter);
  });

  test('getStorageAdapter returns GoogleCloudStorageAdapter when GCS_BUCKET is set', () => {
    process.env.GCS_BUCKET = 'my-prod-gcs-bucket';
    const adapter = getStorageAdapter();
    expect(adapter).toBeInstanceOf(GoogleCloudStorageAdapter);
    expect(adapter.bucketName).toBe('my-prod-gcs-bucket');
  });

  test('getStorageAdapter returns GoogleCloudStorageAdapter when STORAGE_BUCKET is set', () => {
    process.env.STORAGE_BUCKET = 'my-prod-storage-bucket';
    const adapter = getStorageAdapter();
    expect(adapter).toBeInstanceOf(GoogleCloudStorageAdapter);
    expect(adapter.bucketName).toBe('my-prod-storage-bucket');
  });

  describe('GoogleCloudStorageAdapter', () => {
    const adapter = new GoogleCloudStorageAdapter('test-bucket');

    test('uploadFile with standard signature (key, buffer, mimetype)', async () => {
      const result = await adapter.uploadFile('datasets/123/file.csv', Buffer.from('data'), 'text/csv');
      expect(result.path).toBe('gs://test-bucket/datasets/123/file.csv');
      expect(result.url).toBe('https://storage.googleapis.com/test-bucket/datasets/123/file.csv');
      expect(result.key).toBe('datasets/123/file.csv');
      expect(result.gcsPath).toBe('gs://test-bucket/datasets/123/file.csv');
      expect(String(result)).toBe('gs://test-bucket/datasets/123/file.csv');
    });

    test('uploadFile with legacy 4-arg signature (bucket, key, buffer, mimetype)', async () => {
      const result = await adapter.uploadFile('researchhub-storage', 'datasets/123/legacy.csv', Buffer.from('data'), 'text/csv');
      expect(result.path).toBe('gs://test-bucket/datasets/123/legacy.csv');
      expect(result.key).toBe('datasets/123/legacy.csv');
    });

    test('getSignedDownloadUrl returns signed URL with helpers', async () => {
      const res = await adapter.getSignedDownloadUrl('documents/doc1.pdf', 30);
      expect(String(res)).toBe('https://storage.googleapis.com/test-bucket/download-url');
      expect(res.downloadUrl).toBe('https://storage.googleapis.com/test-bucket/download-url');
    });

    test('getSignedUploadUrl returns signed upload URL with helpers', async () => {
      const res = await adapter.getSignedUploadUrl('documents/doc1.pdf', 'application/pdf', 15);
      expect(String(res)).toBe('https://storage.googleapis.com/test-bucket/upload-url');
      expect(res.uploadUrl).toBe('https://storage.googleapis.com/test-bucket/upload-url');
      expect(res.gcsPath).toBe('gs://test-bucket/documents/doc1.pdf');
    });

    test('downloadToBuffer retrieves buffer from GCS', async () => {
      const buf = await adapter.downloadToBuffer('datasets/123/file.csv');
      expect(buf.toString()).toBe('gcs content');
    });

    test('deleteFile calls bucket file delete', async () => {
      await expect(adapter.deleteFile('datasets/123/file.csv')).resolves.not.toThrow();
    });

    test('fileExists returns true', async () => {
      const exists = await adapter.fileExists('datasets/123/file.csv');
      expect(exists).toBe(true);
    });
  });

  describe('LocalDiskStorageAdapter', () => {
    const testDir = path.join(process.cwd(), '.uploads', 'test-storage');
    const adapter = new LocalDiskStorageAdapter(testDir);

    afterAll(() => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });

    test('uploadFile and downloadToBuffer work on disk', async () => {
      const res = await adapter.uploadFile('test-key.txt', Buffer.from('hello local'));
      expect(res.key).toBe('test-key.txt');

      const buf = await adapter.downloadToBuffer('test-key.txt');
      expect(buf.toString()).toBe('hello local');

      const exists = await adapter.fileExists('test-key.txt');
      expect(exists).toBe(true);

      await adapter.deleteFile('test-key.txt');
      const existsAfter = await adapter.fileExists('test-key.txt');
      expect(existsAfter).toBe(false);
    });
  });
});
