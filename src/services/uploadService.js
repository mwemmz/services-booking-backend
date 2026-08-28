const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

const ensureDir = () => {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
};

const MIME_EXTENSION = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'image/heic': '.heic',
};

/**
 * Decode a base64 string and write it to the server disk (free hosted upload,
 * no Cloudinary). Returns the public path.
 * Accepts either "data:image/png;base64,..." or a raw base64 string.
 * Limit to 5MB.
 */
const saveBase64File = (dataUri, { maxBytes = 5 * 1024 * 1024 } = {}) => {
  ensureDir();

  let mime = '';
  let base64 = dataUri;

  const match = dataUri.match(/^data:([^;,]+);base64,(.*)$/s);
  if (match) {
    mime = match[1];
    base64 = match[2];
  }

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > maxBytes) {
    const err = new Error(`File exceeds ${Math.round(maxBytes / 1024 / 1024)}MB limit.`);
    err.statusCode = 413;
    throw err;
  }

  const ext = MIME_EXTENSION[mime] || '.bin';
  const filename = `${uuidv4()}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);

  return `/uploads/${filename}`;
};

const publicPathFor = (pathOrUrl) => {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  return pathOrUrl;
};

module.exports = { saveBase64File, publicPathFor, UPLOAD_DIR };
