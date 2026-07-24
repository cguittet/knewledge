import { ArrowUpRight, BookOpen, Camera, CircleAlert, Clock3, FileText, Link2, Play, Plus, Search, Sparkles } from "lucide-react";
import { firstRelation } from "@knewledge/core";
import Link from "next/link";
import { createUserClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type CaptureRow = {
  id: string; kind: "image" | "pdf" | "link" | "youtube"; status: string; note: string | null;
  original_url: string | null; captured_at: string;
  content_revisions?: Array<{ item_analyses?: { title: string; summary: string } | Array<{ title: string; summary: string }> }>;
};

function relativeTime(value: string) {
  const hours = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 3_600_000));
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

export default async function Dashboard() {
  let user: { email?: string } | null = null;
  let captures: CaptureRow[] = [];
  let topicCount = 0;
  try {
    const supabase = await createUserClient();
    const auth = await supabase.auth.getUser();
    user = auth.data.user;
    if (user) {
      const [captureResult, topicResult] = await Promise.all([
        supabase.from("captures").select("id,kind,status,note,original_url,captured_at,content_revisions(item_analyses(title,summary))").is("deleted_at", null).order("captured_at", { ascending: false }).limit(8),
        supabase.from("topics").select("id", { count: "exact", head: true }),
      ]);
      captures = (captureResult.data ?? []) as CaptureRow[];
      topicCount = topicResult.count ?? 0;
    }
  } catch {
    // Missing local credentials render the onboarding state instead of failing the page.
  }

  if (!user) return <Landing />;
  const ready = captures.filter((capture) => capture.status === "ready").length;
  const attention = captures.filter((capture) => capture.status === "needs_attention" || capture.status === "failed").length;

  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand"><span className="brand-mark">K</span><span>Knewledge</span></Link>
      <nav>
        <Link className="nav-item capture-nav" href="/capture"><Plus size={18} /> Add content</Link>
        <Link className="nav-item active" href="/"><BookOpen size={18} /> Library</Link>
        <Link className="nav-item" href="/search"><Search size={18} /> Search</Link>
        <Link className="nav-item" href="/digests"><Sparkles size={18} /> Weekly digests</Link>
        <Link className="nav-item" href="/settings"><Clock3 size={18} /> Settings</Link>
      </nav>
      <div className="sidebar-note"><span className="live-dot" /> Private beta<br /><small>{user.email}</small></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div><p className="eyebrow">Your knowledge library</p><h1>Good evening.</h1></div>
        <div className="top-actions"><Link href="/capture" className="add-button"><Plus size={17} /> Add content</Link><Link href="/search" className="search-pill"><Search size={17} /> Search everything <kbd>⌘ K</kbd></Link></div>
      </header>

      <section className="hero-card">
        <div><span className="hero-kicker"><Sparkles size={15} /> This week</span><h2>Your ideas are taking shape.</h2><p>{ready} items are ready to revisit. Your next synthesis will connect them to what you saved before.</p></div>
        <Link href="/digests" className="round-button"><ArrowUpRight size={21} /></Link>
      </section>

      <section className="stats-grid">
        <div className="stat"><span>Recent captures</span><strong>{captures.length}</strong><small>Across links, images, and PDFs</small></div>
        <div className="stat"><span>Topics emerging</span><strong>{topicCount}</strong><small>Organized automatically</small></div>
        <div className="stat"><span>Needs attention</span><strong>{attention}</strong><small>{attention ? "Add a screenshot to help" : "Everything looks good"}</small></div>
      </section>

      <section className="section-heading"><div><p className="eyebrow">Latest</p><h2>Recently captured</h2></div><Link href="/search">View all <ArrowUpRight size={15} /></Link></section>
      <div className="capture-list">
        {captures.length ? captures.map((capture) => {
          const analysis = firstRelation(capture.content_revisions?.[0]?.item_analyses);
          return <Link className="capture-card" href={`/captures/${capture.id}`} key={capture.id}>
            <span className={`source-icon ${capture.kind}`}>{capture.kind === "image" ? <Camera size={20} /> : capture.kind === "pdf" ? <FileText size={20} /> : capture.kind === "youtube" ? <Play size={20} /> : <Link2 size={20} />}</span>
            <div className="capture-copy"><div className="capture-meta"><span>{capture.kind === "image" ? "Image capture" : capture.kind === "pdf" ? "PDF document" : capture.kind === "youtube" ? "YouTube video" : "Saved link"}</span><span>·</span><span>{relativeTime(capture.captured_at)}</span></div><h3>{analysis?.title ?? capture.original_url ?? "Processing your capture…"}</h3><p>{analysis?.summary ?? capture.note ?? "We’re extracting the useful ideas and organizing them for you."}</p></div>
            <span className={`status ${capture.status}`}>{capture.status === "needs_attention" ? <><CircleAlert size={14} /> Needs attention</> : capture.status}</span>
          </Link>;
        }) : <div className="empty-state"><Camera size={28} /><h3>Your library is ready</h3><p>Upload screenshots, book photos, or PDFs from any browser; paste links; or save a tab with the extension.</p><Link className="inline-add" href="/capture">Add your first capture</Link></div>}
      </div>
    </main>
  </div>;
}

function Landing() {
  return <main className="landing">
    <nav className="landing-nav"><div className="brand"><span className="brand-mark">K</span><span>Knewledge</span></div><Link href="/login" className="text-button">Sign in</Link></nav>
    <section className="landing-copy"><p className="hero-kicker"><Sparkles size={15} /> Your ideas, remembered</p><h1>Keep what matters.<br /><em>Connect what you learn.</em></h1><p>Turn screenshots, book pages, and open tabs into a private knowledge library that gets more valuable every week.</p><Link href="/login" className="primary-button">Enter your library <ArrowUpRight size={18} /></Link></section>
    <section className="landing-preview"><div className="preview-glow" /><div className="floating-card one"><Camera size={18} /><span>Book page captured</span></div><div className="floating-card two"><Link2 size={18} /><span>AI agents in sales</span></div><div className="insight-card"><p>WEEKLY SYNTHESIS</p><h2>A pattern is emerging</h2><span>Your notes on AI adoption connect to three ideas you saved in April.</span><div className="mini-topics"><b>AI strategy</b><b>Sales</b><b>Startups</b></div></div></section>
  </main>;
}
