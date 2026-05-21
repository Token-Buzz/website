"use client";

import { AnalyzingIndicator } from "./AnalyzingIndicator";
import { useObjectPolling } from "./useAggregatePolling";

type Props = { query: string };

interface TweetRow {
  tweetId: string;
  text: string;
  authorUsername: string;
  authorName: string;
  createdAt: string;
  likeCount: number;
  retweetCount: number;
  sentiment?: string;
}

interface ApiResponse {
  tweets: TweetRow[];
  query: string;
}

function fmtTime(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return iso.slice(0, 16);
  }
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const COL_STYLES: React.CSSProperties = {
  padding: "7px 10px",
  borderBottom: "1px solid var(--border)",
  font: "500 12px var(--font-mono)",
  color: "var(--fg-2)",
  verticalAlign: "top",
};

const HEADER_STYLE: React.CSSProperties = {
  padding: "4px 10px 8px",
  font: "600 10px var(--font-mono)",
  color: "var(--fg-4)",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  borderBottom: "1px solid var(--border)",
  textAlign: "left",
};

export function TweetsResultsTable({ query }: Props) {
  const url = query
    ? `/api/tweets?query=${encodeURIComponent(query)}&limit=20`
    : null;

  const { data, loading, error } = useObjectPolling<ApiResponse>(url, {
    isPopulated: (d) => d.tweets.length > 0,
  });

  if (error)
    return (
      <div style={{ color: "#dc2626", fontSize: 13 }}>Failed to load: {error}</div>
    );

  if (loading && !data) return <AnalyzingIndicator label="Loading tweets…" />;

  const tweets = data?.tweets ?? [];

  if (tweets.length === 0) {
    return (
      <div
        style={{
          padding: "24px 0",
          textAlign: "center",
          font: "500 12px var(--font-mono)",
          color: "var(--fg-4)",
        }}
      >
        No data
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto", marginTop: 8 }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
        }}
      >
        <colgroup>
          <col style={{ width: 120 }} />
          <col style={{ width: 100 }} />
          <col />
          <col style={{ width: 60 }} />
        </colgroup>
        <thead>
          <tr>
            <th style={HEADER_STYLE}>Time</th>
            <th style={HEADER_STYLE}>Author</th>
            <th style={HEADER_STYLE}>Tweet</th>
            <th style={{ ...HEADER_STYLE, textAlign: "right" }}>Likes</th>
          </tr>
        </thead>
        <tbody>
          {tweets.map((t) => (
            <tr key={t.tweetId} style={{ transition: "background 150ms" }}>
              <td
                style={{
                  ...COL_STYLES,
                  color: "var(--fg-4)",
                  fontSize: 11,
                  whiteSpace: "nowrap",
                }}
              >
                {fmtTime(t.createdAt)}
              </td>
              <td
                style={{
                  ...COL_STYLES,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                @{t.authorUsername}
              </td>
              <td
                style={{
                  ...COL_STYLES,
                  overflow: "hidden",
                  // Clamp to 2 lines
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {t.text}
              </td>
              <td
                style={{
                  ...COL_STYLES,
                  textAlign: "right",
                  color: "var(--fg-3)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmtNum(t.likeCount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
