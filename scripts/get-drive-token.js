// Skrip ONE-TIME: dapatkan Google OAuth refresh token untuk upload Drive
// atas nama akun kamu (service account tidak punya kuota storage).
//
// Pemakaian:
//   1. Buat OAuth Client di Google Cloud Console (project yang sama dengan
//      service account):
//        APIs & Services → Credentials → Create Credentials → OAuth client ID
//        → Application type: "Web application"
//        → Authorized redirect URIs: http://localhost:3000
//      (OAuth consent screen: External, tambahkan email Gmail kamu sebagai
//       Test user. Scope Drive sudah tercakup oleh scope di bawah.)
//   2. Isi di .env.local:
//        GOOGLE_OAUTH_CLIENT_ID=...apps.googleusercontent.com
//        GOOGLE_OAUTH_CLIENT_SECRET=...
//   3. Jalankan:  node scripts/get-drive-token.js
//      → buka URL yang tercetak di browser, login Gmail, izinkan.
//      Browser akan redirect ke http://localhost:3000/?code=... —
//      salin nilai parameter "code" dari address bar, paste ke terminal.
//   4. Refresh token tercetak → simpan di .env.local:
//        GOOGLE_OAUTH_REFRESH_TOKEN=...
//   5. Selesai. App akan otomatis memakainya untuk upload moodboard.
//
// Catatan: refresh token berlaku lama, kecuali kamu mencabut aksesnya
// (Google Account → Security → Third-party access).

require("dotenv").config({ path: ".env.local" });
const readline = require("readline");
const { google } = require("googleapis");

const REDIRECT_URI = "http://localhost:3000";

async function main() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error(
      "Isi dulu GOOGLE_OAUTH_CLIENT_ID dan GOOGLE_OAUTH_CLIENT_SECRET di .env.local"
    );
    process.exit(1);
  }

  const oauth = new google.auth.OAuth2({ clientId, clientSecret, redirectUri: REDIRECT_URI });

  const scope = "https://www.googleapis.com/auth/drive.file";
  const url = oauth.generateAuthUrl({
    access_type: "offline",
    scope,
    prompt: "consent", // paksa dapat refresh_token walau sudah pernah izin
  });

  console.log("\n1. Buka link ini di browser, login Gmail, klik Izinkan:\n");
  console.log(url);
  console.log(
    "\n2. Setelah izin, kamu diarahkan ke http://localhost:3000/?code=... (halaman app bisa error, tidak masalah)."
  );
  console.log('   Salin nilai parameter "code" dari address bar.\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const code = await new Promise((resolve) => {
    rl.question("3. Paste code di sini: ", resolve);
  });
  rl.close();

  try {
    const { tokens } = await oauth.getToken(code.trim());
    if (!tokens.refresh_token) {
      console.error(
        "\nRefresh token tidak didapat. Jalankan ulang skrip ini (pastikan prompt=consent aktif) dan coba lagi."
      );
      process.exit(1);
    }
    console.log("\nBerhasil! Simpan baris ini di .env.local:\n");
    console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}\n`);
  } catch (err) {
    console.error("\nGagal menukar code dengan token:", err.message);
    process.exit(1);
  }
}

main();
