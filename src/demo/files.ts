// Demo-only file contents, generated in the browser so the demo ships no media: photos are drawn on a canvas,
// voice messages are a short synthesized tone, documents are a one-page PDF with the file name.
import type { CorpMediaKind } from '../teletwin/api';

export interface DemoFile {
  kind: CorpMediaKind;
  label?: string;
  colors?: [string, string];
  mime?: string;
  fileName?: string;
  duration?: number;
  width?: number;
  height?: number;
}

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const JPEG_QUALITY = 0.82;
const SAMPLE_RATE = 8000;
const WAV_HEADER_SIZE = 44;
const TONE_HZ = 220;
const TONE_VOLUME = 18;
const BYTE_MIDDLE = 128;

export function buildDemoFile(file: DemoFile): Promise<Blob> {
  switch (file.kind) {
    case 'photo':
      return drawPhoto(file);
    case 'voice':
    case 'audio':
      return Promise.resolve(buildWav(file.duration || 1));
    default:
      return Promise.resolve(buildPdf(file.fileName || 'hujjat.pdf', file.mime));
  }
}

async function drawPhoto(file: DemoFile) {
  const width = file.width || DEFAULT_WIDTH;
  const height = file.height || DEFAULT_HEIGHT;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const [from, to] = file.colors || ['#3557e0', '#7fb2ff'];
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Soft shapes, so photos read as pictures rather than flat cards
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 7; i++) {
    const radius = (Math.min(width, height) / 5) * (1 + (i % 3) * 0.6);
    ctx.beginPath();
    ctx.arc(((i * 0.29 + 0.1) % 1) * width, ((i * 0.43 + 0.2) % 1) * height, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, height * 0.72, width, height * 0.28);
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(height * 0.085)}px system-ui, sans-serif`;
  ctx.fillText(file.label || 'Orzu Logistika', width * 0.06, height * 0.86, width * 0.88);
  ctx.font = `500 ${Math.round(height * 0.04)}px system-ui, sans-serif`;
  ctx.globalAlpha = 0.85;
  ctx.fillText('Orzu Logistika · namuna rasm', width * 0.06, height * 0.1, width * 0.88);

  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', JPEG_QUALITY);
  });
}

function buildWav(seconds: number) {
  const samples = Math.round(seconds * SAMPLE_RATE);
  const buffer = new ArrayBuffer(WAV_HEADER_SIZE + samples);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeText(36, 'data');
  view.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) {
    // A quiet tone with a syllable-like envelope
    const envelope = Math.abs(Math.sin((i / SAMPLE_RATE) * Math.PI * 2.5));
    const value = Math.sin((i / SAMPLE_RATE) * Math.PI * 2 * TONE_HZ) * TONE_VOLUME * envelope;
    view.setUint8(WAV_HEADER_SIZE + i, Math.round(BYTE_MIDDLE + value));
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function buildPdf(fileName: string, mime?: string) {
  const title = fileName.replace(/[()\\]/g, '');
  const stream = `BT /F1 20 Tf 60 760 Td (${title}) Tj ET `
    + 'BT /F1 12 Tf 60 730 Td (Orzu Logistika - namuna hujjat) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  return new Blob([body], { type: mime?.includes('pdf') ? mime : 'application/pdf' });
}
