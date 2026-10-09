import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { uploadFilesToFolder } from "@/lib/googleDrive";

// POST /api/upload — menerima multipart form-data:
//   - "files": satu atau beberapa file (foto/PDF)
//   - "prefix": opsional, prefix nama file (mis. nama pesanan)
// Aturan: ≥2 foto (JPEG/PNG) digabung jadi 1 PDF; PDF & file lain diupload
// apa adanya. Mengembalikan { links: [...] } (dan "link" = links[0] untuk
// kompatibilitas).
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const form = await req.formData();

    let files = form
      .getAll("files")
      .filter((f) => typeof f !== "string");
    if (files.length === 0) {
      const single = form.get("file");
      if (single && typeof single !== "string") files = [single];
    }
    if (files.length === 0) {
      return NextResponse.json(
        { error: "File tidak ditemukan." },
        { status: 400 }
      );
    }

    const prefix = String(form.get("prefix") || "").trim();
    const links = await uploadFilesToFolder(files, prefix);
    return NextResponse.json({ links, link: links[0] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
