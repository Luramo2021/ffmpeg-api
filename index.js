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
  res.send('FFmpeg API is up — POST /render with fields "data" (image) and "audio.aac" (audio.aac)');
});

app.post(
  '/render',
  upload.fields([
    { name: 'data', maxCount: 1 },
    { name: 'audio.aac', maxCount: 1 },
  ]),
  (req, res) => {
    console.log('--- /render called ---');
    // Vérification rapide
    if (!req.files['data'] || !req.files['audio.aac']) {
      return res.status(400).send('Expecting two fields: data (image) + audio.aac (audio)');
    }

    const imgFile = req.files['data'][0];
    const audFile = req.files['audio.aac'][0];

    // Préparer les chemins/disques
    const imgExt  = path.extname(imgFile.originalname) || '.jpg';
    const audExt  = path.extname(audFile.originalname) || '.aac';
    const imgPath = path.join(TMP, `image${imgExt}`);
    const audPath = path.join(TMP, `audio${audExt}`);
    const outPath = path.join(TMP, 'output.mp4');

    // Écrire les buffers
    fs.writeFileSync(imgPath, imgFile.buffer);
    fs.writeFileSync(audPath, audFile.buffer);
    console.log('Wrote image & audio to temp files');

    // 1) On récupère la durée de l’audio
    ffmpeg.ffprobe(audPath, (err, metadata) => {
      if (err) {
        console.error('ffprobe error:', err);
        return res.status(500).send('ffprobe failed: ' + err.message);
      }

      const duration = metadata.format.duration;
      console.log('Audio duration (s):', duration);

      // 2) On lance FFmpeg en boucle image sur toute cette durée
      ffmpeg()
        .input(imgPath)
        .loop(duration)              // boucle sur TOUTE la durée audio
        .input(audPath)
        .outputOptions([
          '-c:v libx264',
          '-tune stillimage',
          '-c:a aac',
          '-b:a 192k',
          '-pix_fmt yuv420p'
        ])
        .duration(duration)          // assure la bonne durée
        .on('start', cmd => console.log('FFmpeg cmd:', cmd))
        .on('stderr', line => console.error('FFmpeg stderr:', line))
        .on('end', () => {
          console.log('Rendering done, sending file');
          res.sendFile(outPath, () => {
            // Nettoyage
            [imgPath, audPath, outPath].forEach(f => {
              try { fs.unlinkSync(f); console.log('Deleted', f); }
              catch {}
            });
          });
        })
        .on('error', err => {
          console.error('FFmpeg error:', err);
          res.status(500).send('FFmpeg failed: ' + err.message);
        })
        .save(outPath);
    });
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
