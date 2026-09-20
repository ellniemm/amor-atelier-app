import { readSheet, matchHeader } from "@/lib/googleSheets";
import TransactionForm from "@/components/TransactionForm";
import TransactionList from "@/components/TransactionList";

const SHEET = process.env.SHEET_TAB_PEMBUKUAN || "Pembukuan";
export const dynamic = "force-dynamic";

export default async function PembukuanPage() {
  let headers = [];
  let rows = [];
  let loadError = null;

  try {
    const data = await readSheet(SHEET);
    headers = data.headers;
    rows = data.rows;
  } catch (err) {
    loadError = err.message;
  }

  if (loadError) {
    return (
      <div className="mt-6 rounded-xl border border-outcome/30 bg-outcome/5 p-4 text-sm text-outcome">
        Gagal memuat Pembukuan: {loadError}
      </div>
    );
  }

  const saldoHeader = matchHeader(headers, "SALDO");
  const currentSaldo =
    rows.length > 0 && saldoHeader ? Number(rows[rows.length - 1][saldoHeader]) || 0 : 0;

  return (
    <div className="mt-2 space-y-6">
      <TransactionForm currentSaldo={currentSaldo} />
      <TransactionList headers={headers} rows={[...rows].reverse()} />
    </div>
  );
}
