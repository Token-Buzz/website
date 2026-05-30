import { web } from "./marketing";
import { app } from "./application";
import {
  tweetsTable,
  aggregatesTable,
  tokensTable,
  userDataTable,
  authorLocationsTable,
  feedsTable,
} from "./db";
import { router } from "./router";

const isProd = $app.stage === "production";

// ── X-Ray sampling rule (free-tier guard) ─────────────────────────────────
// Priority 9000 wins over the AWS default (10000). reservoirSize=1 guarantees
// 1 traced request/sec; fixedRate=0.05 samples 5% of the remainder.
// At prod traffic volumes this stays well under the 100k-traces/month free tier.
new aws.xray.SamplingRule(`WebsiteXRaySamplingRule`, {
  ruleName: $interpolate`website-${$app.stage}-default`,
  priority: 9000,
  reservoirSize: 1,
  fixedRate: 0.05,
  host: "*",
  httpMethod: "*",
  urlPath: "*",
  serviceName: "*",
  serviceType: "*",
  resourceArn: "*",
  version: 1,
});

// ── CloudWatch dashboard ───────────────────────────────────────────────────
// Build the dashboard body as a Pulumi output so function names (which are
// auto-generated with random suffixes) resolve properly at deploy time.

// Helper: build a single Lambda Duration (p50/p95/p99) widget.
function lambdaDurationWidget(
  title: string,
  fnName: $util.Output<string>,
  x: number,
  y: number,
): $util.Output<object> {
  return fnName.apply((name) => ({
    type: "metric",
    x,
    y,
    width: 8,
    height: 6,
    properties: {
      title: `${title} — Duration`,
      view: "timeSeries",
      metrics: [
        ["AWS/Lambda", "Duration", "FunctionName", name, { stat: "p50", label: "p50" }],
        ["AWS/Lambda", "Duration", "FunctionName", name, { stat: "p95", label: "p95" }],
        ["AWS/Lambda", "Duration", "FunctionName", name, { stat: "p99", label: "p99" }],
      ],
      period: 300,
      region: "us-east-1",
    },
  }));
}

// Helper: build an Errors + Throttles + ConcurrentExecutions widget for a fn.
function lambdaHealthWidget(
  title: string,
  fnName: $util.Output<string>,
  x: number,
  y: number,
): $util.Output<object> {
  return fnName.apply((name) => ({
    type: "metric",
    x,
    y,
    width: 8,
    height: 6,
    properties: {
      title: `${title} — Errors / Throttles / Concurrency`,
      view: "timeSeries",
      metrics: [
        ["AWS/Lambda", "Errors", "FunctionName", name, { stat: "Sum", label: "Errors" }],
        ["AWS/Lambda", "Throttles", "FunctionName", name, { stat: "Sum", label: "Throttles" }],
        [
          "AWS/Lambda",
          "ConcurrentExecutions",
          "FunctionName",
          name,
          { stat: "Maximum", label: "ConcurrentExec" },
        ],
      ],
      period: 300,
      region: "us-east-1",
    },
  }));
}

// Helper: cold-start Logs Insights widget for a set of log groups.
function coldStartWidget(
  logGroupNames: $util.Output<string>[],
  x: number,
  y: number,
): $util.Output<object> {
  return $util.all(logGroupNames).apply((groups) => ({
    type: "log",
    x,
    y,
    width: 24,
    height: 6,
    properties: {
      title: "Cold Starts (INIT_DURATION > 0)",
      view: "table",
      query: `SOURCE ${groups.map((g) => `'${g}'`).join(", ")} | filter @type = "REPORT" and ispresent(@initDuration) | stats count() as coldStarts, avg(@initDuration) as avgInitMs by bin(5m)`,
      region: "us-east-1",
    },
  }));
}

// Helper: DynamoDB capacity + throttle widget for one table.
function dynamoWidget(
  title: string,
  tableName: $util.Output<string>,
  x: number,
  y: number,
): $util.Output<object> {
  return tableName.apply((name) => ({
    type: "metric",
    x,
    y,
    width: 8,
    height: 6,
    properties: {
      title: `DDB ${title}`,
      view: "timeSeries",
      metrics: [
        [
          "AWS/DynamoDB",
          "ConsumedReadCapacityUnits",
          "TableName",
          name,
          { stat: "Sum", label: "ReadCU" },
        ],
        [
          "AWS/DynamoDB",
          "ConsumedWriteCapacityUnits",
          "TableName",
          name,
          { stat: "Sum", label: "WriteCU" },
        ],
        [
          "AWS/DynamoDB",
          "ReadThrottleEvents",
          "TableName",
          name,
          { stat: "Sum", label: "ReadThrottles" },
        ],
        [
          "AWS/DynamoDB",
          "WriteThrottleEvents",
          "TableName",
          name,
          { stat: "Sum", label: "WriteThrottles" },
        ],
      ],
      period: 300,
      region: "us-east-1",
    },
  }));
}

// Derive Lambda function names from the SST component nodes.
// nodes.server is Output<Function>; Function.name is Output<string>.
const marketingFnName = web.nodes.server!.apply((s) => s.name);
const appFnName = app.nodes.server!.apply((s) => s.name);

// Log group names follow the AWS default convention.
const marketingLogGroup = marketingFnName.apply((n) => `/aws/lambda/${n}`);
const appLogGroup = appFnName.apply((n) => `/aws/lambda/${n}`);

