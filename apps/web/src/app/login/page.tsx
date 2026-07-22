"use client";

import { createBrowserClient } from "@supabase/ssr";
import { ArrowRight, Mail, Sparkles } from "lucide-react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setMessage("");
    const client = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
    setMessage(error ? error.message : "Check your inbox for a secure sign-in link."); setLoading(false);
  }

  return <main className="login-page"><a href="/" className="brand"><span className="brand-mark">K</span><span>Knewledge</span></a><div className="login-card"><span className="login-icon"><Sparkles size={22} /></span><p className="eyebrow">Invite-only beta</p><h1>Welcome back.</h1><p>Enter your invited email. We’ll send a magic link—no password needed.</p><form onSubmit={submit}><label htmlFor="email">Email address</label><div className="input-wrap"><Mail size={18} /><input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></div><button disabled={loading}>{loading ? "Sending…" : "Send magic link"}<ArrowRight size={18} /></button></form>{message && <div className="form-message">{message}</div>}</div></main>;
}

