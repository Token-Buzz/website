# Sizing & Cost

Choosing the right VU count means matching the load to the traffic you actually need to survive — not picking an arbitrarily large number.

---

## What is a VU?

A **VU (virtual user)** is one simulated user — an independent worker that loops through the request list. More VUs means more simultaneous load. Two tests at the same VU count can produce very different pressure on the system: what matters downstream is **requests per second (RPS)**, not raw VU count. The harness scripts sleep ~1 second between requests, so here **1 VU ≈ 1 RPS**.

---

## Choosing the right VU count

### 1. Measure real peak load, then multiply

Target = (observed peak RPS) × a **2–5× safety margin**. Size to the *peak* hour, not the daily average — traffic is bursty and the peak hour is often 2–5× the mean hour.

### 2. Before you have traffic, estimate from a goal

Pick a target daily active user (DAU) number and apply these heuristics:

- **Peak concurrent users ≈ 5–10% of DAU**
- A browsing user generates ~0.1–1 RPS

**Example:** 5,000 DAU → ~250–500 concurrent users → a few hundred RPS → test around 500–1,000 VUs with a safety margin. Re-baseline against real numbers as soon as real traffic exists.

### 3. The harness cap

**This harness is capped at 50 VUs / ~20 RPS on purpose** — enough to confirm the read paths are healthy while staying within $0 free-tier quotas. Raise it only when real traffic data justifies it.

---

## Where to get real traffic numbers

- **CloudWatch (already collecting, free):** the ground truth. Watch Lambda **`ConcurrentExecutions`** (peak concurrent) and Lambda/CloudFront **request count per minute** — that *is* your load, directly replicable as RPS.
- **A web-analytics tool** (Plausible, Cloudflare Web Analytics, Vercel Analytics): sessions, concurrent visitors, and page views.

---

## When to scale up — and what it costs

VUs consume memory and CPU on the machine running k6 (~a few MB each):

- **Up to a few thousand VUs** — fine on one decent machine or laptop.
- **10k–100k VUs** — requires **distributed load generation** (a fleet of load generators, or a commercial service like Grafana Cloud k6). On a single machine you saturate the *generator* first and end up measuring the test rig rather than the application.

There are two cost buckets: running k6, and the AWS bill from the traffic it generates (Lambda + DynamoDB + CloudFront). Rough order-of-magnitude for this stack: ~$5–8 per **million** requests to the authed API routes (Lambda-dominated; marketing pages are mostly CloudFront-cached and near-free). Assuming ~1 RPS/VU over a 10-minute run:

| Test | ≈ RPS | Requests (10 min) | Load-gen cost | AWS cost | Also needs |
|---|---|---|---|---|---|
| **500 VUs** | ~500 | ~300k | ~$0 (laptop / one small VM) | **~$1–3** | nothing — runs as-is |
| **100k VUs** | ~100k | ~60M | **$10–50/hr** fleet, or a commercial k6 plan | **~$250–500 per run** | raising the AWS Lambda concurrency limit ~100× (default ≈1,000) |

> **Caveat:** these are order-of-magnitude estimates. Real cost varies with response size, per-route DynamoDB reads, and Lambda duration and memory allocation. The takeaway: **500 VUs costs a couple of dollars and runs today; 100k VUs costs hundreds of dollars per run and requires a real engineering setup** — only justified at genuine consumer scale.
