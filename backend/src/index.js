const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const util = require("util");
const libre = require("libreoffice-convert");
const sharp = require("sharp");
const qrcode = require("qrcode");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");


const app = express();
const PORT = process.env.PORT || 4000;

// ---------- MIDDLEWARE ----------
app.use(
  cors({
    origin: "http://localhost:5173",
  })
);
app.use(express.json());

// Ensure upload dir exists
const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB
  },
});

// Promisified helpers
libre.convertAsync = util.promisify(libre.convert);
const readFileAsync = util.promisify(fs.readFile);
const unlinkAsync = util.promisify(fs.unlink);

// Utility: build data URL JSON
function fileToDataUrlResponse(buffer, mimeType, fileName, extra = {}) {
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;
  return {
    fileName,
    mimeType,
    dataUrl,
    ...extra,
  };
}

// Utility: safe delete
async function safeUnlink(filePath) {
  try {
    await unlinkAsync(filePath);
  } catch (e) {
    console.error("Failed to delete temp file:", filePath, e.message);
  }
}

// ---------- ROUTES ----------

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// 1A. DOCX → PDF
app.post("/api/convert/docx-to-pdf", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const inputPath = req.file.path;
  const outputExt = ".pdf";
  const outputName = `${uuidv4()}${outputExt}`;
  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext !== ".docx") {
      await safeUnlink(inputPath);
      return res.status(400).json({ error: "Only .docx files are allowed" });
    }

    const docxBuf = await readFileAsync(inputPath);
    const pdfBuf = await libre.convertAsync(docxBuf, outputExt, undefined);

    const response = fileToDataUrlResponse(
      pdfBuf,
      "application/pdf",
      req.file.originalname.replace(/\.docx$/i, ".pdf")
    );
    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Conversion failed", details: err.message });
  } finally {
    await safeUnlink(inputPath);
  }
});

// 1A. PDF → DOCX
app.post("/api/convert/pdf-to-docx", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const inputPath = req.file.path;
  const outputExt = ".docx";
  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext !== ".pdf") {
      await safeUnlink(inputPath);
      return res.status(400).json({ error: "Only .pdf files are allowed" });
    }

    const pdfBuf = await readFileAsync(inputPath);
    const docxBuf = await libre.convertAsync(pdfBuf, outputExt, undefined);

    const response = fileToDataUrlResponse(
      docxBuf,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      req.file.originalname.replace(/\.pdf$/i, ".docx")
    );
    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Conversion failed", details: err.message });
  } finally {
    await safeUnlink(inputPath);
  }
});

// 1B. Image compression (JPEG/PNG/WebP)
app.post("/api/image/compress", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const inputPath = req.file.path;
  const originalSize = req.file.size;
  const outputName = `${uuidv4()}.jpg`;

  try {
    const mime = req.file.mimetype;
    if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
      await safeUnlink(inputPath);
      return res.status(400).json({
        error: "Only JPEG, PNG, or WebP images are allowed",
      });
    }

    const compressedBuffer = await sharp(inputPath)
      .jpeg({ quality: 70 })
      .toBuffer();

    const compressedSize = compressedBuffer.length;

    const response = fileToDataUrlResponse(compressedBuffer, "image/jpeg", outputName, {
      originalSize,
      compressedSize,
      compressionRatio: compressedSize / originalSize,
    });
    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Image compression failed", details: err.message });
  } finally {
    await safeUnlink(inputPath);
  }
});

// 1C. URL → QR code
app.post("/api/url/qr", async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    const dataUrl = await qrcode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 300,
    });
    res.json({
      fileName: "qr-code.png",
      mimeType: "image/png",
      dataUrl,
      originalUrl: url,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "QR code generation failed", details: err.message });
  }
});

