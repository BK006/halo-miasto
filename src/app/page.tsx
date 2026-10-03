"use client";

import { useRef, useState } from "react";

// Step 0 skeleton: pick/take a photo and preview it.
// Next steps wire this to /api/analyze and the report flow.
export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function onFile(file: File | undefined) {
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  }

  return (
    <main className="flex flex-1 flex-col px-5 pt-[max(env(safe-area-inset-top),24px)] pb-[max(env(safe-area-inset-bottom),20px)]">
      <header className="pt-6">
        <h1 className="text-3xl font-semibold tracking-tight">Zgłoś to</h1>
        <p className="mt-2 text-muted">Zrób zdjęcie problemu w mieście. Resztą zajmiemy się my.</p>
      </header>

      <section className="mt-8 flex flex-1 items-center justify-center overflow-hidden rounded-3xl bg-surface">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Wybrane zdjęcie" className="h-full w-full object-cover" />
        ) : (
          <p className="px-8 text-center text-muted">Dziura, latarnia, wysypisko, auto pod bramą…</p>
        )}
      </section>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-6 h-14 w-full rounded-2xl bg-accent text-lg font-semibold text-accent-foreground active:scale-[0.98] transition-transform"
      >
        {preview ? "Zrób inne zdjęcie" : "Zrób zdjęcie"}
      </button>
    </main>
  );
}
