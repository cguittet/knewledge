"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteCaptureButton({ captureId }: { captureId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function deleteCapture() {
    if (!window.confirm("Delete this item from your library? This cannot be undone.")) return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`/v1/captures/${captureId}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? "Could not delete this item");
      }
      router.replace("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete this item");
      setDeleting(false);
    }
  }

  return <div className="delete-capture-wrap">
    <button className="delete-capture" type="button" onClick={deleteCapture} disabled={deleting}>
      {deleting ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}
      {deleting ? "Deleting…" : "Delete item"}
    </button>
    {error && <small>{error}</small>}
  </div>;
}
