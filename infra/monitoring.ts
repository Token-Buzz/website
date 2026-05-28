const isProd = $app.stage === "production";

// Tripwire alarm for the shared GeckoTerminal rate-limit counter (M6 P6 + M7 P5).
// rate-limit.ts emits an EMF metric (TokenBuzz/RateLimit / ProviderCallsPerMin,
// dimension Provider) whenever a provider's per-minute call count reaches 80% of
// its cap. This alarm trips when geckoterminal approaches its 30 req/min free cap.
// Metric namespace/name/dimension MUST match packages/core/src/db/rate-limit.ts.
if (isProd) {
  new aws.cloudwatch.MetricAlarm("GeckoTerminalRateLimitAlarm", {
    name: `website-${$app.stage}-geckoterminal-ratelimit`,
    alarmDescription:
      "GeckoTerminal calls/min approaching the ~30/min free-tier cap (warn at 80% = 20). Counter shared by getOHLCV + the M7 ticker snapshot.",
    namespace: "TokenBuzz/RateLimit",
    metricName: "ProviderCallsPerMin",
    dimensions: { Provider: "geckoterminal" },
    statistic: "Maximum",
    period: 60,
    evaluationPeriods: 1,
    threshold: 20, // floor(GECKOTERMINAL_LIMIT * 0.8) = floor(25 * 0.8)
    comparisonOperator: "GreaterThanOrEqualToThreshold",
    treatMissingData: "notBreaching",
  });
}
