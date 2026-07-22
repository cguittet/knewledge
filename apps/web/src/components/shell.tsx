import { BookOpen, Clock3, Plus, Search, Sparkles } from "lucide-react";
import Link from "next/link";

export function Shell({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return <div className="app-shell">
    <aside className="sidebar"><Link href="/" className="brand"><span className="brand-mark">K</span><span>Knewledge</span></Link><nav><Link className="nav-item capture-nav" href="/capture"><Plus size={18} /> Add content</Link><Link className="nav-item" href="/"><BookOpen size={18} /> Library</Link><Link className="nav-item" href="/search"><Search size={18} /> Search</Link><Link className="nav-item" href="/digests"><Sparkles size={18} /> Weekly digests</Link><Link className="nav-item" href="/settings"><Clock3 size={18} /> Settings</Link></nav><div className="sidebar-note"><span className="live-dot" /> Private beta</div></aside>
    <main className="main inner-main"><header className="inner-header"><Link href="/" className="back-link">← Library</Link><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></header>{children}</main>
  </div>;
}
