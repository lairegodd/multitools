import React, { useState } from "react";

const API_BASE = "http://localhost:4000/api";

function useUploadWithProgress() {
  const [progress, setProgress] = useState(0);

  const send = (url, formData) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.responseType = "json";
      xhr.setRequestHeader("Accept", "application/json");

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setProgress(100);
          resolve(xhr.response);
        } else {
          reject(xhr.response || { error: "Upload failed" });
        }
      };

      xhr.onerror = () => reject({ error: "Network error" });
      xhr.send(formData);
    });

  const reset = () => setProgress(0);

  return { progress, send, reset };
}

function downloadDataUrl(fileName, dataUrl) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ---------- TOOLS COMPONENTS ----------

function DocxPdfTool() {
  const [file, setFile] = useState(null);
  const [direction, setDirection] = useState("docx-to-pdf");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const { progress, send, reset } = useUploadWithProgress();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    reset();

    if (!file) {
      setError("Please choose a file first.");
      return;
    }

    const endpoint =
      direction === "docx-to-pdf"
        ? `${API_BASE}/convert/docx-to-pdf`
        : `${API_BASE}/convert/pdf-to-docx`;

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await send(endpoint, fd);
      if (res.error) throw new Error(res.error);
      setResult(res);
    } catch (err) {
      setError(err.message || "Conversion failed.");
    }
  };

  return (
    <div className="card mb-4">
      <div className="card-header">DOCX ↔ PDF Converter</div>
      <div className="card-body">
        <form onSubmit={handleSubmit}>
          <div className="mb-3 d-flex gap-3">
            <div className="form-check">
              <input
                className="form-check-input"
                type="radio"
                id="docxToPdf"
                checked={direction === "docx-to-pdf"}
                onChange={() => setDirection("docx-to-pdf")}
              />
              <label className="form-check-label" htmlFor="docxToPdf">
                DOCX → PDF
              </label>
            </div>
            <div className="form-check">
              <input
                className="form-check-input"
                type="radio"
                id="pdfToDocx"
                checked={direction === "pdf-to-docx"}
                onChange={() => setDirection("pdf-to-docx")}
              />
              <label className="form-check-label" htmlFor="pdfToDocx">
                PDF → DOCX
              </label>
            </div>
          </div>

          <div className="mb-3">
            <input
              type="file"
              className="form-control"
              accept={direction === "docx-to-pdf" ? ".docx" : ".pdf"}
              onChange={(e) => setFile(e.target.files[0] || null)}
            />
          </div>

          {progress > 0 && progress < 100 && (
            <div className="mb-3">
              <div className="progress">
                <div
                  className="progress-bar"
                  role="progressbar"
                  style={{ width: `${progress}%` }}
                >
                  {progress}%
                </div>
              </div>
            </div>
          )}

          <button type="submit" className="btn btn-primary">
            Convert
          </button>
        </form>

        {error && <div className="alert alert-danger mt-3">{error}</div>}

        {result && (
          <div className="alert alert-success mt-3">
            <p>Conversion successful.</p>
            <button
              className="btn btn-sm btn-success"
              onClick={() => downloadDataUrl(result.fileName, result.dataUrl)}
            >
              Download {result.fileName}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ImageCompressionTool() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const { progress, send, reset } = useUploadWithProgress();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    reset();

    if (!file) {
      setError("Please choose an image.");
      return;
    }

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await send(`${API_BASE}/image/compress`, fd);
      if (res.error) throw new Error(res.error);
      setResult(res);
    } catch (err) {
      setError(err.message || "Compression failed.");
    }
  };

  return (
    <div className="card mb-4">
      <div className="card-header">Image Compression</div>
      <div className="card-body">
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <input
              type="file"
              className="form-control"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files[0] || null)}
            />
          </div>

          {progress > 0 && progress < 100 && (
            <div className="mb-3">
              <div className="progress">
                <div
                  className="progress-bar"
                  role="progressbar"
                  style={{ width: `${progress}%` }}
                >
                  {progress}%
                </div>
              </div>
            </div>
          )}

          <button className="btn btn-primary" type="submit">
            Compress
          </button>
        </form>

        {error && <div className="alert alert-danger mt-3">{error}</div>}

        {result && (
          <div className="mt-3">
            <p>
              Original: {(result.originalSize / 1024).toFixed(1)} KB | Compressed:{" "}
              {(result.compressedSize / 1024).toFixed(1)} KB
            </p>
            <p>
              Ratio: {(result.compressionRatio * 100).toFixed(1)}% of original size
            </p>
            <img
              src={result.dataUrl}
              alt="Compressed"
              className="img-fluid border"
              style={{ maxHeight: "200px" }}
            />
            <div className="mt-2">
              <button
                className="btn btn-sm btn-success"
                onClick={() => downloadDataUrl(result.fileName, result.dataUrl)}
              >
                Download {result.fileName}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function QrTool() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleGenerate = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!url.trim()) {
      setError("URL is required.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/url/qr`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "QR generation failed");
      setResult(data);
    } catch (err) {
      setError(err.message || "QR generation failed.");
    }
  };

  return (
    <div className="card mb-4">
      <div className="card-header">URL → QR Code</div>
      <div className="card-body">
        <form onSubmit={handleGenerate}>
          <div className="mb-3">
            <input
              type="url"
              className="form-control"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" type="submit">
            Generate QR
          </button>
        </form>

        {error && <div className="alert alert-danger mt-3">{error}</div>}

        {result && (
          <div className="mt-3 text-center">
            <img
              src={result.dataUrl}
              alt="QR"
              className="img-fluid border"
              style={{ maxHeight: "250px" }}
            />
            <div className="mt-2">
              <button
                className="btn btn-sm btn-success"
                onClick={() => downloadDataUrl(result.fileName, result.dataUrl)}
              >
                Download {result.fileName}
              </button>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AudioTool() {
  const [file, setFile] = useState(null);
  const [targetFormat, setTargetFormat] = useState("mp3");
  const [bitrate, setBitrate] = useState("192k");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const { progress, send, reset } = useUploadWithProgress();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    reset();

    if (!file) {
      setError("Please choose an audio file.");
      return;
    }

    const fd = new FormData();
    fd.append("file", file);
    fd.append("targetFormat", targetFormat);
    fd.append("bitrate", bitrate);

    try {
      const res = await send(`${API_BASE}/audio/convert`, fd);
      if (res.error) throw new Error(res.error);
      setResult(res);
    } catch (err) {
      setError(err.message || "Audio conversion failed.");
    }
  };

  return (
    <div className="card mb-4">
      <div className="card-header">Audio Conversion</div>
      <div className="card-body">
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <input
              type="file"
              className="form-control"
              accept=".flac,.ogg,.wav,.aac,.m4a"
              onChange={(e) => setFile(e.target.files[0] || null)}
            />
          </div>

          <div className="mb-3 row">
            <div className="col-md-6">
              <label className="form-label">Target format</label>
              <select
                className="form-select"
                value={targetFormat}
                onChange={(e) => setTargetFormat(e.target.value)}
              >
                <option value="mp3">MP3</option>
                <option value="aac">AAC</option>
                <option value="wav">WAV</option>
                <option value="ogg">OGG</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label">Bitrate</label>
              <select
                className="form-select"
                value={bitrate}
                onChange={(e) => setBitrate(e.target.value)}
              >
                <option value="128k">128 kbps</option>
                <option value="192k">192 kbps</option>
                <option value="256k">256 kbps</option>
                <option value="320k">320 kbps</option>
              </select>
            </div>
          </div>

          {progress > 0 && progress < 100 && (
            <div className="mb-3">
              <div className="progress">
                <div
                  className="progress-bar"
                  role="progressbar"
                  style={{ width: `${progress}%` }}
                >
                  {progress}%
                </div>
              </div>
            </div>
          )}

          <button className="btn btn-primary" type="submit">
            Convert
          </button>
        </form>

        {error && <div className="alert alert-danger mt-3">{error}</div>}

        {result && (
          <div className="alert alert-success mt-3">
            <p>
              Converted to <strong>{result.targetFormat}</strong> at{" "}
              <strong>{result.bitrate}</strong>. Size:{" "}
              {(result.size / 1024).toFixed(1)} KB
            </p>
            <button
              className="btn btn-sm btn-success"
              onClick={() => downloadDataUrl(result.fileName, result.dataUrl)}
            >
              Download {result.fileName}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function BMITool() {
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleCalc = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);

    const h = Number(height);
    const w = Number(weight);
    if (!h || !w || h <= 0 || w <= 0) {
      setError("Height and weight must be positive numbers.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/calc/bmi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heightCm: h, weightKg: w }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "BMI calculation failed");
      setResult(data);
    } catch (err) {
      setError(err.message || "BMI calculation failed.");
    }
  };

  return (
    <div className="card mb-4">
      <div className="card-header">BMI Calculator</div>
      <div className="card-body">
        <form onSubmit={handleCalc}>
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label className="form-label">Height (cm)</label>
              <input
                type="number"
                className="form-control"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Weight (kg)</label>
              <input
                type="number"
                className="form-control"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
          </div>
          <button className="btn btn-primary" type="submit">
            Calculate
          </button>
        </form>

        {error && <div className="alert alert-danger mt-3">{error}</div>}

        {result && (
          <div className="alert alert-info mt-3">
            <p>
              BMI: <strong>{result.bmi}</strong> ({result.category})
            </p>
            <p>{result.message}</p>
            <hr />
            <p className="mb-0">
              Ranges: Underweight {result.ranges.Underweight}, Normal{" "}
              {result.ranges.Normal}, Overweight {result.ranges.Overweight},
              Obesity {result.ranges.Obesity}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- MAIN APP ----------

export default function App() {
  return (
    <>
      <nav className="navbar navbar-dark bg-dark mb-4">
        <div className="container">
          <span className="navbar-brand">Multitools Utility</span>
        </div>
      </nav>

      <div className="container mb-5">
        <div className="row">
          <div className="col-lg-6">
            <DocxPdfTool />
          </div>
          <div className="col-lg-6">
            <ImageCompressionTool />
          </div>
        </div>

        <div className="row">
          <div className="col-lg-6">
            <QrTool />
          </div>
          <div className="col-lg-6">
            <AudioTool />
          </div>
        </div>

        <div className="row">
          <div className="col-lg-6">
            <BMITool />
          </div>
        </div>
      </div>
    </>
  );
}
