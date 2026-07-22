"use client";

import { createBrowserClient } from "@supabase/ssr";
import { Camera, Check, FileImage, Link2, LoaderCircle, Play, UploadCloud, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/shell";

type UploadSlot = { objectKey: string; token: string; mimeType: string; sizeBytes: number };
const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const maxImagesPerCapture = 20;

export default function CapturePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"images" | "link">("images");
  const [files, setFiles] = useState<File[]>([]);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);

  function chooseFiles(selected: FileList | null) {
    if (!selected) return;
    const selectedFiles = Array.from(selected);
    if (selectedFiles.length > maxImagesPerCapture) {
      setError(`Choose no more than ${maxImagesPerCapture} images at once.`);
      return;
    }
    const next = selectedFiles;
    const invalid = next.find((file) => !supportedTypes.has(file.type) || file.size > 15 * 1024 * 1024);
    if (invalid) { setError(`${invalid.name} is not a supported image or is larger than 15 MB.`); return; }
    setFiles(next); setError("");
  }

  async function saveImages() {
    if (!files.length) return;
    setStatus("saving"); setError("");
    try {
      const uploadResponse = await fetch("/v1/uploads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ files: files.map((file) => ({ fileName: file.name, mimeType: file.type, sizeBytes: file.size })) }) });
      const uploadBody = await uploadResponse.json() as { uploads?: UploadSlot[]; message?: string };
      if (!uploadResponse.ok || !uploadBody.uploads) throw new Error(uploadBody.message ?? "Could not prepare the upload");
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]!; const slot = uploadBody.uploads[index]!;
        const { error: uploadError } = await supabase.storage.from("captures").uploadToSignedUrl(slot.objectKey, slot.token, file, { contentType: slot.mimeType });
        if (uploadError) throw uploadError;
      }
      const response = await fetch("/v1/captures/images", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assets: uploadBody.uploads.map(({ objectKey, mimeType, sizeBytes }) => ({ objectKey, mimeType, sizeBytes })), note: note.trim() || null }) });
      const body = await response.json() as { capture?: { id: string }; message?: string };
      if (!response.ok || !body.capture) throw new Error(body.message ?? "Could not create the capture");
      setStatus("saved"); setTimeout(() => router.push(`/captures/${body.capture!.id}`), 500);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Upload failed"); setStatus("idle"); }
  }

  async function saveLink() {
    setStatus("saving"); setError("");
    try {
      const response = await fetch("/v1/captures/links", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ links: [{ url: url.trim(), note: note.trim() || null }] }) });
      const body = await response.json() as { captures?: Array<{ id: string; kind: string }>; message?: string };
      if (!response.ok || !body.captures?.[0]) throw new Error(body.message ?? "Could not save this link");
      setStatus("saved"); setTimeout(() => router.push(`/captures/${body.captures![0]!.id}`), 500);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Save failed"); setStatus("idle"); }
  }

  return <Shell eyebrow="Works in every mobile browser" title="Add something worth keeping">
    <div className="capture-workspace"><div className="capture-tabs"><button className={mode === "images" ? "active" : ""} onClick={() => setMode("images")}><Camera size={17} /> Screenshots & book photos</button><button className={mode === "link" ? "active" : ""} onClick={() => setMode("link")}><Link2 size={17} /> Web or YouTube link</button></div>
      {mode === "images" ? <section className="capture-panel"><label className="drop-zone"><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={(event) => chooseFiles(event.target.files)} /><span><UploadCloud size={28} /></span><h2>{files.length ? `${files.length} image${files.length === 1 ? "" : "s"} selected` : "Choose screenshots or photos"}</h2><p>Select up to {maxImagesPerCapture} images. They’ll be read in this order as one capture.</p></label>{previews.length ? <div className="preview-grid">{previews.map((preview, index) => <div key={`${preview.file.name}-${index}`}><img src={preview.url} alt={`Selected page ${index + 1}`} /><span>{index + 1}</span><button onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${preview.file.name}`}><X size={13} /></button></div>)}</div> : <div className="capture-tip"><FileImage size={18} /><span>On iPhone or Android, this opens your photo library so you can select one or several screenshots or photos.</span></div>}</section> : <section className="capture-panel"><div className="link-visual"><span><Play size={23} /></span><span><Link2 size={23} /></span></div><label className="capture-label">Paste a web page or YouTube video URL<input type="url" inputMode="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://youtube.com/watch?v=…" /></label><div className="capture-tip"><Play size={18} /><span>YouTube videos are summarized from public captions. Videos without accessible captions remain saved and are marked for attention.</span></div></section>}
      <section className="capture-note"><label className="capture-label">Why does this matter? <small>Optional</small><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} placeholder="A quick thought helps the weekly synthesis understand why you saved it." /></label></section>
      {error && <div className="capture-error">{error}</div>}<button className="save-capture" disabled={status !== "idle" || (mode === "images" ? !files.length : !url.trim())} onClick={mode === "images" ? saveImages : saveLink}>{status === "saving" ? <><LoaderCircle className="spin" size={18} /> Saving…</> : status === "saved" ? <><Check size={18} /> Saved</> : mode === "images" ? "Upload capture" : "Save link"}</button>
    </div>
  </Shell>;
}
