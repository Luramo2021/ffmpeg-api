const express = require('express');
const multer  = require('multer');
const upload = multer();
const fs      = require('fs');
const path    = require('path');
const ffmpeg  = require('fluent-ffmpeg');

const app = express();
const TMP = '/tmp';

app.post('/render', upload.fields([
  { name: 'audio' }, 
  { name: 'image' }
]), (req, res) => {
  console.log('--- /render called ---');
  console.log('Files received:', Object.keys(req.files));
  console.log('Audio file info:', req.files.audio?.[0]);
  console.log('Image file info:', req.files.image?.[0]);

  try {
    const aac = path.join(TMP, 'audio.aac');
    const img = path.join(TMP, 'image.jpg');
    const out = path.join(TMP, 'output.mp4');

    console.log(`Writing audio to ${aac}`);
    fs.writeFileSync(aac, req.files.audio[0].buffer);

    console.log(`Writing image to ${img}`);
    fs.writeFileSync(img, req.files.image[0].buffer);

    console.log('Starting FFmpeg processing...');
    ffmpeg()
      .input(img).loop(1)
      .input(aac)
      .outputOptions([
        '-c:v libx264',
        '-tune stillimage',
        '-c:a aac',
        '-b:a 192k',
        '-pix_fmt yuv420p',
        '-shortest',
      ])
      .on('start', commandLine => {
        console.log('FFmpeg command:', commandLine);
      })
      .on('stderr', stderrLine => {
        console.error('FFmpeg stderr:', stderrLine);
      })
      .on('end', () => {
        console.log('FFmpeg processing finished, sending file:', out);
        res.sendFile(out, () => {
          console.log('Cleaning up temp files');
          [aac, img, out].forEach(f => {
            try { fs.unlinkSync(f); console.log('Deleted', f); }
            catch (err) { console.warn('Failed to delete', f, err); }
          });
        });
      })
      .on('error', err => {
        console.error('FFmpeg error:', err);
        res.status(500).send('FFmpeg processing error: ' + err.message);
      })
      .save(out);

  } catch (e) {
    console.error('/render route error:', e);
    res.status(500).send('Server error: ' + e.toString());
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
