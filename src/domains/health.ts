import { DomainRegistry, domainRegistry } from './registry.js';

export interface HealthAttemptResult<T> {
  value: T;
  url: string;
  latencyMs: number;
}

export interface ProviderHealthOptions {
  now?: () => number;
  failureCooldownMs?: number;
}

/**
 * Provider-level execution policy over DomainRegistry.
 * It records latency/failures centrally and skips domains whose circuit is
 * cooling down. A domain is promoted only when the caller has independently
 * verified provider identity.
 */
export class ProviderHealthManager {
  private readonly now: () => number;
  private readonly failureCooldownMs: number;

  constructor(
    private readonly domains: DomainRegistry = domainRegistry,
    options: ProviderHealthOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.failureCooldownMs = Math.max(1_000, options.failureCooldownMs ?? 30_000);
  }

  availableUrls(providerId: string): string[] {
    const now = this.now();
    return this.domains.orderedUrls(providerId, now).filter((url) => {
      const observation = this.domains.observation(providerId, url);
      return !observation?.cooldownUntil || Date.parse(observation.cooldownUntil) <= now;
    });
  }

  async execute<T>(
    providerId: string,
    attempt: (url: string) => Promise<{ value: T; identityVerified: boolean }>,
  ): Promise<HealthAttemptResult<T>> {
    const urls = this.availableUrls(providerId);
    if (!urls.length) throw new Error(`No healthy domain available for provider ${providerId}`);

    const failures: string[] = [];
    for (const url of urls) {
      const startedAt = this.now();
      try {
        const result = await attempt(url);
        const latencyMs = Math.max(0, this.now() - startedAt);
        if (!result.identityVerified) {
          this.domains.mark(providerId, url, 'degraded', new Date(this.now()).toISOString(), {
            identityVerified: false,
            latencyMs,
            reason: 'provider identity verification failed',
            cooldownMs: this.failureCooldownMs,
          });
          failures.push(`${url}: identity verification failed`);
          continue;
        }
        this.domains.mark(providerId, url, 'healthy', new Date(this.now()).toISOString(), {
          identityVerified: true,
          latencyMs,
        });
        return { value: result.value, url, latencyMs };
      } catch (error) {
        const latencyMs = Math.max(0, this.now() - startedAt);
        const reason = error instanceof Error ? error.message : String(error);
        this.domains.mark(providerId, url, 'dead', new Date(this.now()).toISOString(), {
          identityVerified: false,
          latencyMs,
          reason,
          cooldownMs: this.failureCooldownMs,
        });
        failures.push(`${url}: ${reason}`);
      }
    }
    throw new Error(`All domains failed for provider ${providerId}: ${failures.join('; ')}`);
  }
}

export const providerHealthManager = new ProviderHealthManager();
