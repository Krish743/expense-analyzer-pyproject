import { useEffect, useRef, useState } from "react";
import { get, fmt, fmtCompact, upload, withProfile } from "../api";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from "recharts";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec4899", "#84cc16", "#f97316", "#64748b"];

export default function Dashboard({ profileId }: { profileId: number }) {
  const [summary, setSummary] = useState<any>();
  const [byCat, setByCat] = useState<any[]>([]);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [top, setTop] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any>();
  const [heatmap, setHeatmap] = useState<any[]>([]);
  const [recurring, setRecurring] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = () => {
    get(withProfile("/summary", profileId)).then(setSummary);
    get<any[]>(withProfile("/by-category", profileId)).then(setByCat);
    get<any[]>(withProfile("/monthly-trend", profileId)).then(setMonthly);
    get<any[]>(withProfile("/top-expenses", profileId)).then(setTop);
    get(withProfile("/forecast", profileId)).then(setForecast);
    get<any[]>(withProfile("/heatmap", profileId)).then(setHeatmap);
    get<any[]>(withProfile("/recurring", profileId)).then(setRecurring);
  };
  useEffect(reload, [profileId]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const r: any = await upload(f, profileId);
      setMsg(`Imported ${r.added} transactions (${r.skipped_duplicates} duplicates skipped)`);
      reload();
    } catch (err: any) {
      setMsg(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <div>
          <input ref={fileRef} type="file" accept=".csv,.xlsx" hidden onChange={onUpload} />
          <button onClick={() => fileRef.current?.click()} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-500">Add file to this profile</button>
        </div>
      </div>
      {msg && <p className="text-sm text-emerald-600 dark:text-emerald-400">{msg}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Income" value={summary && fmt(summary.income)} tone="text-emerald-600" />
        <Stat label="Expenses" value={summary && fmt(summary.expenses)} tone="text-rose-600" />
        <Stat label="Net" value={summary && fmt(summary.net)} tone="text-indigo-600" />
        <Stat label="Savings rate" value={summary && `${summary.savings_rate}%`} tone="text-amber-600" />
      </div>

      {forecast?.next_month_expenses != null && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-sm">
          Projected spending next month: <b>{fmt(forecast.next_month_expenses)}</b> (avg of last {forecast.based_on_months} months)
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card title="Spending by Category">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={byCat} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={100} label>
                {byCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => fmt(v)} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Monthly Trend">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthly} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" /><YAxis tickFormatter={fmtCompact} width={48} /><Tooltip formatter={(v: any) => fmt(v)} />
              <Legend wrapperStyle={{ paddingTop: 12 }} />
              <Line type="monotone" dataKey="income" stroke="#22c55e" />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Category Totals">
          <ResponsiveContainer width="100%" height={Math.max(220, byCat.length * 36 + 40)}>
            <BarChart data={byCat} layout="vertical" margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
              <XAxis type="number" tickFormatter={fmtCompact} />
              <YAxis type="category" dataKey="category" width={105} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: any) => fmt(v)} />
              <Bar dataKey="amount" fill="#6366f1" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Spending by Day of Week">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={heatmap} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="day" /><YAxis tickFormatter={fmtCompact} width={48} /><Tooltip formatter={(v: any) => fmt(v)} />
              <Bar dataKey="amount" fill="#06b6d4" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Top 5 Largest Expenses">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-500"><th className="pb-2">Date</th><th>Description</th><th>Category</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {top.map(t => (
              <tr key={t.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-2">{t.date}</td><td>{t.description}</td><td>{t.category}</td>
                <td className="text-right text-rose-600">{fmt(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {recurring.length > 0 && (
        <Card title="Recurring Subscriptions Detected">
          <div className="flex flex-wrap gap-2">
            {recurring.map(r => (
              <span key={r.description} className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-sm">
                {r.description} · {fmt(r.amount)}/mo ×{r.count}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: any) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-xl font-bold mt-1 ${tone}`}>{value ?? "—"}</p>
    </div>
  );
}

function Card({ title, children }: any) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-950">
      <h3 className="font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}
