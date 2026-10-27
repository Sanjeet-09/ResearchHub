const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs');

class GoogleCloudStorageAdapter {
  constructor(bucketName) {
    this.bucketName = bucketName;
    this.storage = new Storage();
    this.bucket = this.storage.bucket(bucketName);
  }

  _parseUploadArgs(args) {
    if (args.length >= 4) {
      return { destinationKey: args[1], buffer: args[2], mimetype: args[3] };
    }
    if (args.length === 3) {
      if (Buffer.isBuffer(args[1])) {
        return { destinationKey: args[0], buffer: args[1], mimetype: args[2] };
      }
      return { destinationKey: args[1], buffer: args[2], mimetype: 'application/octet-stream' };
    }
    if (args.length === 2) {
      return { destinationKey: args[0], buffer: args[1], mimetype: 'application/octet-stream' };
    }
    return { destinationKey: args[0], buffer: Buffer.from(''), mimetype: 'application/octet-stream' };
  }

  _parseDownloadArgs(args) {
    if (args.length >= 3) {
      return { destinationKey: args[1], expiresInMinutes: typeof args[2] === 'number' ? args[2] : 60 };
    }
    if (args.length === 2) {
      if (typeof args[1] === 'number') {
        return { destinationKey: args[0], expiresInMinutes: args[1] };
      }
      return { destinationKey: args[1], expiresInMinutes: 60 };
    }
    return { destinationKey: args[0], expiresInMinutes: 60 };
  }

  _parseUploadUrlArgs(args) {
    if (args.length >= 4) {
      return { destinationKey: args[1], mimetype: args[2], expiresInMinutes: typeof args[3] === 'number' ? args[3] : 15 };
    }
    if (args.length === 3) {
      if (typeof args[2] === 'number') {
        return { destinationKey: args[0], mimetype: args[1], expiresInMinutes: args[2] };
      }
      return { destinationKey: args[1], mimetype: args[2], expiresInMinutes: 15 };
    }
    if (args.length === 2) {
      if (args[0].includes('/') || args[1].includes('/')) {
        return { destinationKey: args[0], mimetype: args[1], expiresInMinutes: 15 };
      }
      return { destinationKey: args[1], mimetype: 'application/octet-stream', expiresInMinutes: 15 };
    }
    return { destinationKey: args[0], mimetype: 'application/octet-stream', expiresInMinutes: 15 };
  }

  _parseSingleKey(args) {
    if (args.length >= 2 && typeof args[1] === 'string' && (args[0] === this.bucketName || args[0] === 'researchhub-storage' || args[0].endsWith('-storage'))) {
      return args[1];
    }
    return args[0];
  }

  async uploadFile(...args) {
    const { destinationKey, buffer, mimetype } = this._parseUploadArgs(args);
    const file = this.bucket.file(destinationKey);
    await file.save(buffer, {
      metadata: { contentType: mimetype || 'application/octet-stream' },
      resumable: false,
    });
    const gcsPath = `gs://${this.bucketName}/${destinationKey}`;
    const url = `https://storage.googleapis.com/${this.bucketName}/${destinationKey}`;
    const result = {
      path: gcsPath,
      key: destinationKey,
      url,
      gcsPath,
      toString() { return gcsPath; },
      valueOf() { return gcsPath; },
    };
    return result;
  }

  async getSignedDownloadUrl(...args) {
    const { destinationKey, expiresInMinutes } = this._parseDownloadArgs(args);
    const file = this.bucket.file(destinationKey);
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    });
    const res = new String(url);
    res.downloadUrl = url;
    res.url = url;
    return res;
  }

  async getSignedUploadUrl(...args) {
    const { destinationKey, mimetype, expiresInMinutes } = this._parseUploadUrlArgs(args);
    const contentType = mimetype || 'application/octet-stream';
    const file = this.bucket.file(destinationKey);
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + expiresInMinutes * 60 * 1000,
      contentType,
    });
    const gcsPath = `gs://${this.bucketName}/${destinationKey}`;
    const res = new String(url);
    res.uploadUrl = url;
    res.url = url;
    res.gcsPath = gcsPath;
    res.path = gcsPath;
    res.key = destinationKey;
    return res;
  }

  async downloadToBuffer(...args) {
    const destinationKey = this._parseSingleKey(args);
    const file = this.bucket.file(destinationKey);
    const [buffer] = await file.download();
    return buffer;
  }

  async readFile(...args) {
    return await this.downloadToBuffer(...args);
  }

  async deleteFile(...args) {
    const destinationKey = this._parseSingleKey(args);
    const file = this.bucket.file(destinationKey);
    await file.delete({ ignoreNotFound: true });
  }

  async fileExists(...args) {
    const destinationKey = this._parseSingleKey(args);
    const file = this.bucket.file(destinationKey);
    const [exists] = await file.exists();
    return exists;
  }
}