// 1D. Audio conversion → MP3/AAC/WAV/OGG
app.post("/api/audio/convert", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const inputPath = req.file.path;
  const { targetFormat = "mp3", bitrate = "192k" } = req.body || {};

  const allowedInputTypes = [
    "audio/flac",
    "audio/x-flac",
    "audio/aac",
    "audio/x-aac",
    "audio/wav",
    "audio/x-wav",
    "audio/ogg",
    "audio/x-ogg",
    "audio/alac",
  ];
  const allowedOutputFormats = ["mp3", "aac", "wav", "ogg"];

  const safeFormat = String(targetFormat).toLowerCase();
  if (!allowedOutputFormats.includes(safeFormat)) {
    await safeUnlink(inputPath);
    return res.status(400).json({ error: "Invalid target format" });
  }

  if (!allowedInputTypes.includes(req.file.mimetype)) {
    await safeUnlink(inputPath);
    return res
      .status(400)
      .json({ error: "Unsupported input audio format" });
  }

  const outputPath = path.join(uploadDir, `${uuidv4()}.${safeFormat}`);

  // ffmpeg arguments
  const commonArgs = ["-y", "-i", inputPath, "-vn"]; // -vn = no video
  let formatArgs = [];

  if (safeFormat === "mp3") {
    formatArgs = ["-codec:a", "libmp3lame", "-b:a", bitrate];
  } else if (safeFormat === "aac") {
    formatArgs = ["-codec:a", "aac", "-b:a", bitrate];
  } else if (safeFormat === "wav") {
    formatArgs = ["-codec:a", "pcm_s16le"]; // PCM for WAV
  } else if (safeFormat === "ogg") {
    formatArgs = ["-codec:a", "libvorbis", "-b:a", bitrate];
  }

  const ffArgs = [...commonArgs, ...formatArgs, outputPath];

  try {
    // Run ffmpeg via child_process
    await new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath, ffArgs);

      let stderr = "";
      proc.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      proc.on("error", (err) => reject(err));

      proc.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
        }
      });
    });

    const convertedBuffer = await readFileAsync(outputPath);

    let mimeType = "audio/mpeg";
    if (safeFormat === "aac") mimeType = "audio/aac";
    if (safeFormat === "wav") mimeType = "audio/wav";
    if (safeFormat === "ogg") mimeType = "audio/ogg";

    const response = fileToDataUrlResponse(
      convertedBuffer,
      mimeType,
      req.file.originalname.replace(/\.[^.]+$/, `.${safeFormat}`),
      {
        targetFormat: safeFormat,
        bitrate,
        size: convertedBuffer.length,
      }
    );
    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Audio conversion failed",
      details: err.message,
    });
  } finally {
    await safeUnlink(inputPath);
    await safeUnlink(outputPath).catch(() => {});
  }
});


// 2. BMI Calculator
app.post("/api/calc/bmi", (req, res) => {
  const { heightCm, weightKg } = req.body || {};
  const h = Number(heightCm);
  const w = Number(weightKg);

  if (!h || !w || h <= 0 || w <= 0) {
    return res.status(400).json({ error: "heightCm and weightKg must be positive numbers" });
  }

  const heightM = h / 100;
  const bmi = w / (heightM * heightM);
  let category = "";
  let message = "";

  if (bmi < 18.5) {
    category = "Underweight";
    message = "Your BMI is below the normal range. Consider consulting a nutritionist or doctor.";
  } else if (bmi < 25) {
    category = "Normal";
    message = "Your BMI is in the normal range. Keep maintaining a healthy lifestyle.";
  } else if (bmi < 30) {
    category = "Overweight";
    message = "Your BMI is slightly above the normal range. You may want to review diet and activity.";
  } else {
    category = "Obesity";
    message = "Your BMI is in the obesity range. Please consider consulting a healthcare professional.";
  }

  res.json({
    bmi: Number(bmi.toFixed(2)),
    category,
    message,
    ranges: {
      Underweight: "< 18.5",
      Normal: "18.5 – 24.9",
      Overweight: "25 – 29.9",
      Obesity: "≥ 30",
    },
  });
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
