"use client";

import { useEffect, useRef } from "react";
import { useSummaryContext } from "./SummaryProvider";

export function HistorySaver({
  submission,
}: {
  submission: { query: string; id: string } | null;
}) {
  const { query, data, loading } = useSummaryContext();
  const savedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!submission) return;
    if (savedIdRef.current === submission.id) return; // already saved this submission
    if (query !== submission.query) return; // summary context is for this submission's query
    if (loading || !data) return; // wait until the summary settles with data

    savedIdRef.current = submission.id;
    void fetch("/api/history/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: submission.query, snapshot: data }),
    }).catch(() => {
      // best-effort; a failed history save must not disrupt analytics
    });
  }, [submission, query, data, loading]);

  return null;
}
