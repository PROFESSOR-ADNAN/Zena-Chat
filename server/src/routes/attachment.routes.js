import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);

const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Upload endpoint accepting Base64 or JSON payload (supports audio, images, files)
router.post('/upload', async (req, res, next) => {
  try {
    const { data, fileName = 'attachment', mimeType = 'application/octet-stream', type = 'file' } = req.body;

    if (!data) {
      return res.status(400).json({ message: 'No file data provided' });
    }

    // Determine extension
    let ext = path.extname(fileName) || '';
    if (!ext) {
      if (mimeType.includes('image/png')) ext = '.png';
      else if (mimeType.includes('image/jpeg')) ext = '.jpg';
      else if (mimeType.includes('image/webp')) ext = '.webp';
      else if (mimeType.includes('audio/webm')) ext = '.webm';
      else if (mimeType.includes('audio/mp3') || mimeType.includes('audio/mpeg')) ext = '.mp3';
      else if (mimeType.includes('audio/wav')) ext = '.wav';
      else if (mimeType.includes('pdf')) ext = '.pdf';
      else ext = '.bin';
    }

    const fileId = crypto.randomUUID();
    const diskFileName = `${fileId}${ext}`;
    const filePath = path.join(uploadsDir, diskFileName);

    // Strip base64 data prefix if present (e.g. "data:image/png;base64,...")
    const base64Data = data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > 15 * 1024 * 1024) {
      return res.status(400).json({ message: 'File exceeds 15MB limit' });
    }

    await fs.promises.writeFile(filePath, buffer);

    const publicUrl = `/uploads/${diskFileName}`;

    res.json({
      ok: true,
      url: publicUrl,
      fileName,
      fileSize: buffer.length,
      mimeType,
      type: type || (mimeType.startsWith('image/') ? 'image' : mimeType.startsWith('audio/') ? 'audio' : 'file'),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
