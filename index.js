const express = require("express");
const { exec } = require("child_process");
const app = express();
app.use(express.json());

app.post("/generate", (req, res) => {
  const { imageUrl, audioUrl, fileName } = req.body;

  const output = `${fileName || "output"}.mp4`;

  const command = `ffmpeg -y -loop 1 -i "${imageUrl}" -i "${audioUrl}" -c:v libx264 -t 11 -pix_fmt yuv420p -c:a aac -shortest public/${output}`;

  exec(command, (err) => {
    if (err) return res.status(500).send(err.message);
    return res.json({ videoUrl: `https://${req.hostname}/public/${output}` });
  });
});

app.use("/public", express.static("public"));

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
