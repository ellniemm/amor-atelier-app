export default function OrderList({ headers, rows }) {
  return (
    <div>
      <h2 className="font-display text-lg mb-3">Daftar pesanan</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-ink/50">Belum ada pesanan.</p>
      ) : (
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left text-ink/40 text-xs border-b border-line">
                {headers.map((h) => (
                  <th key={h} className="py-2 pr-4 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, i) => (
                <tr key={i}>
                  {headers.map((h) => (
                    <td key={h} className="py-2 pr-4 whitespace-nowrap">
                      {r[h]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
