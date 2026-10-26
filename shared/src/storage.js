const path = require('path');
const fs = require('fs');

class LocalDiskStorageAdapter {
  constructor(baseDir = path.join(process.cwd(), '.uploads')) {
    this.baseDir = baseDir;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  /**
   * Resolve the public-facing base URL for storage endpoints.
   * Priority: PUBLIC_API_URL > VITE_API_BASE_URL > '' (relative).
   * Empty string produces relative URLs like /api/storage/... which work
   * correctly when served behind the gateway or Firebase Hosting rewrites.
   */
  _resolveBaseUrl() {
    const raw = process.env.PUBLIC_API_URL || process.env.VITE_API_BASE_URL || '';
    return raw.replace(/\/api\/?$/, '');
  }

  _getFilePath(bucket, key) {
    const bucketDir = bucket ? path.join(this.baseDir, bucket) : this.baseDir;
    if (!fs.existsSync(bucketDir)) {
      fs.mkdirSync(bucketDir, { recursive: true });
    }
    const cleanKey = String(key || '');
    const flatPath = path.join(bucketDir, cleanKey.replace(/\//g, '_'));
    if (fs.existsSync(flatPath)) return flatPath;
    const nestedPath = path.join(bucketDir, cleanKey);
    if (fs.existsSync(nestedPath)) return nestedPath;
    return flatPath;
  }

  async getSignedUploadUrl(bucket, key, contentType = 'application/octet-stream', expiresMinutes = 15) {
    const baseUrl = this._resolveBaseUrl();
    const filename = encodeURIComponent(key);
    return {
      uploadUrl: `${baseUrl}/api/storage/upload?bucket=${bucket}&key=${filename}`,
      gcsPath: `gs://${bucket}/${key}`,
    };
  }

  async getSignedDownloadUrl(bucket, key, expiresMinutes = 10) {
    const baseUrl = this._resolveBaseUrl();
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

  async readFile(bucket, key) {
    const filePath = this._getFilePath(bucket, key);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return await fs.promises.readFile(filePath);
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
