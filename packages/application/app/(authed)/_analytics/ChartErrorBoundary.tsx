"use client";
import { Component, ReactNode } from "react";

interface Props { children: ReactNode; chartName: string }
interface State { error: Error | null }

export class ChartErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error(`[chart-error] ${this.props.chartName}:`, error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "16px 0", textAlign: "center", font: "500 12px var(--font-mono)", color: "var(--fg-4)" }}>
          Chart unavailable — try refreshing
        </div>
      );
    }
    return this.props.children;
  }
}
