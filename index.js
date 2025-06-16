// index.js
const express = require('express');
const multer  = require('multer');
const upload = multer();
const fs      = require('fs');
const path    = require('path');
const ffmpeg  = require('fluent-ffmpeg');

const app = express();
const TMP = '/tmp';

app.get('/', (req, res) => {
  res.send('FFmpeg API is up — POST /render with fields "data" (image) and "audio.aac" (audio)');
});

app.post(
  '/render',
  upload.fields([
    { name: 'data', maxCount: 1 },       // your image binary field
    { name: 'audio.aac', maxCount: 1 },  // your audio binary field
  ]),
  (req, res) => {
    console.log('--- /render called ---');
    console.log('Files received keys:', Object.keys(req.files));
    console.log('Image file info (data):', req.files['data']?.[0]);
    console.log('Audio file info (audio.aac):', req.files['audio.aac']?.[0]);

    try {
      // Determine extensions from original filenames
      const imgFile = req.files['data'][0];
      const audFile = req.files['audio.aac'][0];
      const imgExt = path.extname(imgFile.originalname) || '.jpg';
      const audExt = path.extname(audFile.originalname) || '.aac';

      const imgPath = path.join(TMP, `image${imgExt}`);
      const audPath = path.join(TMP, `audio${audExt}`);
      const outPath = path.join(TMP, 'output.mp4');

      console.log(`Writing image to ${imgPath}`);
      fs.writeFileSync(imgPath, imgFile.buffer);

      console.log(`Writing audio to ${audPath}`);
      fs.writeFileSync(audPath, audFile.buffer);

      console.log('Starting FFmpeg processing...');
      ffmpeg()
        .input(imgPath).loop(1)
        .input(audPath)
        .outputOptions([
          '-c:v libx264',
          '-tune stillimage',
          '-c:a aac',
          '-b:a 192k',
          '-pix_fmt yuv420p',
          '-shortest',
        ])
        .on('start', cmd => console.log('FFmpeg cmd:', cmd))
        .on('stderr', line => console.error('FFmpeg stderr:', line))
        .on('end', () => {
          console.log('FFmpeg done, sending file');
          res.sendFile(outPath, () => {
            console.log('Cleaning up temp files');
            [imgPath, audPath, outPath].forEach(f => {
              try { fs.unlinkSync(f); console.log('Deleted', f); }
              catch (err) { console.warn('Cleanup failed for', f, err); }
            });
          });
        })
        .on('error', err => {
          console.error('FFmpeg error:', err);
          res.status(500).send(`FFmpeg processing error: ${err.message}`);
        })
        .save(outPath);
    } catch (e) {
      console.error('/render catch:', e);
      res.status(500).send(`Server error: ${e.message}`);
    }
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
