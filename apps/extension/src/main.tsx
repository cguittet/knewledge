import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Check, ChevronLeft, Link2, ListChecks, LoaderCircle, Sparkles } from "lucide-react";
import "./popup.css";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
type Tab = chrome.tabs.Tab;

async function storedToken() { return (await chrome.storage.local.get("knewledgeToken")).knewledgeToken as string | undefined; }
async function saveLinks(links: Array<{ url: string; note?: string | null }>) {
  const token = await storedToken();
  const response = await fetch(`${API_URL}/v1/captures/links`, { method: "POST", headers: { "content-type": "application/json", "x-extension-token": token ?? "" }, body: JSON.stringify({ links }) });
  if (!response.ok) throw new Error((await response.json()).message ?? "Could not save tabs");
}

function App() {
  const [paired, setPaired] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "saved">("idle");
  const [error, setError] = useState("");
  useEffect(() => { storedToken().then((token) => setPaired(Boolean(token))); }, []);
  useEffect(() => { if (mode === "bulk") chrome.tabs.query({ currentWindow: true }).then((items) => { const safe = items.filter((tab) => /^https?:/.test(tab.url ?? "")).slice(0, 50); setTabs(safe); setSelected(new Set(safe.map((_, index) => index))); }); }, [mode]);

  async function pair() {
    setState("loading"); setError("");
    try {
      const response = await fetch(`${API_URL}/v1/extension/exchange`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: code.replace(/\s/g, "") }) });
      const body = await response.json() as { token?: string; message?: string };
      if (!response.ok || !body.token) throw new Error(body.message ?? "Pairing failed");
      await chrome.storage.local.set({ knewledgeToken: body.token }); setPaired(true); setState("idle");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Pairing failed"); setState("idle"); }
  }

  async function save() {
    setState("loading"); setError("");
    try {
      if (mode === "single") {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url || !/^https?:/.test(tab.url)) throw new Error("This tab cannot be saved");
        await saveLinks([{ url: tab.url, note: note.trim() || null }]);
      } else {
        const links = tabs.filter((_, index) => selected.has(index)).map((tab) => ({ url: tab.url! }));
        if (!links.length) throw new Error("Select at least one tab");
        await saveLinks(links);
      }
      setState("saved"); setTimeout(() => window.close(), 950);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Save failed"); setState("idle"); }
  }

  if (paired === null) return <main className="center"><LoaderCircle className="spin" /></main>;
  if (!paired) return <main><Header /><section className="pair"><span className="big-icon"><Sparkles /></span><h1>Connect your library</h1><p>Generate a pairing code in Knewledge Settings, then enter it here.</p><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="A1B2C3D4E5" maxLength={10} /><button onClick={pair} disabled={state === "loading" || code.replace(/\s/g, "").length !== 10}>{state === "loading" ? <LoaderCircle className="spin" /> : "Connect extension"}</button>{error && <small className="error">{error}</small>}<a href={`${API_URL}/settings`} target="_blank">Open Knewledge settings ↗</a></section></main>;

  return <main><Header />{mode === "single" ? <section><div className="intro"><span className="big-icon"><Link2 /></span><h1>Save this tab</h1><p>We’ll fetch and organize the page in the background.</p></div><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why does this matter? (optional)" maxLength={2000} /><button className="primary" onClick={save} disabled={state !== "idle"}>{state === "loading" ? <><LoaderCircle className="spin" /> Saving…</> : state === "saved" ? <><Check /> Saved</> : "Save to Knewledge"}</button><button className="secondary" onClick={() => setMode("bulk")}><ListChecks /> Save multiple open tabs</button></section> : <section><button className="back" onClick={() => setMode("single")}><ChevronLeft /> Back</button><h1>Clear your tab backlog</h1><p className="muted">Choose up to 50 open tabs.</p><div className="tabs">{tabs.map((tab, index) => <label key={`${tab.id}-${index}`}><input type="checkbox" checked={selected.has(index)} onChange={() => setSelected((current) => { const next = new Set(current); next.has(index) ? next.delete(index) : next.add(index); return next; })} /><span><b>{tab.title || tab.url}</b><small>{new URL(tab.url!).hostname}</small></span></label>)}</div><button className="primary" onClick={save} disabled={state !== "idle"}>{state === "loading" ? <LoaderCircle className="spin" /> : `Save ${selected.size} tabs`}</button></section>}{error && <small className="error bottom">{error}</small>}</main>;
}

function Header() { return <header><span>K</span><b>Knewledge</b></header>; }
createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
