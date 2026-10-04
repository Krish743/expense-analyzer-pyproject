import { useEffect, useState } from "react";
import { get, patch, del, fmt } from "../api";

export default function Transactions({ profileId }: { profileId: number }) {
  const [txns, setTxns] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);

  const reload = () => {
    const params = new URLSearchParams();
    params.set("profile_id", String(profileId));
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    get<any[]>(`/transactions?${params}`).then(setTxns);
  };
  useEffect(() => { get<any>("/meta").then(m => setCategories(m.categories)); }, []);
  useEffect(reload, [q, category, profileId]);

  const exportCsv = () => {
    const header = "date,description,amount,category,type\n";
    const rows = txns.map(t => `${t.date},"${t.description}",${t.amount},${t.category},${t.type}`).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([header + rows], { type: "text/csv" }));
    a.download = "transactions.csv";
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Transactions</h2>
        <button onClick={exportCsv} className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700">Export CSV</button>
      </div>
      <div className="flex gap-3">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm" />
        <select value={category} onChange={e => setCategory(e.target.value)} className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm">
          <option value="">All categories</option>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-slate-500"><th className="pb-2">Date</th><th>Description</th><th>Category</th><th className="text-right">Amount</th><th></th></tr></thead>
        <tbody>
          {txns.map(t => (
            <tr key={t.id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-2">{t.date}</td><td>{t.description}</td>
              <td>
                <select value={t.category} onChange={async e => { await patch(`/transactions/${t.id}?category=${encodeURIComponent(e.target.value)}`); reload(); }} className="bg-transparent">
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </td>
              <td className={`text-right ${t.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>{fmt(Math.abs(t.amount))}</td>
              <td className="text-right"><button onClick={async () => { await del(`/transactions/${t.id}`); reload(); }} className="text-slate-400 hover:text-rose-600">Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
