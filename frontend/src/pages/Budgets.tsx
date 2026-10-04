import { useEffect, useState } from "react";
import { get, post, del, fmt, withProfile } from "../api";

export default function Budgets({ profileId }: { profileId: number }) {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");
  const [categories, setCategories] = useState<string[]>([]);

  const reload = () => get<any[]>(withProfile("/budgets", profileId)).then(setBudgets);
  useEffect(() => { get<any>("/meta").then(m => setCategories(m.categories)); reload(); }, [profileId]);

  const add = async () => {
    if (!category || !limit) return;
    await post(withProfile(`/budgets?category=${encodeURIComponent(category)}&monthly_limit=${limit}`, profileId));
    setLimit("");
    reload();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Budgets</h2>
      <div className="flex gap-3">
        <select value={category} onChange={e => setCategory(e.target.value)} className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm">
          <option value="">Category…</option>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <input value={limit} onChange={e => setLimit(e.target.value)} type="number" placeholder="Monthly limit" className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm" />
        <button onClick={add} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm">Add</button>
      </div>
      {budgets.map(b => (
        <div key={b.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex justify-between text-sm gap-2">
            <span className="font-medium">{b.category} <span className="font-normal text-slate-400">· {b.month}</span></span>
            <span className="whitespace-nowrap">{fmt(b.spent)} / {fmt(b.limit)} ({b.pct}%) {b.alert && <span className="ml-2 text-rose-600 font-semibold">Over budget!</span>}</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-800">
            <div className={`h-2 rounded-full ${b.alert ? "bg-rose-500" : "bg-indigo-500"}`} style={{ width: `${Math.min(b.pct, 100)}%` }} />
          </div>
          <button onClick={async () => { await del(`/budgets/${b.id}`); reload(); }} className="mt-2 text-xs text-slate-400 hover:text-rose-600">Remove</button>
        </div>
      ))}
      {budgets.length === 0 && <p className="text-sm text-slate-500">No budgets yet — add one above.</p>}
    </div>
  );
}
