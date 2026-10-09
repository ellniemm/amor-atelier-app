// Upload file ke folder Google Drive pribadi user.
//
// PENTING — kuota storage: Service Account TIDAK punya kuota storage
// ("Service Accounts do not have storage quota"). Karena itu upload
// dijalankan atas nama akun Google user via OAuth (delegation):
//   1. Jalankan sekali:  node scripts/get-drive-token.js
//      → buka link, login Gmail, izinkan → refresh token tercetak.
//   2. Simpan refresh token di env GOOGLE_OAUTH_REFRESH_TOKEN.
// Upload berikutnya otomatis menukar refresh token dengan access token,
// tanpa perlu login lagi. File jadi milik akun user (masuk kuota Drive
// pribadi user) dan langsung berada di folder GOOGLE_DRIVE_FOLDER_ID.
//
// Kalau var OAuth belum diisi, fallback ke service account (berguna kalau
// suatu saat pindah ke Google Workspace dengan Shared Drive).
//
// Konversi foto → PDF: kalau yang diupload ≥2 foto (JPEG/PNG), semuanya
// digabung jadi SATU file PDF sebelum diupload. File PDF diupload apa
// adanya. Foto tunggal & format lain (HEIC, WEBP, dst.) diupload apa adanya.
import { google } from "googleapis";
import { PDFDocument } from "pdf-lib";
import { Readable } from "stream";

// Tipe gambar yang bisa disisipkan ke PDF oleh pdf-lib.
const EMBEDDABLE_IMAGE_MIMES = ["image/jpeg", "image/jpg", "image/png"];

function getOAuthClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) return null;

  const auth = new google.auth.OAuth2({ clientId, clientSecret });
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}

function getServiceAccountAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!email || !key) {
    throw new Error(
      "Kredensial Google belum diatur di environment variables (OAuth atau Service Account)."
    );
  }

  return new google.auth.JWT({
    email,
    key,
    // Scope "drive" supaya bisa menulis ke folder yang di-share ke
    // service account (jalur Shared Drive di Workspace).
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

function getDriveClient() {
  const oauth = getOAuthClient();
  if (oauth) return google.drive({ version: "v3", auth: oauth });
  return google.drive({ version: "v3", auth: getServiceAccountAuth() });
}

// Set permission "anyone with link = reader" — hanya perlu di jalur
// service account (via OAuth file sudah milik user, sharing folder user
// yang menentukan siapa yang bisa buka).
async function setAnyoneWithLinkReader(drive, fileId) {
  try {
    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
      supportsAllDrives: true,
    });
  } catch {
    // Abaikan — link tetap dikembalikan.
  }
}

// Upload satu buffer ke folder. Mengembalikan webViewLink.
async function uploadBuffer({ folderId, name, mimeType, buffer }) {
  const drive = getDriveClient();

  const res = await drive.files.create({
    requestBody: { name, parents: [folderId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  const fileId = res.data.id;
  if (!getOAuthClient()) await setAnyoneWithLinkReader(drive, fileId);

  return res.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
}

function timestampName(prefix, name) {
  const safeName = String(name || "file").replace(/[/\\]/g, "-");
  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19); // yyyy-mm-ddThh-mm-ss

  return prefix ? `${prefix} - ${ts} - ${safeName}` : `${ts} - ${safeName}`;
}

// Gabungkan banyak foto (JPEG/PNG) jadi satu PDF. Tiap foto jadi satu
// halaman dengan ukuran = ukuran foto (tanpa margin/crop).
async function buildPdfFromImages(imageFiles) {
  const pdf = await PDFDocument.create();
  for (const f of imageFiles) {
    const bytes = Buffer.from(await f.arrayBuffer());
    const img =
      (f.type || "").toLowerCase() === "image/png"
        ? await pdf.embedPng(bytes)
        : await pdf.embedJpg(bytes);
    const page = pdf.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  return Buffer.from(await pdf.save());
}

function requireFolderId() {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new Error(
      "GOOGLE_DRIVE_FOLDER_ID belum diatur di environment variables."
    );
  }
  return folderId;
}

// Upload satu file apa adanya. Mengembalikan webViewLink.
export async function uploadFileToFolder(file, prefix = "") {
  const folderId = requireFolderId();
  const buffer = Buffer.from(await file.arrayBuffer());
  return uploadBuffer({
    folderId,
    name: timestampName(prefix, file.name),
    mimeType: file.type || "application/octet-stream",
    buffer,
  });
}

// Upload sekumpulan file sesuai aturan moodboard:
// - ≥2 foto (JPEG/PNG) → digabung jadi 1 PDF, lalu diupload.
// - 1 foto → diupload apa adanya.
// - PDF / format lain → diupload apa adanya (satu per satu).
// Mengembalikan array of webViewLink (urut sesuai urutan upload).
export async function uploadFilesToFolder(fileList, prefix = "") {
  const folderId = requireFolderId();
  const files = Array.from(fileList);

  const photos = files.filter((f) =>
    EMBEDDABLE_IMAGE_MIMES.includes(String(f.type || "").toLowerCase())
  );
  const others = files.filter(
    (f) => !EMBEDDABLE_IMAGE_MIMES.includes(String(f.type || "").toLowerCase())
  );

  const links = [];

  if (photos.length >= 2) {
    const pdfBuffer = await buildPdfFromImages(photos);
    links.push(
      await uploadBuffer({
        folderId,
        name: timestampName(prefix, "moodboard.pdf"),
        mimeType: "application/pdf",
        buffer: pdfBuffer,
      })
    );
  } else {
    // Foto tunggal: tidak ada yang perlu digabung — upload apa adanya.
    for (const f of photos) {
      links.push(await uploadFileToFolder(f, prefix));
    }
  }

  for (const f of others) {
    links.push(await uploadFileToFolder(f, prefix));
  }

  return links;
}
