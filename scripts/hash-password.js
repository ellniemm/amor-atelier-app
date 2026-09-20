const bcrypt = require("bcryptjs");

const password = process.argv[2];

if (!password) {
  console.log('Pemakaian: npm run hash-password -- "password-kamu"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log("\nHash untuk dimasukkan ke env var (copy semua baris di bawah ini):\n");
console.log(hash);
console.log("");
