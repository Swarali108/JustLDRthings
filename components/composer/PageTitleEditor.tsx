"use client";

import { useState, useTransition } from "react";
import { updatePageTitle } from "@/app/page/actions";

export function PageTitleEditor({
  pageId,
  initialTitle
}: {
  pageId: string;
  initialTitle: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await updatePageTitle(pageId, title);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="field">
      <label htmlFor="page-title">Page title</label>
      <div className="title-row">
        <input
          id="page-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
          maxLength={120}
          placeholder="For You"
        />
        <button type="button" className="button button-light" onClick={save} disabled={pending}>
          {pending ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
      </div>
    </div>
  );
}
