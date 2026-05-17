"use client";

import { useEffect, useState } from "react";
import { Tweet } from "./types";

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--accent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        font: `600 ${Math.round(size * 0.4)}px var(--font-mono)`,
        color: "#fff",
        flexShrink: 0,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function SentimentIndicator({ sentiment }: { sentiment?: string }) {
  if (sentiment === "bull") {
    return (
      <span style={{ color: "var(--pos)", fontWeight: 600 }}>
        ▲
      </span>
    );
  }
  if (sentiment === "bear") {
    return (
      <span style={{ color: "var(--neg)", fontWeight: 600 }}>
        ▼
      </span>
    );
  }
  return (
    <span style={{ color: "var(--data-amber)", fontWeight: 600 }}>
      ◆
    </span>
  );
}

function timeSince(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function TweetStream() {
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTweets = async () => {
      try {
        const res = await fetch("/api/tweets?query=PEPE&limit=20");
        if (!res.ok) throw new Error("Failed to fetch tweets");
        const data = await res.json();
        setTweets(data.tweets || []);
      } catch {
        setTweets([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTweets();
    const interval = setInterval(fetchTweets, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{ marginBottom: "32px" }}>
        <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
          Live tweets
        </div>
        <div style={{ opacity: 0.5 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: "32px" }}>
      <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
        Live tweets
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {tweets.map((tweet) => (
          <div
            key={tweet.tweetId}
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-2)",
              padding: "12px",
              display: "flex",
              gap: "12px",
            }}
          >
            {/* Avatar */}
            <Avatar name={tweet.authorUsername} size={32} />

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{ fontWeight: 600, color: "var(--fg-1)", fontSize: "13px" }}>
                  {tweet.authorName}
                </span>
                <span style={{ color: "var(--fg-3)", fontSize: "12px" }}>
                  @{tweet.authorUsername}
                </span>
                <span style={{ color: "var(--fg-4)", fontSize: "11px" }}>
                  · {tweet.authorFollowers.toLocaleString()} followers
                </span>
                <span style={{ color: "var(--fg-4)", fontSize: "11px" }}>
                  · {timeSince(tweet.createdAt)}
                </span>
              </div>

              {/* Tweet text */}
              <div style={{ fontSize: "13px", color: "var(--fg-2)", lineHeight: 1.5, marginBottom: "8px" }}>
                {tweet.text}
              </div>

              {/* Engagement + Sentiment */}
              <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "12px", color: "var(--fg-3)" }}>
                <span>❤ {tweet.likeCount.toLocaleString()}</span>
                <span>🔄 {tweet.retweetCount.toLocaleString()}</span>
                <span style={{ marginLeft: "auto" }}>
                  <SentimentIndicator sentiment={tweet.sentiment} />
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
