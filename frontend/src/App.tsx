import { useCallback, useEffect, useState } from "react";
import { del, get, type Profile } from "./api";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Budgets from "./pages/Budgets";
import Landing from "./pages/Landing";

const TABS = ["Dashboard", "Transactions", "Budgets"] as const;
type Tab = (typeof TABS)[number];
const LS_KEY = "expense-analyzer-profile";

export default function App() {
  const [stage, setStage] = useState<"landing" | "analyzed">("landing");
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [dark, setDark] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<number | null>(() => {
    const v = Number(localStorage.getItem(LS_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  });

  const refreshProfiles = useCallback(async () => {
    try {
      const list = await get<Profile[]>("/profiles");
      setProfiles(list);
      return list;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => { refreshProfiles(); }, [refreshProfiles]);

  const active = profiles.find(p => p.id === activeId) ?? null;
  useEffect(() => {
    if (activeId != null && !profiles.some(p => p.id === activeId)) {
      setActiveId(null);
      localStorage.removeItem(LS_KEY);
    }
  }, [profiles, activeId]);

  const selectProfile = (id: number | null) => {
    setActiveId(id);
    if (id == null) localStorage.removeItem(LS_KEY);
    else localStorage.setItem(LS_KEY, String(id));
  };

  const openAnalyzed = (profileId: number) => {
    selectProfile(profileId);
    setStage("analyzed");
    setTab("Dashboard");
  };

  const deleteActive = async () => {
    if (active == null) return;
    if (!window.confirm(`Delete profile "${active.name}" and all its data?`)) return;
    await del(`/profiles/${active.id}`);
    const list = await refreshProfiles();
    if (list.length > 0) selectProfile(list[0].id);
    else {
      selectProfile(null);
      setStage("landing");
    }
  };

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col">
        <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="max-w-6xl mx-auto px-4 pt-5 pb-0 flex items-center justify-between gap-3">
            <h1 className="text-lg font-bold whitespace-nowrap">Personal Expense Analyzer</h1>
            <div className="flex items-center gap-2">
              {stage === "analyzed" && profiles.length > 0 && (
                <select
                  value={active?.id ?? ""}
                  onChange={e => selectProfile(Number(e.target.value))}
                  title="Spending profile"
                  className="text-sm px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent max-w-44"
                >
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
              {stage === "analyzed" && (
                <>
                  <button
                    onClick={() => setStage("landing")}
                    title="Import another file (new or existing profile)"
                    className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Import file
                  </button>
                  <button
                    onClick={deleteActive}
                    title="Delete this profile and its data"
                    className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent hover:bg-rose-100 dark:hover:bg-rose-950 text-slate-500 hover:text-rose-700"
                  >
                    Delete
                  </button>
                </>
              )}
              <button
                onClick={() => setDark(!dark)}
                className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {dark ? "Light mode" : "Dark mode"}
              </button>
            </div>
          </div>
          {stage === "analyzed" && (
            <nav className="max-w-6xl mx-auto px-4 flex gap-1 mt-3">
              {TABS.map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2.5 text-sm -mb-px rounded-t-lg transition-colors ${
                    tab === t
                      ? "bg-slate-50 dark:bg-slate-950 font-semibold border-x border-t border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                  }`}
                >
                  {t}
                </button>
              ))}
            </nav>
          )}
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
          {stage === "landing" ? (
            <Landing
              profiles={profiles}
              activeId={active?.id ?? null}
              onProfilesChanged={refreshProfiles}
              onImported={openAnalyzed}
            />
          ) : active == null ? (
            <p className="text-sm text-slate-500">No profile selected.</p>
          ) : (
            <div key={active.id}>
              {tab === "Dashboard" && <Dashboard profileId={active.id} />}
              {tab === "Transactions" && <Transactions profileId={active.id} />}
              {tab === "Budgets" && <Budgets profileId={active.id} />}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
