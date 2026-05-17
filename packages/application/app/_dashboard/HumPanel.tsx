"use client";

import { useEffect, useRef, useState } from "react";

interface Message {
  from: "you" | "hum";
  text: string;
}

const SUGGESTIONS = [
  "What is the current market sentiment for PEPE?",
  "Show me recent spikes in mention volume",
  "Which tokens are trending right now?",
];

export function HumPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const newMessages: Message[] = [...messages, { from: "you", text: input }];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    try {
      const response = await fetch("/api/hum/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          history: newMessages.filter((m) => m.from !== "you" || newMessages.indexOf(m) < newMessages.length - 1),
        }),
      });

      if (!response.ok) {
        setMessages([...newMessages, { from: "hum", text: "Error connecting to HUM." }]);
        setStreaming(false);
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") break;

            try {
              const data = JSON.parse(dataStr);
              fullText += data.text || "";
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.from === "hum") {
                  return [...prev.slice(0, -1), { from: "hum", text: fullText }];
                }
                return [...prev, { from: "hum", text: fullText }];
              });
            } catch {
              // Invalid JSON, skip
            }
          }
        }
      }
    } catch (error) {
      setMessages((prev) => [...prev, { from: "hum", text: "Connection error. Please try again." }]);
    } finally {
      setStreaming(false);
    }
  };

  const showSuggestions = messages.length < 2;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: "380px",
        height: "100vh",
        background: "var(--bg)",
        border: `1px solid var(--border)`,
        borderRight: "none",
        display: "flex",
        flexDirection: "column",
        zIndex: 1000,
        boxShadow: "-4px 0 12px rgba(0, 0, 0, 0.1)",
      }}
    >
      {/* Header */}
      <div style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}>
        <div
          style={{
            background: "var(--inv-bg)",
            color: "var(--inv-fg)",
            padding: "12px 16px",
            borderRadius: "var(--r-1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: 700 }}>HUM.</div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--inv-fg)",
              cursor: "pointer",
              fontSize: "18px",
              padding: "0",
              width: "24px",
              height: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>
        <div style={{ fontSize: "12px", color: "var(--fg-3)" }}>
          AI market insights
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              justifyContent: msg.from === "you" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "280px",
                padding: "10px 12px",
                borderRadius: "var(--r-2)",
                fontSize: "13px",
                lineHeight: 1.5,
                background: msg.from === "you" ? "var(--accent)" : "var(--bg-elevated)",
                color: msg.from === "you" ? "#fff" : "var(--fg-1)",
                border: msg.from === "you" ? "none" : "1px solid var(--border)",
                wordWrap: "break-word",
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {streaming && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "var(--r-2)",
                background: "var(--bg-elevated)",
                color: "var(--fg-3)",
                fontSize: "13px",
              }}
            >
              ·····
            </div>
          </div>
        )}

        {showSuggestions && !streaming && messages.length === 0 && (
          <div style={{ marginTop: "auto" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>
              Try asking
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                  }}
                  style={{
                    padding: "10px 12px",
                    fontSize: "12px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-1)",
                    color: "var(--fg-2)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 200ms",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-sunken)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-elevated)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div style={{ padding: "16px", borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask HUM anything..."
            style={{
              flex: 1,
              padding: "10px 12px",
              fontSize: "13px",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-1)",
              background: "var(--bg-elevated)",
              color: "var(--fg-1)",
              fontFamily: "var(--font-sans)",
              resize: "none",
              minHeight: "40px",
              maxHeight: "100px",
              outline: "none",
              transition: "border-color 200ms",
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLTextAreaElement).style.borderColor = "var(--accent)";
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLTextAreaElement).style.borderColor = "var(--border)";
            }}
            disabled={streaming}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || streaming}
            style={{
              padding: "10px 12px",
              fontSize: "13px",
              fontWeight: 600,
              border: "1px solid var(--border)",
              background: input.trim() && !streaming ? "var(--accent)" : "var(--bg-sunken)",
              color: input.trim() && !streaming ? "#fff" : "var(--fg-4)",
              borderRadius: "var(--r-1)",
              cursor: input.trim() && !streaming ? "pointer" : "default",
              transition: "all 200ms",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (input.trim() && !streaming) {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--accent)";
                (e.currentTarget as HTMLButtonElement).style.opacity = "0.9";
              }
            }}
            onMouseLeave={(e) => {
              if (input.trim() && !streaming) {
                (e.currentTarget as HTMLButtonElement).style.opacity = "1";
              }
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
