"use client";

import { useRef, useState } from "react";

const MAX_SIDE = 1600;

/** Lets the editor pick a photo (also from a phone camera), shrinks it in the browser, and sends it with the form. */
export function ImagePicker({ current }: { current?: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const small = await shrink(file);
      const dt = new DataTransfer();
      dt.items.add(small);
      if (input.current) input.current.files = dt.files;
      setPreview(URL.createObjectURL(small));
    } catch {
      setPreview(URL.createObjectURL(file)); // keep the original if resizing is not possible
    } finally {
      setBusy(false);
    }
  }

  const shown = preview ?? current;
  return (
    <div className="space-y-3">
      {shown && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shown} alt="" className="max-h-64 w-full rounded-lg border border-line object-cover" />
      )}
      <input
        ref={input}
        type="file"
        name="image_file"
        accept="image/*"
        onChange={onChange}
        className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-semibold file:text-brand"
      />
      {busy && <p className="text-sm text-muted">در حال آماده‌سازی عکس…</p>}
    </div>
  );
}

async function shrink(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error("resize failed");
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}
