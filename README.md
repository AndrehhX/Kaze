<div align="center">

# KAZE (風)
### High-Performance Anime Exploration & Realtime Streaming Ecosystem

[![Next.js 16](https://img.shields.io/badge/Next.js-16.4-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.3-20232a?style=for-the-badge&logo=react&logoColor=61dafb)](https://react.dev/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5.x_Strict-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Android Kotlin](https://img.shields.io/badge/Android-Kotlin_%7C_Compose-073042?style=for-the-badge&logo=android&logoColor=3ddc84)](https://developer.android.com/jetpack/compose)
[![Media3 ExoPlayer](https://img.shields.io/badge/Media3-ExoPlayer_1.5-1A73E8?style=for-the-badge&logo=google&logoColor=white)](https://developer.android.com/media/media3)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_%7C_RLS-1c1c1c?style=for-the-badge&logo=supabase&logoColor=3ecf8e)](https://supabase.com/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4.0-0f172a?style=for-the-badge&logo=tailwindcss&logoColor=38bdf8)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Proprietary_%2F_All_Rights_Reserved-red?style=for-the-badge)](LICENSE)

<br />

[**Explore Live Web**](https://www.orunei.sbs) • [**Download Android APK**](https://www.orunei.sbs/kaze.apk) • [**Architecture**](#-system-architecture) • [**Features**](#-core-capabilities) • [**Setup Guide**](#-getting-started) • [**Legal Disclaimer**](#-legal--compliance-disclaimer)

<br />

</div>

---

## 📋 Table of Contents
- [Executive Overview](#-executive-overview)
- [System Architecture](#-system-architecture)
- [Core Capabilities](#-core-capabilities)
  - [Adaptive Video Delivery](#1-adaptive-video-delivery--playback)
  - [Realtime Synchronized Watch Parties](#2-realtime-synchronized-watch-parties)
  - [Native Android Experience](#3-native-android-client-jetpack-compose)
  - [Deterministic Library Sync](#4-offline-first-library--cloud-synchronization)
- [Tech Stack & Engineering Foundations](#-tech-stack--engineering-foundations)
- [Security & Hardening](#-security--hardening)
- [Getting Started & Local Development](#-getting-started)
  - [Web Client (Next.js 16)](#web-client-nextjs-16)
  - [Android Client (Compose + Media3)](#android-client-jetpack-compose)
  - [Environment Variables](#environment-variables-reference)
- [Quality Assurance & Automated Verification](#-quality-assurance--automated-verification)
- [Legal & Compliance Disclaimer](#-legal--compliance-disclaimer)
- [Intellectual Property & Licensing](#-intellectual-property--licensing)

---

## ⚡ Executive Overview

**KAZE** (operating in production as [Orunei](https://www.orunei.sbs)) is an enterprise-grade, cross-platform streaming, catalog aggregation, and discovery platform built for the anime ecosystem.

Engineered under a strict monorepo layout, KAZE pairs a sub-millisecond reactive web application powered by **Next.js 16 (App Router)** and **React 19** with an offline-first native **Android client** built in **Kotlin**, **Jetpack Compose**, and **AndroidX Media3 (ExoPlayer)**.

The platform eliminates the bloat, intrusive advertisement vectors, and latency bottlenecks typical of legacy streaming indexes by decoupling catalog indexing, video stream resolution, edge session authorization, and realtime peer synchronization into dedicated, high-availability layers.

---

## 🏛 System Architecture

The following diagram outlines the data flow between client platforms, the serverless edge runtime, metadata aggregators, and the database persistence tier:

```mermaid
flowchart TD
    subgraph Clients["Client Tier"]
        Web["Web Client (Next.js 16 / React 19)"]
        Mobile["Android App (Kotlin / Compose / Media3)"]
    end

    subgraph EdgeTier["Edge & Gateway Tier"]
        Proxy["Next.js Route Handlers & Edge Runtime"]
        SessionAuth["Session Grant & Entitlement Guard (/api/playback/session)"]
        AniSkipProxy["AniSkip Interval Resolver"]
    end

    subgraph External["External Catalog & Data Sources"]
        AniList["AniList GraphQL API (Metadata, Taxonomy, Schedules)"]
        HLSStreams["Decentralized HLS Stream Providers (M3U8 / MP4)"]
    end

    subgraph Backend["Data & State Persistence Tier (Supabase)"]
        DB[("PostgreSQL (RLS, Migrations, Procedures)")]
        WS["Supabase Realtime (WebSocket Broadcast & Presence)"]
        Auth["GoTrue Auth (Email + PKCE OAuth)"]
        Vault["AES-256-GCM Secure Credential Vault"]
    end

    Web -->|HTTPS / SSR| Proxy
    Mobile -->|HTTPS / REST| Proxy
    Proxy --> SessionAuth
    Proxy --> AniList
    SessionAuth --> HLSStreams
    Web --> AniSkipProxy
    Mobile --> AniSkipProxy

    Web <-->|WebSockets (Lockstep Drift Sync)| WS
    Mobile <-->|WebSockets (Watch Party Protocol)| WS

    Proxy --> DB
    Proxy --> Auth
    Proxy --> Vault
```

### Monorepo Structure

```
kaze/
├── src/                         # Next.js 16 Web Application
│   ├── app/                     # App Router pages, SSR layouts & API endpoints
│   │   ├── api/                 # Playback session grants, AniList OAuth & ad proxies
│   │   ├── anime/[id]/          # Catalog detail, character matrix & episode indexes
│   │   ├── watch/[id]/[ep]/     # Hardware-accelerated adaptive video player
│   │   └── party/               # Realtime multi-user synchronized watch rooms
│   ├── components/              # Modular Radix UI + Motion design system
│   ├── lib/                     # Domain logic & utility kernels
│   │   ├── anilist/             # Typed GraphQL queries, caching & deduping client
│   │   ├── media/               # Dynamic stream extraction & AniSkip integrations
│   │   ├── recommend.ts         # Multi-factor catalog recommendation heuristic
│   │   └── watch-party/         # Drift-correcting lockstep playback engine
│   └── stores/                  # Zustand 5 client stores (persisted settings, UI state)
├── mobile/                      # Production Android Client
│   ├── app/src/main/java/com/kaze/mobile/
│   │   ├── core/                # Encrypted storage, Room DB, networking, UI tokens
│   │   ├── data/                # Remote repositories, Media3 loaders, GraphQL clients
│   │   ├── domain/              # Business models, sync planner, state machine
│   │   └── feature/             # Compose screens (Home, Player, Library, WatchParty)
│   └── build.gradle.kts         # Multi-module Gradle build setup (minSdk 26, targetSdk 35)
├── supabase/                    # Infrastructure-as-code backend definition
│   ├── migrations/              # Strict PostgreSQL schemas, RLS policies & triggers
│   └── seed.sql                 # Baseline taxonomy & reference seeds
└── public/                      # Static assets, branding vectors & release artifacts
```

---

## 🚀 Core Capabilities

### 1. Adaptive Video Delivery & Playback
* **Entitlement & Session Isolation:** Video source URLs are resolved and signed dynamically via `/api/playback/session`, preventing direct link scraping, unauthorized hotlinking, and referer interception.
* **Universal HLS & MP4 Pipeline:** Zero-friction adaptive bitrate switching via `Hls.js` on modern desktop browsers, native AVPlayer on Safari/iOS, and `Media3 ExoPlayer` on Android.
* **Precision AniSkip Integration:** Sub-second intro and outro skip indicators with non-intrusive jump controls, driven by the community AniSkip protocol.
* **Dynamic Audio & Subtitle Multiplexing:** Seamless runtime switching between original Japanese audio with localized subtitles and Latin American Spanish dubs without player rebuilds.

### 2. Realtime Synchronized Watch Parties
* **Sub-150ms Clock Drift Compensation:** Proprietary client-side drift reconciliation calculates rolling round-trip times (RTT) across participants, smoothly scaling playback rate ($0.95\times - 1.05\times$) for minor offsets ($< 300\text{ms}$) or forcing soft-seeks for divergent clients ($> 1000\text{ms}$).
* **Host-Authoritative State:** Host controls act as the single source of truth for play, pause, seek, and episode progression.
* **Ephemeral Presence:** Low-overhead live member tracking, typing indicators, and emoji reaction bursts over persistent WebSocket channels.

### 3. Native Android Client (Jetpack Compose)
* **True Native Performance:** 100% written in Kotlin using Jetpack Compose, Material 3, and Dagger Hilt dependency injection.
* **Hardware-Accelerated Playback:** AndroidX Media3 ExoPlayer with Picture-in-Picture (PiP) background playback, audio focus handling, and swipe gestures for screen brightness and volume.
* **Offline-Ready Cache:** High-efficiency Room Database with KSP persistence and Coil 3 image disk/memory caching.

### 4. Offline-First Library & Cloud Synchronization
* **Two-Tier Storage:** Changes persist immediately to local indexed stores (IndexedDB/LocalStorage on web, Room on Android) for instant UI response without network latency.
* **Deterministic Conflict Resolution:** Last-Write-Wins (LWW) conflict strategy with transactional batch synchronizations to Supabase when re-establishing connectivity.

---

## 🛠 Tech Stack & Engineering Foundations

| Domain | Technology | Purpose |
| :--- | :--- | :--- |
| **Web Runtime** | Next.js 16.4 (App Router) | Server-Side Rendering, Partial Prerendering & Edge Route Handlers |
| **Frontend Framework** | React 19.3 | Concurrent rendering, Server Actions & optimized hooks |
| **Type Safety** | TypeScript 5.x (Strict) | Compile-time validation across models, APIs, and state stores |
| **Styling & Motion** | Tailwind CSS v4 + Motion | Modern utility tokens, CSS-first compilation, smooth springs |
| **State Layer** | Zustand 5.x + TanStack Query 5.x | High-throughput global UI state and deduplicated server-cache |
| **Mobile Language** | Kotlin 2.0+ | Modern expressive native Android development |
| **Mobile UI** | Jetpack Compose (Material 3) | Declarative reactive UI toolkit |
| **Mobile Media** | AndroidX Media3 (ExoPlayer 1.5+) | Robust media decoding, buffering, and PiP lifecycle management |
| **Database & Auth** | Supabase (PostgreSQL 16) | Enterprise relational storage, GoTrue authentication, and RLS |
| **Realtime Channel** | Supabase Realtime (WebSockets) | Low-latency state synchronization across distributed clients |

---

## 🔒 Security & Hardening

1. **Row Level Security (RLS):** 100% of tables in PostgreSQL enforce granular RLS policies. Client anon keys cannot inspect or mutate records outside the authenticated user's scope (`auth.uid() = user_id`).
2. **Encrypted Token Vault:** Third-party OAuth tokens (such as AniList user sessions) are symmetrically encrypted at rest using **AES-256-GCM** before database ingestion. Master keys never leak to frontend bundles.
3. **Strict Content Security Policy (CSP):** HTTP response headers strictly restrict executable script sources, disallow unauthorized iframing (`X-Frame-Options: SAMEORIGIN`), and restrict network fetches to verified domains.
4. **Zero-Trust Playback Grants:** Media URLs expire and are validated against timestamped origin headers to prevent replay attacks and scraping bots.

---

## 💻 Getting Started

### Prerequisites
* **Node.js:** `v20.10.0` or higher (LTS recommended)
* **Package Manager:** `npm` 10+ or `pnpm` 9+
* **JDK:** Version 17+ (required for Android compilation)
* **Android SDK:** API Level 35 (`compileSdk 35`, `minSdk 26`)

---

### Web Client (Next.js 16)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/AndrehhX/Kaze.git
   cd Kaze
   ```

2. **Install production dependencies:**
   ```bash
   npm install
   ```

3. **Provision local environment file:**
   ```bash
   cp .env.example .env.local
   ```

4. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Navigate to [http://localhost:3000](http://localhost:3000) to inspect the catalog.

5. **Build for production:**
   ```bash
   npm run build
   npm run start
   ```

---

### Android Client (Jetpack Compose)

1. **Navigate to the mobile module:**
   ```bash
   cd mobile
   ```

2. **Configure `local.properties`:**
   ```properties
   sdk.dir=C:\\Users\\<USER>\\AppData\\Local\\Android\\Sdk
   SUPABASE_URL=https://<your-project>.supabase.co
   SUPABASE_ANON_KEY=<your-supabase-anon-key>
   ```

3. **Assemble release / debug binary:**
   ```bash
   # Assemble Debug APK
   ./gradlew assembleDebug

   # Output location:
   # mobile/app/build/outputs/apk/debug/app-debug.apk
   ```

---

### Environment Variables Reference

| Variable | Scope | Required | Description |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SITE_URL` | Client & Server | Yes | Base public domain URL (e.g. `https://www.orunei.sbs`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Client & Server | Optional* | Supabase API endpoint for cloud authentication & sync |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client & Server | Optional* | Public anonymous Supabase key for RLS queries |
| `NEXT_PUBLIC_ANILIST_CLIENT_ID` | Client | Optional | OAuth Client ID for AniList account synchronization |
| `SUPABASE_SERVICE_ROLE_KEY` | Server Only | No (Private) | Administrative backend key for cron jobs & maintenance |
| `ANILIST_CLIENT_SECRET` | Server Only | Optional | Secret key used for server-side OAuth exchange |
| `TOKEN_ENCRYPTION_KEY` | Server Only | Optional | 32-byte Base64 key for AES-256-GCM token encryption |

*\* Note: The public catalog and discovery features function in standalone mode without Supabase. Authentication and watch parties require Supabase credentials.*

---

## 🧪 Quality Assurance & Automated Verification

The repository enforces strict continuous integration standards:

```bash
# Execute unit and component suites (Vitest)
npm run test

# Perform strict typecheck across TypeScript sources
npm run typecheck

# Validate code styling and rule conformance (ESLint 9)
npm run lint

# Run end-to-end browser workflows (Playwright)
npm run test:e2e
```

---

## ⚖️ Legal & Compliance Disclaimer

1. **Catalog Metadata:** KAZE indexes publicly available metadata, cover imagery, and release schedules through the official AniList GraphQL API under fair use guidelines.
2. **Zero Media Hosting:** **KAZE does not host, upload, maintain, or store copyrighted video streams on any of its physical or cloud servers.** All video content is indexed from third-party decentralized providers. KAZE operates strictly as a technological client and user interface orchestrator.
3. **DMCA & Copyright Compliance:** If you are a copyright owner or an agent thereof and believe that any content indexed on this platform infringes upon your copyright, please submit an official DMCA notification to:
   * **Designated Agent:** Andrés (`thealex230820@gmail.com`)
   * Actionable notices are reviewed and processed within 24 to 48 business hours.

---

## 📄 Intellectual Property & Licensing

**Copyright © 2026 Andrés ([@AndrehhX](https://github.com/AndrehhX)). All rights reserved.**

### Proprietary & Anti-Plagiarism Notice

This project, including its custom source code, brand assets, system architecture, database design, mobile application source code, and visual user interface, represents original proprietary intellectual property.

* **Strictly Prohibited:**
  * ❌ You **MAY NOT** clone, download, or re-host this repository to redistribute it under another name or claim it as your own creation ("rebranding" or plagiarism).
  * ❌ You **MAY NOT** sell, sub-license, commercialize, or integrate this codebase into commercial SaaS solutions without explicit written authorization from the author.
  * ❌ You **MAY NOT** remove, obscure, or alter any copyright notices, watermarks, or author attribution metadata present in this repository.

* **Permitted Use:**
  * ✅ Educational study, peer code review, architecture analysis, and local testing.
  * ✅ Legitimate forks intended solely to submit pull requests or improvements back to the upstream official repository with full attribution.

Any unauthorized commercial exploitation or false attribution will be met with immediate **DMCA Takedown Notices** on GitHub, app distribution platforms, and hosting providers, alongside applicable legal remedies.

For partnership or licensing inquiries, contact: **thealex230820@gmail.com**.

---

<div align="center">
  <sub>Crafted with engineering rigor and passion for modern digital media experiences.</sub>
</div>
