"use client";

import { createBrowserClient } from "@supabase/ssr";
import { parsePastedUrls } from "@knewledge/core/pasted-urls";
import { AlignLeft, Camera, Check, FileImage, FileText, Link2, LoaderCircle, Play, UploadCloud, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/shell";

type UploadSlot = { objectKey: string; token: string; fileName: string; mimeType: string; sizeBytes: number };
const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const maxImagesPerCapture = 20;

export default function CapturePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"images" | "pdf" | "link" | "text">("images");
  const [files, setFiles] = useState<File[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [linksText, setLinksText] = useState("");
  const [plainText, setPlainText] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  const detectedUrls = useMemo(() => parsePastedUrls(linksText, 51), [linksText]);
  const tooManyLinks = detectedUrls.length > 50;
  const parsedUrls = detectedUrls.slice(0, 50);
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

  function choosePdf(selected: FileList | null) {
    const file = selected?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" || file.size > 25 * 1024 * 1024) {
      setError("Choose one PDF no larger than 25 MB.");
      return;
    }
    setPdfFile(file);
    setError("");
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
      const response = await fetch("/v1/captures/images", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assets: uploadBody.uploads.map(({ objectKey, fileName, mimeType, sizeBytes }) => ({ objectKey, fileName, mimeType, sizeBytes })), note: note.trim() || null }) });
      const body = await response.json() as { capture?: { id: string }; message?: string };
      if (!response.ok || !body.capture) throw new Error(body.message ?? "Could not create the capture");
      setStatus("saved"); setTimeout(() => router.push(`/captures/${body.capture!.id}`), 500);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Upload failed"); setStatus("idle"); }
  }

  async function saveLink() {
    setStatus("saving"); setError("");
    try {
      if (!parsedUrls.length) throw new Error("Paste at least one complete http:// or https:// link.");
      if (tooManyLinks) throw new Error("Paste no more than 50 links at once.");
      const response = await fetch("/v1/captures/links", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ links: parsedUrls.map((url) => ({ url, note: note.trim() || null })) }) });
      const body = await response.json() as { captures?: Array<{ id: string; kind: string }>; message?: string };
      if (!response.ok || !body.captures?.[0]) throw new Error(body.message ?? "Could not save this link");
      setStatus("saved"); setTimeout(() => router.push(body.captures!.length === 1 ? `/captures/${body.captures![0]!.id}` : "/"), 500);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Save failed"); setStatus("idle"); }
  }

  async function savePdf() {
    if (!pdfFile) return;
    setStatus("saving"); setError("");
    try {
      const uploadResponse = await fetch("/v1/uploads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ files: [{ fileName: pdfFile.name, mimeType: pdfFile.type, sizeBytes: pdfFile.size }] }) });
      const uploadBody = await uploadResponse.json() as { uploads?: UploadSlot[]; message?: string };
      const slot = uploadBody.uploads?.[0];
      if (!uploadResponse.ok || !slot) throw new Error(uploadBody.message ?? "Could not prepare the PDF upload");
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { error: uploadError } = await supabase.storage.from("captures").uploadToSignedUrl(slot.objectKey, slot.token, pdfFile, { contentType: slot.mimeType });
      if (uploadError) throw uploadError;
      const response = await fetch("/v1/captures/documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ asset: { objectKey: slot.objectKey, fileName: slot.fileName, mimeType: slot.mimeType, sizeBytes: slot.sizeBytes }, note: note.trim() || null }) });
      const body = await response.json() as { capture?: { id: string }; message?: string };
      if (!response.ok || !body.capture) throw new Error(body.message ?? "Could not create the PDF capture");
      setStatus("saved"); setTimeout(() => router.push(`/captures/${body.capture!.id}`), 500);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "PDF upload failed"); setStatus("idle"); }
  }

  async function saveText() {
    setStatus("saving"); setError("");
    try {
      const text = plainText.trim();
      if (!text) throw new Error("Paste some text to save.");
      if (text.length > 250_000) throw new Error("Pasted text must be no longer than 250,000 characters.");
      const response = await fetch("/v1/captures/text", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, note: note.trim() || null }) });
      const body = await response.json() as { capture?: { id: string }; message?: string };
      if (!response.ok || !body.capture) throw new Error(body.message ?? "Could not save this text");
      setStatus("saved"); setTimeout(() => router.push(`/captures/${body.capture!.id}`), 500);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Save failed"); setStatus("idle"); }
  }

  return <Shell eyebrow="Works in every mobile browser" title="Add something worth keeping">
    <div className="capture-workspace"><div className="capture-tabs"><button className={mode === "images" ? "active" : ""} onClick={() => setMode("images")}><Camera size={17} /> Screenshots & photos</button><button className={mode === "pdf" ? "active" : ""} onClick={() => setMode("pdf")}><FileText size={17} /> PDF</button><button className={mode === "link" ? "active" : ""} onClick={() => setMode("link")}><Link2 size={17} /> Web or YouTube</button><button className={mode === "text" ? "active" : ""} onClick={() => setMode("text")}><AlignLeft size={17} /> Text</button></div>
      {mode === "images" ? <section className="capture-panel"><label className="drop-zone"><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={(event) => chooseFiles(event.target.files)} /><span><UploadCloud size={28} /></span><h2>{files.length ? `${files.length} image${files.length === 1 ? "" : "s"} selected` : "Choose screenshots or photos"}</h2><p>Select up to {maxImagesPerCapture} images. They’ll be read in this order as one capture.</p></label>{previews.length ? <div className="preview-grid">{previews.map((preview, index) => <div key={`${preview.file.name}-${index}`}><img src={preview.url} alt={`Selected page ${index + 1}`} /><span>{index + 1}</span><button onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${preview.file.name}`}><X size={13} /></button></div>)}</div> : <div className="capture-tip"><FileImage size={18} /><span>On iPhone or Android, this opens your photo library so you can select one or several screenshots or photos.</span></div>}</section> : mode === "pdf" ? <section className="capture-panel"><label className="drop-zone"><input type="file" accept="application/pdf,.pdf" onChange={(event) => choosePdf(event.target.files)} /><span><FileText size={28} /></span><h2>{pdfFile?.name ?? "Choose a PDF"}</h2><p>Upload one PDF up to 25 MB. Text, scanned pages, tables, charts, and diagrams will be analyzed.</p></label>{pdfFile && <div className="selected-document"><FileText size={20} /><div><b>{pdfFile.name}</b><span>{(pdfFile.size / 1024 / 1024).toFixed(1)} MB</span></div><button onClick={() => setPdfFile(null)} aria-label={`Remove ${pdfFile.name}`}><X size={15} /></button></div>}</section> : mode === "link" ? <section className="capture-panel"><div className="link-visual"><span><Play size={23} /></span><span><Link2 size={23} /></span></div><label className="capture-label">Paste one or several web or YouTube links<textarea inputMode="url" value={linksText} onChange={(event) => setLinksText(event.target.value)} placeholder={"https://example.com/article\nhttps://youtube.com/watch?v=…"} /></label>{linksText.trim() && <div className={parsedUrls.length && !tooManyLinks ? "link-count" : "link-count invalid"}>{tooManyLinks ? "More than 50 links detected — split this into two saves" : parsedUrls.length ? `${parsedUrls.length} separate link${parsedUrls.length === 1 ? "" : "s"} detected` : "No complete links detected"}</div>}<div className="capture-tip"><Play size={18} /><span>Paste up to 50 links separated by spaces, commas, or numbered-list text. YouTube captions use a resilient transcript fallback when direct retrieval fails.</span></div></section> : <section className="capture-panel"><label className="capture-label">Paste text<textarea className="plain-text-input" value={plainText} onChange={(event) => setPlainText(event.target.value)} maxLength={250_000} placeholder="Paste an article excerpt, notes, a transcript, or any other text you want summarized and connected to your library." /></label><div className="text-count">{plainText.length.toLocaleString()} / 250,000 characters</div><div className="capture-tip"><AlignLeft size={18} /><span>This is useful when a website blocks automated readers: copy the page text in your browser and save it here.</span></div></section>}
      <section className="capture-note"><label className="capture-label">Why does this matter? <small>Optional</small><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} placeholder="A quick thought helps the weekly synthesis understand why you saved it." /></label></section>
      {error && <div className="capture-error">{error}</div>}<button className="save-capture" disabled={status !== "idle" || (mode === "images" ? !files.length : mode === "pdf" ? !pdfFile : mode === "link" ? !parsedUrls.length || tooManyLinks : !plainText.trim())} onClick={mode === "images" ? saveImages : mode === "pdf" ? savePdf : mode === "link" ? saveLink : saveText}>{status === "saving" ? <><LoaderCircle className="spin" size={18} /> Saving…</> : status === "saved" ? <><Check size={18} /> Saved</> : mode === "images" ? "Upload capture" : mode === "pdf" ? "Upload PDF" : mode === "text" ? "Save text" : parsedUrls.length > 1 ? `Save ${parsedUrls.length} links` : "Save link"}</button>
    </div>
  </Shell>;
}
