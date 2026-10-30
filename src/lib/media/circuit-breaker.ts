/**
 * Circuit Breaker y Monitor de Salud de Proveedores de Transmisión
 * Previene timeouts prolongados cuando un proveedor experimenta caídas.
 */

const FAIL_THRESHOLD = 3;
const COOLDOWN_MS = 5 * 60 * 1000;

export type ProviderOutcome = 'found' | 'empty' | 'failed';

interface ProviderStat {
  successCount: number;
  failureCount: number;
  emptyCount: number;
  consecutiveFailures: number;
  circuitOpenUntil: number;
  lastOutcome: ProviderOutcome | null;
  lastAt: number;
}

const stats = new Map<string, ProviderStat>();

function blankStat(): ProviderStat {
  return {
    successCount: 0,
    failureCount: 0,
    emptyCount: 0,
    consecutiveFailures: 0,
    circuitOpenUntil: 0,
    lastOutcome: null,
    lastAt: 0,
  };
}

function getStat(providerId: string): ProviderStat {
  let s = stats.get(providerId);
  if (!s) {
    s = blankStat();
    stats.set(providerId, s);
  }
  return s;
}

export function recordProviderOutcome(providerId: string, outcome: ProviderOutcome): void {
  if (!providerId) return;
  const s = getStat(providerId);
  s.lastOutcome = outcome;
  s.lastAt = Date.now();

  if (outcome === 'found') {
    s.successCount++;
    s.consecutiveFailures = 0;
    s.circuitOpenUntil = 0;
  } else if (outcome === 'failed') {
    s.failureCount++;
    s.consecutiveFailures++;
    if (s.consecutiveFailures >= FAIL_THRESHOLD) {
      s.circuitOpenUntil = Date.now() + COOLDOWN_MS;
      console.warn(`[providerCircuitBreaker] Disyuntor activado para "${providerId}" por ${COOLDOWN_MS / 1000}s`);
    }
  } else {
    s.emptyCount++;
    s.consecutiveFailures = 0;
  }
}

export function isProviderAvailable(providerId: string): boolean {
  if (!providerId) return true;
  const s = stats.get(providerId);
  if (!s || !s.circuitOpenUntil) return true;

  if (Date.now() < s.circuitOpenUntil) {
    return false;
  }

  s.circuitOpenUntil = Date.now() + COOLDOWN_MS;
  return true;
}

export function resetProviderStats(providerId?: string): void {
  if (providerId) {
    stats.delete(providerId);
  } else {
    stats.clear();
  }
}
