import { AlignLeft, Camera, CircleAlert, ExternalLink, FileText, Link2, Play, Sparkles } from "lucide-react";
import { firstRelation, youtubeVideoId } from "@knewledge/core";
import { notFound } from "next/navigation";
import { DeleteCaptureButton } from "@/components/delete-capture-button";
import { Shell } from "@/components/shell";
import { createUserClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function sourceLabel(kind: string) {
  if (kind === "image") return "Image capture";
  if (kind === "pdf") return "PDF document";
  if (kind === "youtube") return "YouTube video";
  if (kind === "text") return "Pasted text";
  return "Saved link";
}

function SourceIcon({ kind }: { kind: string }) {
  if (kind === "image") return <Camera size={20} />;
  if (kind === "pdf") return <FileText size={20} />;
  if (kind === "youtube") return <Play size={20} />;
  if (kind === "text") return <AlignLeft size={20} />;
  return <Link2 size={20} />;
}

export default async function CapturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createUserClient();
  const { data } = await db.from("captures").select("*,assets(*),content_revisions(*,item_analyses(*),item_topics(*,topics(*)))").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!data) notFound();

  const revision = firstRelation(data.content_revisions);
  const analysis = firstRelation(revision?.item_analyses);
  const topics = revision?.item_topics?.map((item: { topics: { name: string } }) => item.topics?.name).filter(Boolean) ?? [];
  const videoId = data.kind === "youtube" ? youtubeVideoId(data.original_url) : null;
  const assets = await Promise.all((data.assets ?? [])
    .sort((a: { ordinal: number }, b: { ordinal: number }) => a.ordinal - b.ordinal)
    .map(async (asset: { object_key: string; mime_type: string; original_name?: string | null }) => ({
      ...asset,
      signedUrl: (await db.storage.from("captures").createSignedUrl(asset.object_key, 3600)).data?.signedUrl,
    })));
  const imageAssets = assets.filter((asset) => asset.mime_type.startsWith("image/") && asset.signedUrl);
  const pdfAsset = assets.find((asset) => asset.mime_type === "application/pdf" && asset.signedUrl);

  return <Shell eyebrow={sourceLabel(data.kind)} title={analysis?.title ?? revision?.title ?? pdfAsset?.original_name ?? "Processing capture"}>
    <div className="detail-layout">
      <article className="detail-main">
        {(data.kind === "link" || data.kind === "youtube") && <a className="source-link" href={data.original_url} target="_blank" rel="noreferrer"><Link2 size={16} /> {data.original_url}<ExternalLink size={14} /></a>}
        {pdfAsset && <a className="pdf-source-card" href={pdfAsset.signedUrl} target="_blank" rel="noreferrer"><FileText size={28} /><span><b>{pdfAsset.original_name ?? "Document.pdf"}</b><small>Open original PDF</small></span><ExternalLink size={16} /></a>}
        {videoId && <div className="video-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${videoId}`} title={analysis?.title ?? "Saved YouTube video"} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>}
        {data.status === "needs_attention" && <div className="attention-box"><CircleAlert size={20} /><div><b>{data.kind === "youtube" ? "Transcript could not be retrieved" : data.kind === "pdf" ? "This PDF could not be read" : data.kind === "text" ? "This text could not be processed" : "This page could not be read"}</b><p>{data.failure_detail ?? "Try uploading the source again."}</p>{data.kind === "link" && <a href="/capture">Copy the page in your browser and save it from the Text tab →</a>}</div></div>}
        <div className="summary-block"><span><Sparkles size={15} /> Summary</span><p>{analysis?.summary ?? "Your capture is queued. The summary will appear here when processing finishes."}</p></div>
        {analysis?.key_ideas?.length ? <section><h2>Key ideas</h2><ul className="idea-list">{analysis.key_ideas.map((idea: string) => <li key={idea}>{idea}</li>)}</ul></section> : null}
        {revision?.extracted_text && <section><h2>{data.kind === "youtube" ? "Transcript" : "Extracted text"}</h2><div className="extracted-text">{revision.extracted_text}</div></section>}
      </article>
      <aside className="detail-side">
        <div className="side-card"><span className={`source-icon ${data.kind}`}><SourceIcon kind={data.kind} /></span><h3>Capture details</h3><dl><dt>Status</dt><dd>{data.status}</dd><dt>Saved</dt><dd>{new Date(data.captured_at).toLocaleString()}</dd><dt>Confidence</dt><dd>{analysis ? `${Math.round(analysis.confidence * 100)}%` : "—"}</dd></dl></div>
        {topics.length ? <div className="side-card"><h3>Topics</h3><div className="theme-row">{topics.map((topic: string) => <span key={topic}>{topic}</span>)}</div></div> : null}
        <DeleteCaptureButton captureId={id} />
      </aside>
    </div>
    {imageAssets.length ? <section className="image-strip">{imageAssets.map((asset, index) => <img key={asset.object_key} src={asset.signedUrl} alt={`Capture page ${index + 1}`} />)}</section> : null}
  </Shell>;
}
