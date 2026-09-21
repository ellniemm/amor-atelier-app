// Generate ikon aplikasi dari logo: src/app/favicon.ico, src/app/icon.png,
// src/app/apple-icon.png, dan og image untuk social preview.
// Butuh: npm i -D sharp png-to-ico (install sementara, boleh dihapus lagi)
// Jalankan: node scripts/generate-icons.js [path/ke/logo.jpg]
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const _pngToIco = require("png-to-ico");
const pngToIco = _pngToIco.default || _pngToIco;

const SRC = process.argv[2] || "C:/Users/momo/Documents/mobile/amor-atelier-app/amoratelier.jpg";
const OUT_DIR = path.join(__dirname, "..", "src", "app");

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`File sumber tidak ditemukan: ${SRC}`);
    process.exit(1);
  }

  // apple-icon.png 180x180 (full, tanpa padding)
  await sharp(SRC)
    .resize(180, 180, { fit: "cover" })
    .png()
    .toFile(path.join(OUT_DIR, "apple-icon.png"));

  // icon.png 512x512 untuk PWA / shortcut
  await sharp(SRC)
    .resize(512, 512, { fit: "cover" })
    .png()
    .toFile(path.join(OUT_DIR, "icon.png"));

  // favicon.ico multi-ukuran 16/32/48
  const icoSource = await sharp(SRC)
    .resize(48, 48, { fit: "cover" })
    .png()
    .toBuffer();
  const ico = await pngToIco(icoSource);
  fs.writeFileSync(path.join(OUT_DIR, "favicon.ico"), ico);

  // og image 1200x630 untuk preview link (logo dipusatkan di atas paper)
  await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: { r: 250, g: 246, b: 241, alpha: 1 }, // paper #FAF6F1
    },
  })
    .composite([
      {
        input: await sharp(SRC).resize(560, 560).png().toBuffer(),
        top: 35,
        left: 320,
      },
    ])
    .jpeg({ quality: 90 })
    .toFile(path.join(OUT_DIR, "opengraph-image.jpg"));

  console.log("Ikon berhasil dibuat di src/app/:");
  console.log("- favicon.ico");
  console.log("- icon.png (512x512)");
  console.log("- apple-icon.png (180x180)");
  console.log("- opengraph-image.jpg (1200x630)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
