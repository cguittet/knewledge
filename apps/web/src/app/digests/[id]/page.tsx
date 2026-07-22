import Link from "next/link";
import { firstRelation } from "@knewledge/core";
import { CalendarDays, Link2, Sparkles } from "lucide-react";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { createUserClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DigestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createUserClient();
  const { data } = await db.from("digests").select("*,digest_entries(*,captures(id,status,kind,original_url,content_revisions(item_analyses(title,summary)))),digest_relations(*)").eq("id", id).maybeSingle();
  if (!data) notFound();
  return <Shell eyebrow={`${new Date(data.period_start).toLocaleDateString()} — ${new Date(data.period_end).toLocaleDateString()}`} title={data.title}><article className="full-digest"><div className="digest-lead"><Sparkles size={21} /><p>{data.overview}</p></div><section><h2>Key themes</h2><div className="digest-themes">{(data.themes ?? []).map((theme: { name: string; summary: string }) => <div key={theme.name}><b>{theme.name}</b><p>{theme.summary}</p></div>)}</div></section><section><h2>What you saved</h2><div className="digest-items">{data.digest_entries.map((entry: { captures: { id: string; status: string; original_url: string | null; content_revisions: Array<{ item_analyses: { title: string; summary: string } | Array<{ title: string; summary: string }> }> } }) => { const analysis = firstRelation(entry.captures.content_revisions?.[0]?.item_analyses); return <Link href={`/captures/${entry.captures.id}`} key={entry.captures.id}><Link2 size={17} /><div><b>{analysis?.title ?? entry.captures.original_url ?? "Capture"}</b><p>{analysis?.summary ?? `Status: ${entry.captures.status}`}</p></div><span>→</span></Link>; })}</div></section>{data.digest_relations.length ? <section><h2>Connections to your archive</h2><div className="relations">{data.digest_relations.map((relation: { id: string; relation_type: string; explanation: string; current_evidence: string; prior_evidence: string }) => <div key={relation.id}><span>{relation.relation_type.replace("_", " ")}</span><p>{relation.explanation}</p><blockquote>“{relation.current_evidence}”<br />↕<br />“{relation.prior_evidence}”</blockquote></div>)}</div></section> : null}<footer className="digest-generated"><CalendarDays size={14} /> Generated {new Date(data.created_at).toLocaleString()}</footer></article></Shell>;
}
