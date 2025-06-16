const express = require('express');
const multer  = require('multer');
const upload = multer();
const fs      = require('fs');
const path    = require('path');
const ffmpeg  = require('fluent-ffmpeg');

const app = express();
const TMP = '/tmp';

app.post('/render', upload.fields([
  { name: 'audio' }, { name: 'image' }
]), (req, res) => {
  try {
    const aac = path.join(TMP,'audio.aac');
    const img = path.join(TMP,'image.jpg');
    const out = path.join(TMP,'output.mp4');
    fs.writeFileSync(aac, req.files.audio[0].buffer);
    fs.writeFileSync(img, req.files.image[0].buffer);
    ffmpeg()
      .input(img).loop(1)
      .input(aac)
      .outputOptions([
        '-c:v libx264','-tune stillimage',
        '-c:a aac','-b:a 192k','-pix_fmt yuv420p','-shortest'
      ])
      .save(out)
      .on('end', () => {
        res.sendFile(out, () => {
          [aac,img,out].forEach(f=>fs.unlinkSync(f));
        });
      })
      .on('error', e => res.status(500).send(e.message));
  } catch (e) {
    res.status(500).send(e.toString());
  }
});

const PORT = process.env.PORT||3000;
app.listen(PORT, ()=>console.log(`Listening ${PORT}`));
