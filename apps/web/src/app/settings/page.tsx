"use client";

import { Chrome, Copy, Mail, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";

export default function SettingsPage() {
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [weekday, setWeekday] = useState(0);
  const [localTime, setLocalTime] = useState("18:00");
  const [enabled, setEnabled] = useState(true);
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => { fetch("/v1/settings/digest").then((response) => response.json()).then((body) => { const value = body.settings; if (!value) return; setTimezone(value.timezone); setWeekday(value.weekday); setLocalTime(String(value.local_time).slice(0, 5)); setEnabled(value.enabled); }).catch(() => undefined); }, []);

  async function save() {
    const response = await fetch("/v1/settings/digest", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ timezone, weekday, localTime, preferredLanguage: "en", enabled }) });
    setMessage(response.ok ? "Digest settings saved." : "Could not save settings.");
  }
  async function pair() {
    const response = await fetch("/v1/extension/pair", { method: "POST" });
    const body = await response.json() as { code?: string };
    setPairCode(body.code ?? null);
  }

  return <Shell eyebrow="Personalize your rhythm" title="Settings"><div className="settings-grid"><section className="settings-card"><div className="settings-title"><span><Mail size={20} /></span><div><h2>Weekly digest</h2><p>Choose when your synthesis arrives.</p></div></div><label>Timezone<input value={timezone} onChange={(event) => setTimezone(event.target.value)} /></label><div className="form-grid"><label>Weekday<select value={weekday} onChange={(event) => setWeekday(Number(event.target.value))}><option value="0">Sunday</option><option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option></select></label><label>Local time<input type="time" value={localTime} onChange={(event) => setLocalTime(event.target.value)} /></label></div><label className="toggle"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /><span /> Send weekly digests</label><button className="settings-button" onClick={save}><Save size={17} /> Save schedule</button>{message && <small>{message}</small>}</section>
  <section className="settings-card"><div className="settings-title"><span><Chrome size={20} /></span><div><h2>Browser extension</h2><p>Pair a Chromium browser for quick captures.</p></div></div><p className="settings-help">Generate a one-time code, open the extension, and enter it within ten minutes.</p>{pairCode ? <button className="pair-code" onClick={() => navigator.clipboard.writeText(pairCode)}><b>{pairCode}</b><Copy size={17} /></button> : <button className="settings-button secondary" onClick={pair}><Chrome size={17} /> Generate pairing code</button>}</section></div></Shell>;
}

