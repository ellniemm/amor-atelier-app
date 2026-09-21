import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { readSheet, appendRow, appendMissingHeaders } from "@/lib/googleSheets";
import {
  EDITING_SINCE_HEADER,
  isEditingStatus,
  isChoiceHeader,
  todayIndonesian,
} from "@/lib/sheetFields";

const SHEET = process.env.SHEET_TAB_ORDERS || "Order List";

function matchStatusHeader(headers) {
  return headers.find((h) => h.toLowerCase().includes("status")) || null;
}

// Kumpulkan opsi dropdown dari nilai unik yang sudah ada di sheet
// (Status, Package, dll.).
function collectChoiceOptions(headers, rows) {
  const map = {};
  headers.forEach((h) => {
    if (!isChoiceHeader(h)) return;
    const set = new Set();
    rows.forEach((r) => {
      const v = String(r[h] || "").trim();
      if (v) set.add(v);
    });
    map[h] = Array.from(set);
  });
  return map;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { headers, rows } = await readSheet(SHEET);
    const choiceOptions = collectChoiceOptions(headers, rows);
    return NextResponse.json({ headers, rows, choiceOptions });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
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

    // Kalau pesanan baru langsung berstatus editing, catat tanggal mulainya.
    const statusHeader = matchStatusHeader(headers);
    if (
      statusHeader &&
      isEditingStatus(values[statusHeader]) &&
      !values[EDITING_SINCE_HEADER]
    ) {
      values[EDITING_SINCE_HEADER] = todayIndonesian();
    }

    await appendRow(SHEET, headers, values);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
