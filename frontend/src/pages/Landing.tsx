import { useEffect, useRef, useState } from "react";
import { post, upload, type Profile } from "../api";

interface Props {
  profiles: Profile[];
  activeId: number | null;
  onProfilesChanged: () => Promise<Profile[]>;
  onImported: (profileId: number) => void;
}

export default function Landing({ profiles, activeId, onProfilesChanged, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<"" | "analyzing" | "error">("");
  const [errorMsg, setErrorMsg] = useState("");
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [newName, setNewName] = useState("");
  const [existingId, setExistingId] = useState<string>("");

  useEffect(() => {
    if (profiles.length === 0) {
      setMode("new");
    } else {
      setMode(activeId != null ? "existing" : "new");
      setExistingId(String(activeId ?? profiles[0].id));
    }
  }, [profiles, activeId]);

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (!/\.(csv|xlsx)$/i.test(f.name)) {
      setStatus("error");
      setErrorMsg("Please choose a CSV or XLSX file.");
      return;
    }
    setFile(f);
    setStatus("");
    setErrorMsg("");
  };

  const analyze = async () => {
    if (!file) return;
    let pid: number | null = null;
    if (mode === "new") {
      const name = newName.trim() || file.name.replace(/\.(csv|xlsx)$/i, "");
      if (!name) {
        setStatus("error");
        setErrorMsg("Give the new profile a name.");
        return;
      }
      setStatus("analyzing");
      setErrorMsg("");
      try {
        const p: any = await post(`/profiles?name=${encodeURIComponent(name)}`);
        pid = p.id;
        await onProfilesChanged();
      } catch (err: any) {
        setStatus("error");
        setErrorMsg(err.message || "Could not create profile.");
        return;
      }
    } else {
      pid = Number(existingId);
      if (!pid) {
        setStatus("error");
        setErrorMsg("Pick an existing profile first.");
        return;
      }
      setStatus("analyzing");
      setErrorMsg("");
    }
    if (pid == null) return;
    try {
      const r: any = await upload(file, pid);
      onImported(pid);
      if (r.added === 0) {
        // stage already switched; nothing to show here
      }
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message || "Upload failed. Check that the backend is running.");
    }
  };

  const canAnalyze = file != null && status !== "analyzing" &&
    (mode === "existing" ? existingId !== "" : true);

  const openProfile = (id: number) => onImported(id);

  return (
    <div className="max-w-2xl mx-auto pt-10 pb-16">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-extrabold tracking-tight">Personal Expense Analyzer</h2>
        <p className="mt-3 text-slate-600 dark:text-slate-400 text-lg">
          Upload your bank statement and see exactly where your money goes.
        </p>
        <p className="mt-1 text-sm text-slate-400">CSV and XLSX supported &middot; processed locally, never shared</p>
      </div>

      {profiles.length > 0 && (
        <div className="mb-8 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <p className="text-sm font-semibold mb-3">Your profiles</p>
          <ul className="space-y-2">
            {profiles.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5">
                <span className="text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-slate-400"> · {p.transactions} transactions</span>
                </span>
                <button
                  onClick={() => openProfile(p.id)}
                  className="text-sm px-4 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 whitespace-nowrap"
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-sm font-semibold mb-3 text-slate-500 dark:text-slate-400">
        {profiles.length > 0 ? "Or import a new file" : "Import a file to get started"}
      </p>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors bg-white dark:bg-slate-900 ${
          dragOver ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30" : "border-slate-300 dark:border-slate-700 hover:border-indigo-400"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          className="hidden"
          onChange={e => { pickFile(e.target.files?.[0]); e.target.value = ""; }}
        />
        <div className="mx-auto w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.9A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <p className="font-semibold">
          {file ? file.name : "Drag & drop your file here, or click to browse"}
        </p>
        <p className="text-sm text-slate-400 mt-1">{file ? `${(file.size / 1024).toFixed(1)} KB` : ".csv or .xlsx"}</p>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
        <p className="text-sm font-semibold mb-3">Where should this file go?</p>
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="radio" className="mt-1" checked={mode === "new"} onChange={() => setMode("new")} />
            <span className="flex-1">
              <span className="text-sm font-medium">Create a new profile</span>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onFocus={() => setMode("new")}
                placeholder={file ? file.name.replace(/\.(csv|xlsx)$/i, "") : "e.g. My salary account"}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
              />
            </span>
          </label>
          <label className={`flex items-start gap-3 ${profiles.length === 0 ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
            <input type="radio" className="mt-1" checked={mode === "existing"} disabled={profiles.length === 0} onChange={() => setMode("existing")} />
            <span className="flex-1">
              <span className="text-sm font-medium">Add to an existing profile</span>
              <select
                value={existingId}
                onChange={e => { setExistingId(e.target.value); setMode("existing"); }}
                disabled={profiles.length === 0}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
              >
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.transactions} transactions)</option>
                ))}
              </select>
              <span className="text-xs text-slate-400">New rows are appended; exact duplicates are skipped.</span>
            </span>
          </label>
        </div>
      </div>

      <button
        onClick={analyze}
        disabled={!canAnalyze}
        className="mt-6 w-full rounded-xl px-5 py-3.5 text-base font-semibold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {status === "analyzing" ? "Analyzing…" : "Analyze"}
      </button>

      {status === "error" && (
        <p className="mt-4 text-sm text-rose-600 dark:text-rose-400 text-center">{errorMsg}</p>
      )}

      <div className="mt-10 grid grid-cols-3 gap-4 text-center">
        {[
          ["Auto-categorization", "9 categories by keyword"],
          ["Insights & charts", "Trends, top expenses, forecast"],
          ["Budgets & alerts", "Monthly limits per category"],
        ].map(([t, d]) => (
          <div key={t} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-sm font-semibold">{t}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
