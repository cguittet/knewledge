"use client";

import { createBrowserClient } from "@supabase/ssr";
import { KeyRound } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setMessage("Passwords do not match.");
      return;
    }
    setLoading(true);
    const client = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await client.auth.updateUser({ password });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return <main className="login-page"><a href="/" className="brand"><span className="brand-mark">K</span><span>Knewledge</span></a><div className="login-card auth-card"><span className="login-icon"><KeyRound size={22} /></span><p className="eyebrow">Account security</p><h1>Choose a new password.</h1><p>Use at least eight characters and keep it unique to Knewledge.</p><form onSubmit={submit}><label htmlFor="password">New password</label><div className="input-wrap"><KeyRound size={18} /><input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} /></div><label htmlFor="confirmation" className="password-label">Confirm password</label><div className="input-wrap"><KeyRound size={18} /><input id="confirmation" type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div><button className="auth-submit" disabled={loading}>{loading ? "Saving…" : "Save new password"}</button></form>{message && <div className="form-message error">{message}</div>}</div></main>;
}
