const path = require('path');
const fs = require('fs');

class LocalDiskStorageAdapter {
  constructor(baseDir = path.join(process.cwd(), '.uploads')) {
    this.baseDir = baseDir;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  _getFilePath(bucket, key) {
    const bucketDir = path.join(this.baseDir, bucket);
    if (!fs.existsSync(bucketDir)) {
      fs.mkdirSync(bucketDir, { recursive: true });
    }
    return path.join(bucketDir, key.replace(/\//g, '_'));
  }

  async getSignedUploadUrl(bucket, key, contentType = 'application/octet-stream', expiresMinutes = 15) {
    // In local mode, returns a mock local API upload endpoint URL or direct token
    const rawBaseUrl = process.env.VITE_API_BASE_URL || 'http://localhost:5000';
    const baseUrl = rawBaseUrl.replace(/\/api\/?$/, '');
    const filename = encodeURIComponent(key);
    return {
      uploadUrl: `${baseUrl}/api/storage/upload?bucket=${bucket}&key=${filename}`,
      gcsPath: `gs://${bucket}/${key}`,
    };
  }

  async getSignedDownloadUrl(bucket, key, expiresMinutes = 10) {
    const rawBaseUrl = process.env.VITE_API_BASE_URL || 'http://localhost:5000';
    const baseUrl = rawBaseUrl.replace(/\/api\/?$/, '');
    const filename = encodeURIComponent(key);
    return `${baseUrl}/api/storage/download?bucket=${bucket}&key=${filename}`;
  }

  async uploadFile(bucket, key, buffer, contentType) {
    const filePath = this._getFilePath(bucket, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await fs.promises.writeFile(filePath, buffer);
    return `gs://${bucket}/${key}`;
  }

  async deleteFile(bucket, key) {
    const filePath = this._getFilePath(bucket, key);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  async fileExists(bucket, key) {
    const filePath = this._getFilePath(bucket, key);
    return fs.existsSync(filePath);
  }
}

let storageInstance = null;

const getStorageAdapter = () => {
  if (!storageInstance) {
    storageInstance = new LocalDiskStorageAdapter();
  }
  return storageInstance;
};

module.exports = {
  LocalDiskStorageAdapter,
  getStorageAdapter,
};
