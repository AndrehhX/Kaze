# KAZE — Modern Anime Exploration & Streaming Ecosystem

[![Next.js](https://img.shields.io/badge/Next.js-16.4-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![Android](https://img.shields.io/badge/Android-Kotlin%20%7C%20Jetpack%20Compose-3ddc84?style=flat-square&logo=android)](https://developer.android.com/)
[![Media3](https://img.shields.io/badge/Media3-ExoPlayer-blue?style=flat-square)](https://developer.android.com/media/media3)
[![Supabase](https://img.shields.io/badge/Backend-Supabase%20%7C%20PostgreSQL-3ecf8e?style=flat-square&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)](LICENSE)

**KAZE** is an open-architecture, cross-platform anime media and discovery ecosystem. It features a modern, fluid web application powered by **Next.js 16** and **React 19**, paired with a native **Android client** built in **Kotlin** and **Jetpack Compose**. 

Designed for high performance, intuitive interaction, and robust synchronicity, KAZE unifies live catalog metadata, intelligent recommendation algorithms, adaptive video streaming with automated skip milestones, and real-time social watch parties.

---

## Architecture Overview

KAZE is structured as a unified monorepo accommodating both web and native mobile clients, backed by a unified Supabase and GraphQL infrastructure.

```
kaze/
├── src/                         # Next.js 16 Web Application
│   ├── app/                     # App Router pages, layouts, and API routes
│   │   ├── api/                 # Playback session grants, AniList proxy & OAuth
│   │   ├── anime/[id]/          # Detailed anime views & episode listings
│   │   └── watch/[id]/[ep]/     # Adaptive video player interface
│   ├── components/              # Reusable design system UI components
│   ├── lib/                     # Core business logic
│   │   ├── anilist/             # Typed GraphQL queries & deduplicating client
│   │   ├── media/               # Stream resolvers, server selection & AniSkip
│   │   ├── recommend.ts         # Explainable recommendation engine
│   │   └── watch-party/         # Drift-correcting synchronized playback
│   └── stores/                  # Zustand state stores (settings, local library)
├── mobile/                      # Native Android Client (Kotlin + Compose)
│   ├── app/src/main/java/com/kaze/mobile/
│   │   ├── core/                # Database (Room), network, design system tokens
│   │   ├── data/                # Repositories, AniList GraphQL, OruneiMediaProvider
│   │   ├── domain/              # Models, playback abstractions, sync planner
│   │   └── feature/             # Jetpack Compose screens (Home, Player, Library, Party)
│   └── build.gradle.kts         # Multi-module Gradle build setup (minSdk 26, targetSdk 35)
├── supabase/                    # Backend migrations & schema definition
│   ├── migrations/              # PostgreSQL tables, RLS policies, RPC procedures
│   └── seed.sql                 # Baseline taxonomy & reference data
└── public/                      # Static assets and icons
```

---

## Core Capabilities

### 1. High-Performance Adaptive Video Streaming
* **Unified Provider Engine:** Decouples catalog metadata from video delivery through an entitlement and session grant architecture (`/api/playback/session`).
* **Multi-Format Playback:** Supports adaptive **HLS (HTTP Live Streaming)** and direct MP4 playback across desktop, iOS/iPadOS Safari, and Android Media3/ExoPlayer.
* **AniSkip Milestone Integration:** Automatic intro and outro skip markers with smooth playhead seeking.
* **Dual Audio & Subtitle Multiplexing:** Flexible on-the-fly toggling between original audio, Spanish dubs, and multiple subtitle tracks.

### 2. Multi-Platform Design Systems
* **Web (Next.js & Tailwind CSS v4):** Motion-driven interfaces, gapless responsive bento grids, glassmorphism overlays, and 4 ambient themes (*Kaze*, *Midnight*, *Sakura*, *Cyberpunk*).
* **Android (Jetpack Compose & Media3):** Edge-to-edge layout, Picture-in-Picture (PiP) multitasking, volume/brightness swipe gestures, Coil 3 cached imagery, and system theme adaptation.

### 3. Server-Authoritative Watch Parties
* **Low-Latency Realtime Protocol:** Powered by Supabase Realtime WebSocket channels.
* **Clock Drift Correction:** Client-side RTT estimation keeps all members in lockstep, applying micro-rate adjustments ($>0.15\text{s}$) or seeking ($>1.0\text{s}$).
* **Synchronized Chat & Reactions:** Ephemeral participant state and emoji broadcasts.

### 4. Offline-First Library & Conflict-Free Sync
* **Local Persistence First:** Fast initial load via Room Database (Android) and LocalStorage (Web).
* **Deterministic Reconciliation:** Cloud synchronization handles multi-device conflicts gracefully, preserving user ratings and watch progress milestones.

---

## Technology Stack

### Web Client
* **Framework:** Next.js 16 (App Router, Server Actions, Partial Prerendering)
* **Library:** React 19
* **Language:** TypeScript 5.x (Strict Mode)
* **Styling:** Tailwind CSS v4 + Motion
* **State Management:** Zustand 5.x + TanStack Query 5.x
* **Media:** Hls.js + Web Audio API

### Android Client
* **Language:** Kotlin 2.0+
* **UI Toolkit:** Jetpack Compose (Material 3)
* **Architecture:** MVVM + Clean Architecture
* **Dependency Injection:** Dagger Hilt
* **Local Database:** Room Database with KSP
* **Playback:** AndroidX Media3 (ExoPlayer 1.5+)
* **Image Pipeline:** Coil 3 (Memory & Disk Cache)

### Backend & Data Layer
* **Database:** PostgreSQL (via Supabase) with Row Level Security (RLS)
* **Authentication:** GoTrue (Email + PKCE OAuth)
* **Realtime Engine:** Supabase Realtime (WebSockets)
* **External APIs:** AniList GraphQL API

---

## Getting Started

### Prerequisites
* **Node.js:** `v20.0.0` or higher
* **Package Manager:** `npm` or `pnpm`
* **JDK:** Version 17+ (for building the Android client)
* **Android SDK:** API 26+ (`compileSdk 35`)

---

### Running the Web Platform

1. **Clone the repository:**
   ```bash
   git clone https://github.com/AndrehhX/Kaze.git
   cd Kaze
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   *(Optional for guest browsing; fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for accounts and cloud sync).*

4. **Launch development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Build for production:**
   ```bash
   npm run build
   npm run start
   ```

---

### Building the Android Client

1. **Navigate to the mobile directory:**
   ```bash
   cd mobile
   ```

2. **Configure local backend properties:**
   Create a `local.properties` file in `mobile/`:
   ```properties
   sdk.dir=/path/to/your/android/sdk
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

3. **Assemble Debug APK:**
   ```bash
   ./gradlew assembleDebug
   ```
   The compiled APK will be output to `mobile/app/build/outputs/apk/debug/app-debug.apk`.

---

## Quality & Testing

The project maintains high engineering standards through automated tests:

```bash
# Run unit & component tests
npm run test

# Run type check
npm run typecheck

# Run linter
npm run lint

# Run end-to-end tests (Playwright)
npm run test:e2e
```

---

## Security & Compliance

* All user-generated content, library updates, and profile settings are protected via **PostgreSQL Row Level Security (RLS)** policies; client keys can never bypass row-level permissions.
* Third-party access tokens (AniList OAuth) are encrypted at rest using AES-256-GCM and never exposed to the client bundle.
* Video playback is secured by short-lived session grants generated via server-side verification.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

Developed with passion for high-craft digital experiences.
