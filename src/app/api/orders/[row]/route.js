import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { readSheet, updateRow, appendMissingHeaders } from "@/lib/googleSheets";
import {
  EDITING_SINCE_HEADER,
  isEditingStatus,
  todayIndonesian,
} from "@/lib/sheetFields";

const SHEET = process.env.SHEET_TAB_ORDERS || "Order List";

// PUT /api/orders/:row — update satu baris pesanan berdasarkan nomor baris
// asli di spreadsheet (properti `_row` dari readSheet).
export async function PUT(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const rowNumber = Number(params.row);
    if (!rowNumber || rowNumber < 2) {
      return NextResponse.json({ error: "Nomor baris tidak valid." }, { status: 400 });
    }

    const body = await req.json();
    const { values } = body;
    if (!values || typeof values !== "object") {
      return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
    }

    let { headers } = await readSheet(SHEET);

    // Kolom "Editing Since" dibuat otomatis di sheet kalau belum ada.
    const missing = [EDITING_SINCE_HEADER].filter((h) => !headers.includes(h));
    if (missing.length > 0) {
      headers = await appendMissingHeaders(SHEET, headers, missing);
    }

    // Sinkron kolom pelacak dengan perubahan status:
    // - status menjadi editing (dan belum ada tanggalnya) → catat hari ini
    // - status keluar dari editing → kosongkan tanggalnya
    const statusHeader = headers.find((h) => h.toLowerCase().includes("status"));
    if (statusHeader && values[statusHeader] !== undefined) {
      const editing = isEditingStatus(values[statusHeader]);
      if (editing && !values[EDITING_SINCE_HEADER]) {
        values[EDITING_SINCE_HEADER] = todayIndonesian();
      } else if (!editing && values[EDITING_SINCE_HEADER] !== undefined) {
        delete values[EDITING_SINCE_HEADER];
      }
    }

    // Hanya kolom yang memang ada di sheet yang ditulis — kolom lain diabaikan.
    const data = {};
    headers.forEach((h) => {
      if (values[h] !== undefined) data[h] = values[h];
    });

    await updateRow(SHEET, rowNumber, headers, data);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