class LocalDiskStorageAdapter {
  constructor(baseDir = path.join(process.cwd(), '.uploads', 'researchhub-storage')) {
    this.baseDir = baseDir;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  _resolveBaseUrl() {
    const raw = process.env.PUBLIC_API_URL || process.env.VITE_API_BASE_URL || '';
    return raw.replace(/\/api\/?$/, '');
  }

  _resolvePath(key) {
    const cleanKey = String(key || '');
    const safeKey = cleanKey.replace(/[\/\\]/g, '_');
    const flatPath = path.join(this.baseDir, safeKey);
    if (fs.existsSync(flatPath)) return flatPath;
    const nestedPath = path.join(this.baseDir, cleanKey);
    if (fs.existsSync(nestedPath)) return nestedPath;
    return flatPath;
  }

  _getFilePath(bucket, key) {
    const targetKey = key || bucket;
    return this._resolvePath(targetKey);
  }

  _parseUploadArgs(args) {
    if (args.length >= 4) {
      return { destinationKey: args[1], buffer: args[2], mimetype: args[3] };
    }
    if (args.length === 3) {
      if (Buffer.isBuffer(args[1])) {
        return { destinationKey: args[0], buffer: args[1], mimetype: args[2] };
      }
      return { destinationKey: args[1], buffer: args[2], mimetype: 'application/octet-stream' };
    }
    if (args.length === 2) {
      return { destinationKey: args[0], buffer: args[1], mimetype: 'application/octet-stream' };
    }
    return { destinationKey: args[0], buffer: Buffer.from(''), mimetype: 'application/octet-stream' };
  }

  _parseSingleKey(args) {
    if (args.length >= 2 && typeof args[1] === 'string' && (args[0] === 'researchhub-storage' || args[0].startsWith('rh-') || args[0].endsWith('-storage'))) {
      return args[1];
    }
    return args[0];
  }

  async uploadFile(...args) {
    const { destinationKey, buffer } = this._parseUploadArgs(args);
    const filePath = this._resolvePath(destinationKey);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await fs.promises.writeFile(filePath, buffer);
    const gcsPath = `gs://researchhub-storage/${destinationKey}`;
    const baseUrl = this._resolveBaseUrl();
    const url = `${baseUrl}/api/storage/download?key=${encodeURIComponent(destinationKey)}`;
    const res = {
      path: filePath,
      gcsPath,
      key: destinationKey,
      url,
      toString() { return gcsPath; },
      valueOf() { return gcsPath; },
    };
    return res;
  }

  async getSignedDownloadUrl(...args) {
    const destinationKey = this._parseSingleKey(args);
    const baseUrl = this._resolveBaseUrl();
    const url = `${baseUrl}/api/storage/download?key=${encodeURIComponent(destinationKey)}`;
    const res = new String(url);
    res.downloadUrl = url;
    res.url = url;
    return res;
  }

  async getSignedUploadUrl(...args) {
    const destinationKey = this._parseSingleKey(args);
    const baseUrl = this._resolveBaseUrl();
    const url = `${baseUrl}/api/storage/upload?key=${encodeURIComponent(destinationKey)}`;
    const gcsPath = `gs://researchhub-storage/${destinationKey}`;
    const res = new String(url);
    res.uploadUrl = url;
    res.url = url;
    res.gcsPath = gcsPath;
    res.path = gcsPath;
    res.key = destinationKey;
    return res;
  }

  async downloadToBuffer(...args) {
    const destinationKey = this._parseSingleKey(args);
    const filePath = this._resolvePath(destinationKey);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return await fs.promises.readFile(filePath);
  }

  async readFile(...args) {
    return await this.downloadToBuffer(...args);
  }

  async deleteFile(...args) {
    const destinationKey = this._parseSingleKey(args);
    const p = this._resolvePath(destinationKey);
    if (fs.existsSync(p)) await fs.promises.unlink(p);
  }

  async fileExists(...args) {
    const destinationKey = this._parseSingleKey(args);
    const filePath = this._resolvePath(destinationKey);
    return fs.existsSync(filePath);
  }
}

let storageInstance = null;

function getStorageAdapter() {
  const bucket = process.env.GCS_BUCKET || process.env.STORAGE_BUCKET;
  if (bucket) {
    return new GoogleCloudStorageAdapter(bucket);
  }
  if (!storageInstance) {
    storageInstance = new LocalDiskStorageAdapter();
  }
  return storageInstance;
}

module.exports = {
  getStorageAdapter,
  GoogleCloudStorageAdapter,
  LocalDiskStorageAdapter,
};
