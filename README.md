<div align="center">

# Token Buzz

### Real-time crypto social intelligence.

*Surfaces the tokens the internet is talking about right now — social signal, narratives, and alerts across X, Farcaster, Reddit, and Telegram.*

---

![CI](https://github.com/Token-Buzz/website/actions/workflows/deploy.yml/badge.svg)
![Status](https://img.shields.io/badge/status-production-brightgreen?style=flat-square)
![License](https://img.shields.io/badge/license-proprietary-red?style=flat-square)
![PRs](https://img.shields.io/badge/PRs-by%20invitation-blueviolet?style=flat-square)
[![Docs](https://img.shields.io/badge/docs-GitBook-3884FF?style=flat-square&logo=gitbook&logoColor=white)](https://runtimedesigns.gitbook.io/token-buzz/)

![Next.js](https://img.shields.io/badge/Next.js-black?style=flat-square&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-232F3E?style=flat-square&logo=amazonaws&logoColor=white)
![DynamoDB](https://img.shields.io/badge/DynamoDB-4053D6?style=flat-square&logo=amazondynamodb&logoColor=white)
![Clerk](https://img.shields.io/badge/Clerk-6C47FF?style=flat-square&logo=clerk&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-635BFF?style=flat-square&logo=stripe&logoColor=white)

</div>

---

## 🌱 Origins — From Java/ECS to Serverless

Token Buzz began life as a very different application. Its original incarnation was written in **Java** and lived at **[gitlab.com/fintechmetrix](https://gitlab.com/fintechmetrix)**, running on **AWS ECS** — a fleet of long-running, always-on containers that had to be provisioned, orchestrated, patched, and paid for around the clock regardless of how much traffic they actually served.

This codebase is a ground-up re-platforming of that project. Rather than port the Java stack container-for-container, it was **re-architected into a completely serverless TypeScript / Next.js application on AWS** — trading the always-on container model for on-demand functions, an on-demand database, and a global edge network, all defined as infrastructure-as-code and shipped through CI/CD.

The payoff is a dramatically **leaner, cost-optimized platform**. There are no idle containers burning money between requests: compute runs on **AWS Lambda** and scales to zero when nothing is happening, then scales out elastically under load with no capacity planning. State lives in **on-demand DynamoDB** (a single-table design) that charges per request rather than per provisioned node, and **CloudFront** serves the apps from the global edge. Eliminating container orchestration, host patching, and standing capacity collapses both the operational overhead and the total cost of ownership — you pay only for actual usage.

| | Before — Java on ECS | After — Serverless Next.js |
|---|---|---|
| **Language / runtime** | Java | TypeScript / Next.js |
| **Compute** | Always-on ECS containers | AWS Lambda functions |
| **Scaling** | Manual / provisioned capacity | Automatic, elastic, scale-to-zero |
| **Database** | Provisioned | On-demand DynamoDB (single-table) |
| **Delivery** | Container service | CloudFront global CDN |
| **Infra & deploy** | Container orchestration | SST infrastructure-as-code + CI/CD |
| **Cost model** | Pay for idle, always-on capacity | Pay-per-use, no idle cost |
| **Ops overhead** | Patching, orchestration, capacity planning | Fully managed, minimal maintenance |

---

## Overview

Token Buzz is a real-time SaaS platform for crypto intelligence. It continuously monitors social activity across the web's most influential crypto communities, extracts signal from the noise, and delivers it through a fast, polished application — so traders, researchers, and analysts always know what narratives are forming before they fully break.

The platform combines a public marketing presence with a fully authenticated application, backed by a serverless cloud infrastructure built for scale and low latency.

---

## ✨ Features

- **📡 Live Movers Feed** — A real-time stream of tokens gaining social traction, ranked and refreshed continuously across all monitored sources.
- **🔍 Multi-Source Social Ingestion** — Aggregates signal from X (Twitter), Farcaster, Reddit, and Telegram in a unified view.
- **📊 Analytics & Charts** — Price candlestick charts, volume overlays, and trend analytics for any tracked token.
- **🗂️ Watchlists & Dashboards** — Fully customizable watchlists and dashboard layouts so every user sees what matters to them.
- **🤖 AI-Generated Narratives** — A daily AI-produced brief that distills the biggest stories, emerging narratives, and community sentiment shifts.
- **🔔 Real-Time Alerts** — Configurable alerts triggered by social spikes, sentiment shifts, and momentum events — delivered the moment they happen.
- **🕑 Query History** — Persistent, searchable history of past signals and queries for research and backtesting.
- **👤 Account & Billing** — Self-serve subscription management, plan upgrades, and account settings powered by a world-class payments infrastructure.

---

## 📚 Documentation

Full product, security, and developer documentation lives on GitBook:

**➡️ [runtimedesigns.gitbook.io/token-buzz](https://runtimedesigns.gitbook.io/token-buzz/)**

| Section | What's inside |
|---|---|
| **Getting Started** | Product overview, quickstart, and account & billing. |
| **Product Guide** | Every feature — Movers, Live Feed, Alerts, Watchlists & Dashboards, Analytics, Hum AI, Charts, Query History, and the command palette. |
| **Connecting Data** | How to bring your own data sources. |
| **Security & Compliance** | Security posture, data handling & encryption, and the shared-responsibility model. |
| **Developers / API** | API surfaces and authentication. |

---

## 🏗️ Architecture

### System Overview

A high-level view of how data flows from raw social activity through to the end user.

```mermaid
flowchart TD
    subgraph Sources["Social Sources"]
        X["X / Twitter"]
        FC["Farcaster"]
        RD["Reddit"]
        TG["Telegram"]
    end

    subgraph Ingestion["Ingestion Layer"]
        Poller["Multi-Source Ingestors"]
        Normalizer["Normalization & Deduplication"]
    end

    subgraph Processing["Processing & Analysis"]
        Scorer["Signal Scoring Engine"]
        AI["AI Narrative Engine"]
        Alerting["Alert Evaluation"]
    end

    subgraph Store["Data Platform"]
        DB[("Serverless NoSQL Data Store")]
    end

    subgraph Delivery["Delivery Layer"]
        API["Serverless API"]
        Marketing["Public Marketing Site"]
        App["Authenticated Application"]
    end

    subgraph User["End User"]
        Browser["Browser"]
    end

    X & FC & RD & TG --> Poller
    Poller --> Normalizer
    Normalizer --> Scorer
    Scorer --> AI
    Scorer --> Alerting
    Scorer --> DB
    AI --> DB
    Alerting --> DB
    DB --> API
    API --> App
    Marketing --> Browser
    App --> Browser
```

### Signal-to-Insight Flow

A sequence view of how a social spike becomes a delivered alert or narrative.

```mermaid
sequenceDiagram
    autonumber
    participant S as Social Network
    participant I as Ingestor
    participant P as Processing Engine
    participant D as Data Store
    participant A as Application API
    participant U as User

    S->>I: New posts / activity
    I->>I: Normalize and deduplicate
    I->>P: Enqueue signal batch
    P->>P: Score and rank tokens
    P->>D: Persist scored signals
    P->>P: Evaluate alert conditions
    alt Alert threshold crossed
        P->>D: Write alert event
        A->>U: Deliver real-time alert
    end
    P->>P: Generate AI narrative summary
    P->>D: Persist narrative
    U->>A: Request feed or dashboard
    A->>D: Query ranked signals
    D->>A: Return results
    A->>U: Render live movers and insights
```

---

## 🧰 Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js · React · TypeScript · Tailwind CSS |
| **Backend** | Serverless functions on AWS · TypeScript |
| **Infrastructure** | AWS (fully serverless) · Infrastructure-as-Code · Global CDN |
| **Data** | DynamoDB (single-table design) · Real-time event processing |
| **Auth** | Clerk |
| **Billing** | Stripe |
| **AI** | Large language model summaries and narrative generation |
| **Social Ingestion** | Multi-source adapters — X, Farcaster, Reddit, Telegram |

---

## 📈 Status

> **Actively developed. Continuously shipping.**

Token Buzz is in production and serving live users. The platform is under active development, with new signal sources, analytics features, and AI capabilities rolling out on an ongoing basis.

---

<div align="center">

© 2026 Token Buzz. All rights reserved.

This is **proprietary software**. Unauthorized copying, distribution, modification, or use is strictly prohibited.

*This is a private repository. Access is by invitation only.*

</div>
