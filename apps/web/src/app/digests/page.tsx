import { CalendarDays, Link2, Sparkles } from "lucide-react";
import { Shell } from "@/components/shell";
import { createUserClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Digest = { id: string; title: string; overview: string; period_start: string; period_end: string; themes: Array<{ name: string; summary: string }>; digest_entries: unknown[]; digest_relations: unknown[] };

export default async function DigestsPage() {
  const supabase = await createUserClient();
  const { data } = await supabase.from("digests").select("*,digest_entries(*),digest_relations(*)").order("period_end", { ascending: false });
  const digests = (data ?? []) as Digest[];
  return <Shell eyebrow="Your archive, connected" title="Weekly digests"><div className="digest-grid">{digests.map((digest) => <Link className="digest-card" href={`/digests/${digest.id}`} key={digest.id}><div className="digest-date"><CalendarDays size={15} /> {new Date(digest.period_start).toLocaleDateString()} — {new Date(digest.period_end).toLocaleDateString()}</div><h2>{digest.title}</h2><p>{digest.overview}</p><div className="theme-row">{digest.themes.slice(0, 4).map((theme) => <span key={theme.name}>{theme.name}</span>)}</div><footer><span><Link2 size={14} /> {digest.digest_entries.length} items</span><span><Sparkles size={14} /> {digest.digest_relations.length} connections</span></footer></Link>)}{!digests.length && <div className="empty-state"><Sparkles size={28} /><h3>Your first synthesis is on its way</h3><p>Once you have captures in a complete weekly period, your digest will surface themes and meaningful connections to the past.</p></div>}</div></Shell>;
}
