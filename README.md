# Multitools Utility (Vite + React + Node/Express)

Small multitools web app:

- DOCX ↔ PDF (server-side using LibreOffice)
- Image compression (sharp)
- URL → QR code (qrcode)
- Audio conversion to MP3/AAC/WAV/OGG (ffmpeg + ffmpeg-static)
- BMI calculator

## 1. Requirements

- Node.js (>= 18)
- NPM or Yarn

### Native dependencies

#### LibreOffice (for DOCX ↔ PDF)

- **Ubuntu/Debian**:

  ```bash
  sudo apt update
  sudo apt install -y libreoffice