// Row 0: Marketing duration + health (y=0)
const w0 = lambdaDurationWidget("Marketing", marketingFnName, 0, 0);
const w1 = lambdaHealthWidget("Marketing", marketingFnName, 8, 0);

// Row 0: Application duration + health (y=0, x=16)
const w2 = lambdaDurationWidget("Application", appFnName, 16, 0);

// Row 1: Application health (y=6)
const w3 = lambdaHealthWidget("Application", appFnName, 0, 6);

// Row 2: Cold-start log insights widget (y=12)
const w4 = coldStartWidget([marketingLogGroup, appLogGroup], 0, 12);

// Row 3: DynamoDB widgets (y=18) — six tables, 8 wide each, wrap at 3 per row
const w5 = dynamoWidget("Tweets", tweetsTable.name, 0, 18);
const w6 = dynamoWidget("Aggregates", aggregatesTable.name, 8, 18);
const w7 = dynamoWidget("Tokens", tokensTable.name, 16, 18);
const w8 = dynamoWidget("UserData", userDataTable.name, 0, 24);
const w9 = dynamoWidget("AuthorLocations", authorLocationsTable.name, 8, 24);
const w10 = dynamoWidget("Feeds", feedsTable.name, 16, 24);

// CloudFront widget — production only.
// router.distributionID is Output<string> (the CloudFront distribution ID).
const cfWidgets: $util.Output<object>[] = isProd
  ? [
      router.distributionID.apply((id) => ({
        type: "metric",
        x: 0,
        y: 30,
        width: 24,
        height: 6,
        properties: {
          title: "CloudFront",
          view: "timeSeries",
          metrics: [
            [
              "AWS/CloudFront",
              "Requests",
              "DistributionId",
              id,
              "Region",
              "Global",
              { stat: "Sum", label: "Requests" },
            ],
            [
              "AWS/CloudFront",
              "4xxErrorRate",
              "DistributionId",
              id,
              "Region",
              "Global",
              { stat: "Average", label: "4xxErrorRate" },
            ],
            [
              "AWS/CloudFront",
              "5xxErrorRate",
              "DistributionId",
              id,
              "Region",
              "Global",
              { stat: "Average", label: "5xxErrorRate" },
            ],
            [
              "AWS/CloudFront",
              "OriginLatency",
              "DistributionId",
              id,
              "Region",
              "Global",
              { stat: "p95", label: "OriginLatency p95" },
            ],
          ],
          period: 300,
          region: "us-east-1",
        },
      })),
    ]
  : [];

// Assemble and create the dashboard.
const allWidgets = $util.all([w0, w1, w2, w3, w4, w5, w6, w7, w8, w9, w10, ...cfWidgets]);

new aws.cloudwatch.Dashboard(`WebsitePerformanceDashboard`, {
  dashboardName: $interpolate`website-${$app.stage}-performance`,
  dashboardBody: allWidgets.apply((widgets) => JSON.stringify({ widgets })),
});

// ── Tripwire alarm for the shared GeckoTerminal rate-limit counter ─────────
// (M6 P6 + M7 P5). rate-limit.ts emits an EMF metric (TokenBuzz/RateLimit /
// ProviderCallsPerMin, dimension Provider) whenever a provider's per-minute
// call count reaches 80% of its cap.  This alarm trips when geckoterminal
// approaches its 30 req/min free cap.
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

  // ── Application server p95 latency alarm ────────────────────────────────
  new aws.cloudwatch.MetricAlarm("ApplicationServerP95LatencyAlarm", {
    name: `website-${$app.stage}-app-p95-latency`,
    alarmDescription:
      "Application server fn p95 duration ≥ 5 s for 3 consecutive 5-min periods.",
    namespace: "AWS/Lambda",
    metricName: "Duration",
    dimensions: appFnName.apply((name) => ({ FunctionName: name })),
    extendedStatistic: "p95",
    period: 300,
    evaluationPeriods: 3,
    threshold: 5000,
    comparisonOperator: "GreaterThanOrEqualToThreshold",
    treatMissingData: "notBreaching",
  });

  // ── Application server 5xx error-rate alarm (metric math) ───────────────
  // Fires when Errors / Invocations > 5% for 3 consecutive 5-min periods.
  new aws.cloudwatch.MetricAlarm("Application5xxErrorRateAlarm", {
    name: `website-${$app.stage}-app-5xx-error-rate`,
    alarmDescription:
      "Application server fn error rate (Errors / Invocations) ≥ 5% for 3 consecutive 5-min periods.",
    evaluationPeriods: 3,
    threshold: 5,
    comparisonOperator: "GreaterThanOrEqualToThreshold",
    treatMissingData: "notBreaching",
    metricQueries: appFnName.apply((name) => [
      {
        id: "errors",
        metric: {
          namespace: "AWS/Lambda",
          metricName: "Errors",
          dimensions: { FunctionName: name },
          period: 300,
          stat: "Sum",
        },
        returnData: false,
      },
      {
        id: "invocations",
        metric: {
          namespace: "AWS/Lambda",
          metricName: "Invocations",
          dimensions: { FunctionName: name },
          period: 300,
          stat: "Sum",
        },
        returnData: false,
      },
      {
        id: "error_rate",
        expression: "errors / invocations * 100",
        label: "ErrorRate%",
        returnData: true,
      },
    ]),
  });
}
