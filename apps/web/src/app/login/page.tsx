"use client";

import { createBrowserClient } from "@supabase/ssr";
import { ArrowRight, Eye, EyeOff, KeyRound, Mail, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "sign_in" | "sign_up" | "magic_link";

function authClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error")) {
      setMessage("That sign-in link is invalid or has expired. Please try again.");
      setIsError(true);
    }
  }, []);

  function showMessage(value: string, error = false) {
    setMessage(value);
    setIsError(error);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    showMessage("");
    const client = authClient();

    if (mode === "magic_link") {
      const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
      showMessage(error ? error.message : "Check your inbox for a secure sign-in link.", Boolean(error));
      setLoading(false);
      return;
    }

    if (mode === "sign_up") {
      const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
      if (error) {
        showMessage(error.message.includes("Database") ? "This email is not currently invited, or its invite has expired." : error.message, true);
      } else if (data.session) {
        router.replace("/");
        router.refresh();
      } else {
        showMessage("Account created. Check your inbox to confirm your email, then sign in.");
      }
      setLoading(false);
      return;
    }

    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) showMessage(error.message, true);
    else {
      router.replace("/");
      router.refresh();
    }
    setLoading(false);
  }

  async function signInWithGoogle() {
    setLoading(true);
    showMessage("");
    const { error } = await authClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      showMessage(error.message, true);
      setLoading(false);
    }
  }

  async function resetPassword() {
    if (!email) {
      showMessage("Enter your email address first.", true);
      return;
    }
    setLoading(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/reset")}`;
    const { error } = await authClient().auth.resetPasswordForEmail(email, { redirectTo });
    showMessage(error ? error.message : "Check your inbox for a password-reset link.", Boolean(error));
    setLoading(false);
  }

  return <main className="login-page"><a href="/" className="brand"><span className="brand-mark">K</span><span>Knewledge</span></a><div className="login-card auth-card"><span className="login-icon"><Sparkles size={22} /></span><p className="eyebrow">Invite-only beta</p><h1>{mode === "sign_up" ? "Create your account." : "Welcome back."}</h1><p>{mode === "sign_up" ? "Use the email address that received your invitation." : "Sign in to your private knowledge library."}</p>
    <button className="google-auth" type="button" onClick={signInWithGoogle} disabled={loading}><span>G</span> Continue with Google</button>
    <div className="auth-divider"><span>or</span></div>
    <div className="auth-tabs"><button type="button" className={mode === "sign_in" ? "active" : ""} onClick={() => { setMode("sign_in"); showMessage(""); }}>Sign in</button><button type="button" className={mode === "sign_up" ? "active" : ""} onClick={() => { setMode("sign_up"); showMessage(""); }}>Create account</button></div>
    <form onSubmit={submit}><label htmlFor="email">Email address</label><div className="input-wrap"><Mail size={18} /><input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></div>{mode !== "magic_link" && <><label htmlFor="password" className="password-label">Password</label><div className="input-wrap"><KeyRound size={18} /><input id="password" type={showPassword ? "text" : "password"} autoComplete={mode === "sign_up" ? "new-password" : "current-password"} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "sign_up" ? "At least 8 characters" : "Your password"} /><button className="password-toggle" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></>}
      <button className="auth-submit" disabled={loading}>{loading ? "Please wait…" : mode === "sign_up" ? "Create account" : mode === "magic_link" ? "Send secure link" : "Sign in"}<ArrowRight size={18} /></button></form>
    <div className="auth-secondary">{mode === "sign_in" && <button type="button" onClick={resetPassword}>Forgot password?</button>}<button type="button" onClick={() => { setMode(mode === "magic_link" ? "sign_in" : "magic_link"); showMessage(""); }}>{mode === "magic_link" ? "Use a password instead" : "Email me a sign-in link"}</button></div>
    {message && <div className={`form-message${isError ? " error" : ""}`}>{message}</div>}<p className="invite-note">New accounts require an unused invitation for the same email address.</p></div></main>;
}
