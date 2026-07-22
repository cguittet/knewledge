import { Camera, CircleAlert, ExternalLink, Link2, Play, Sparkles } from "lucide-react";
import { firstRelation, youtubeVideoId } from "@knewledge/core";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { createUserClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CapturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createUserClient();
  const { data } = await db.from("captures").select("*,assets(*),content_revisions(*,item_analyses(*),item_topics(*,topics(*)))").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!data) notFound();
  const revision = firstRelation(data.content_revisions);
  const analysis = firstRelation(revision?.item_analyses);
  const topics = revision?.item_topics?.map((item: { topics: { name: string } }) => item.topics?.name).filter(Boolean) ?? [];
  const videoId = data.kind === "youtube" ? youtubeVideoId(data.original_url) : null;
  const imageUrls = await Promise.all((data.assets ?? []).sort((a: { ordinal: number }, b: { ordinal: number }) => a.ordinal - b.ordinal).map(async (asset: { object_key: string }) => (await db.storage.from("captures").createSignedUrl(asset.object_key, 3600)).data?.signedUrl));
  return <Shell eyebrow={data.kind === "image" ? "Image capture" : data.kind === "youtube" ? "YouTube video" : "Saved link"} title={analysis?.title ?? revision?.title ?? "Processing capture"}><div className="detail-layout"><article className="detail-main">{data.kind !== "image" && <a className="source-link" href={data.original_url} target="_blank"><Link2 size={16} /> {data.original_url}<ExternalLink size={14} /></a>}{videoId && <div className="video-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${videoId}`} title={analysis?.title ?? "Saved YouTube video"} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>}{data.status === "needs_attention" && <div className="attention-box"><CircleAlert size={20} /><div><b>{data.kind === "youtube" ? "Captions are unavailable" : "This page could not be read"}</b><p>{data.failure_detail ?? "Upload screenshots so Knewledge can finish processing it."}</p></div></div>}<div className="summary-block"><span><Sparkles size={15} /> Summary</span><p>{analysis?.summary ?? "Your capture is queued. The summary will appear here when processing finishes."}</p></div>{analysis?.key_ideas?.length ? <section><h2>Key ideas</h2><ul className="idea-list">{analysis.key_ideas.map((idea: string) => <li key={idea}>{idea}</li>)}</ul></section> : null}{revision?.extracted_text && <section><h2>{data.kind === "youtube" ? "Transcript" : "Extracted text"}</h2><div className="extracted-text">{revision.extracted_text}</div></section>}</article><aside className="detail-side"><div className="side-card"><span className={`source-icon ${data.kind}`}>{data.kind === "image" ? <Camera size={20} /> : data.kind === "youtube" ? <Play size={20} /> : <Link2 size={20} />}</span><h3>Capture details</h3><dl><dt>Status</dt><dd>{data.status}</dd><dt>Saved</dt><dd>{new Date(data.captured_at).toLocaleString()}</dd><dt>Confidence</dt><dd>{analysis ? `${Math.round(analysis.confidence * 100)}%` : "—"}</dd></dl></div>{topics.length ? <div className="side-card"><h3>Topics</h3><div className="theme-row">{topics.map((topic: string) => <span key={topic}>{topic}</span>)}</div></div> : null}</aside></div>{imageUrls.filter(Boolean).length ? <section className="image-strip">{imageUrls.filter(Boolean).map((url, index) => <img key={url} src={url} alt={`Capture page ${index + 1}`} />)}</section> : null}</Shell>;
}
