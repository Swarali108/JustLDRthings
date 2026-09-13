"use client";

import { useEffect, useState } from "react";

/** Small auto-dismissing confirmation banner driven by a query param. */
export function CreatedToast({ label }: { label: string }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 4000);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div className="banner" role="status">
      Saved your {label} ♡ — it&apos;s in your little things below.
    </div>
  );
}
