import { readSheet } from "@/lib/googleSheets";
import OrderForm from "@/components/OrderForm";
import OrderList from "@/components/OrderList";

const SHEET = process.env.SHEET_TAB_ORDERS || "Order List";
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
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
        Gagal memuat Order List: {loadError}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-6">
      <OrderForm headers={headers} rows={rows} />
      <OrderList headers={headers} rows={[...rows].reverse()} />
    </div>
  );
}
