// index.js
const express = require('express');
const multer  = require('multer');
const upload = multer();
const fs      = require('fs');
const path    = require('path');
const ffmpeg  = require('fluent-ffmpeg');

const app = express();
const TMP = '/tmp';

app.post('/render', upload.any(), (req, res) => {
  console.log('--- /render called ---');
  console.log('Fields received:', req.files.map(f => f.fieldname, f.mimetype));

  // Trouver le fichier image & audio
  const imgFile = req.files.find(f => f.mimetype.startsWith('image/'));
  const audFile = req.files.find(f => f.mimetype.startsWith('audio/'));

  if (!imgFile || !audFile) {
    return res.status(400).send('Besoin d’un fichier image et d’un fichier audio.');
  }

  // Déduire les extensions
  const imgExt  = path.extname(imgFile.originalname) || '.jpg';
  const audExt  = path.extname(audFile.originalname) || '.aac';

  const imgPath  = path.join(TMP, `image${imgExt}`);
  const audPath  = path.join(TMP, `audio${audExt}`);
  const outPath  = path.join(TMP, 'output.mp4');

  // Écrire sur le disque
  fs.writeFileSync(imgPath, imgFile.buffer);
  fs.writeFileSync(audPath, audFile.buffer);
  console.log(`Wrote files: ${imgPath}, ${audPath}`);

  // Récupérer la durée de l’audio
  ffmpeg.ffprobe(audPath, (err, meta) => {
    if (err) {
      console.error('ffprobe error:', err);
      return res.status(500).send('ffprobe failed: ' + err.message);
    }
    const duration = meta.format.duration;
    console.log('Audio duration:', duration, 's');

    // Générer la vidéo
    ffmpeg()
      .input(imgPath).loop(duration)
      .input(audPath)
      .outputOptions([
        '-c:v libx264',
        '-tune stillimage',
        '-c:a aac',
        '-b:a 192k',
        '-pix_fmt yuv420p'
      ])
      .duration(duration)
      .on('start', cmd => console.log('FFmpeg cmd:', cmd))
      .on('stderr', line => console.error('FFmpeg stderr:', line))
      .on('end', () => {
        console.log('Rendering done, sending file');
        res.sendFile(outPath, () => {
          // Cleanup
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
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
