import { describe, expect, it } from 'vitest';
import { isAuthorizedCdnUrl, rewriteM3U8, normalizeSubtitleToVtt } from '@/lib/media/stream-policy';
import { isMalIdDubbedInSpanish, resolveMalId, isEpisodeInDubRange } from '@/lib/media/dub-catalog';
import { buildGenreProfile } from '@/lib/recommend';
import type { LibraryEntry } from '@/lib/library/types';

describe('Stream Security Policy & SSRF Protection', () => {
  it('permite dominios CDN autorizados', () => {
    expect(isAuthorizedCdnUrl('https://megavid.buzz/hls/master.m3u8')).toBe(true);
    expect(isAuthorizedCdnUrl('https://cdn.megavid.buzz/ep1.ts')).toBe(true);
    expect(isAuthorizedCdnUrl('https://anixo.buzz/stream.m3u8')).toBe(true);
    expect(isAuthorizedCdnUrl('https://www3.animeflv.net/video.mp4')).toBe(true);
    expect(isAuthorizedCdnUrl('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8')).toBe(true);
  });

  it('rechaza tajantemente URLs locales y privadas (prevención SSRF)', () => {
    expect(isAuthorizedCdnUrl('http://localhost:3000/api')).toBe(false);
    expect(isAuthorizedCdnUrl('http://127.0.0.1:8080/secret')).toBe(false);
    expect(isAuthorizedCdnUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isAuthorizedCdnUrl('http://192.168.1.1/admin')).toBe(false);
    expect(isAuthorizedCdnUrl('http://10.0.0.1/internal')).toBe(false);
    expect(isAuthorizedCdnUrl('ftp://example.com/file')).toBe(false);
    expect(isAuthorizedCdnUrl('not-a-url')).toBe(false);
  });

  it('rewriteM3U8 reescribe rutas relativas y llaves cifradas a través del proxy', () => {
    const sampleM3U8 = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-KEY:METHOD=AES-128,URI="key.php"
#EXTINF:10.0,
segment1.ts
https://bunnycdn.com/segment2.ts`;

    const rewritten = rewriteM3U8(sampleM3U8, 'https://bunnycdn.com/hls/playlist.m3u8', '', '', '/api/stream/proxy');
    expect(rewritten).toContain('URI="/api/stream/proxy?url=https%3A%2F%2Fbunnycdn.com%2Fhls%2Fkey.php');
    expect(rewritten).toContain('/api/stream/proxy?url=https%3A%2F%2Fbunnycdn.com%2Fhls%2Fsegment1.ts');
    expect(rewritten).toContain('/api/stream/proxy?url=https%3A%2F%2Fbunnycdn.com%2Fsegment2.ts');
  });

  it('normalizeSubtitleToVtt convierte formato SRT a WebVTT', () => {
    const srt = `1\n00:01:20,500 --> 00:01:23,800\nHola mundo`;
    const vtt = normalizeSubtitleToVtt(srt);
    expect(vtt).toContain('WEBVTT');
    expect(vtt).toContain('00:01:20.500 --> 00:01:23.800');
    expect(vtt).toContain('Hola mundo');
  });
});

describe('Spanish Dub Catalog', () => {
  it('identifica animes con doblaje oficial en español', () => {
    expect(isMalIdDubbedInSpanish('44511')).toBe(true); // Chainsaw Man
    expect(isMalIdDubbedInSpanish('52991')).toBe(true); // Frieren
    expect(isMalIdDubbedInSpanish('40748')).toBe(true); // Jujutsu Kaisen
  });

  it('resuelve correctamente IDs de AniList a MyAnimeList', () => {
    expect(resolveMalId('127230')).toBe('44511'); // Chainsaw Man AniList -> MAL
    expect(resolveMalId('154587')).toBe('52991'); // Frieren AniList -> MAL
  });

  it('valida límites de lotes en animes con doblaje parcial', () => {
    expect(isEpisodeInDubRange('21', 100)).toBe(true); // One Piece ep 100 sí doblado
    expect(isEpisodeInDubRange('21', 999)).toBe(false); // One Piece ep 999 no doblado aún
  });
});

describe('Algorithm with Time Decay', () => {
  it('pondera con más fuerza los títulos recientes frente a títulos de hace más de 90 días', () => {
    const now = Date.now();
    const snap = (genres: string[]): LibraryEntry['media'] => ({
      title: 'T',
      titleNative: null,
      cover: null,
      banner: null,
      color: null,
      episodes: 12,
      format: 'TV',
      year: 2024,
      genres,
      averageScore: 85,
      studio: 'Studio',
      duration: 24,
    });

    const recentEntry: LibraryEntry = {
      mediaId: 1,
      status: 'COMPLETED',
      progress: 12,
      score: 90,
      notes: '',
      favorite: false,
      startedAt: null,
      completedAt: null,
      repeat: 0,
      createdAt: now - 864e5,
      updatedAt: now - 864e5, // Visto ayer
      media: snap(['Cyberpunk']),
    };

    const oldEntry: LibraryEntry = {
      mediaId: 2,
      status: 'COMPLETED',
      progress: 12,
      score: 90,
      notes: '',
      favorite: false,
      startedAt: null,
      completedAt: null,
      repeat: 0,
      createdAt: now - 180 * 864e5,
      updatedAt: now - 180 * 864e5, // Visto hace 6 meses
      media: snap(['Mecha']),
    };

    const profile = buildGenreProfile([recentEntry, oldEntry]);
    expect(profile.weights['Cyberpunk']).toBeGreaterThan(profile.weights['Mecha']);
  });
});
