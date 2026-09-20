import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { readSheet, appendRow } from "@/lib/googleSheets";

const SHEET = process.env.SHEET_TAB_ORDERS || "Order List";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { headers, rows } = await readSheet(SHEET);
    return NextResponse.json({ headers, rows });
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
    const { headers } = await readSheet(SHEET);
    await appendRow(SHEET, headers, values);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
