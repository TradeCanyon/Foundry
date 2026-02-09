/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * GracefulDegradation — Framework for resilient service operation.
 *
 * Provides:
 * - `tryWithFallback()` — execute primary, fall back on failure
 * - `serviceHealth` — registry of service health status
 * - `reportDegraded()` — log degradation + surface to UI
 */

export type ServiceStatus = 'healthy' | 'degraded' | 'down';

export interface DegradedService {
  service: string;
  reason: string;
  timestamp: number;
  status: ServiceStatus;
}

// In-memory service health registry
const serviceRegistry = new Map<string, DegradedService>();
const listeners = new Set<(services: DegradedService[]) => void>();

/**
 * Execute primary function with fallback on failure.
 */
export function tryWithFallback<T>(primary: () => T, fallback: () => T, errorLabel: string): T {
  try {
    return primary();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    reportDegraded(errorLabel, reason, 'degraded');
    return fallback();
  }
}

/**
 * Async version of tryWithFallback.
 */
export async function tryWithFallbackAsync<T>(primary: () => Promise<T>, fallback: () => Promise<T>, errorLabel: string): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    reportDegraded(errorLabel, reason, 'degraded');
    return fallback();
  }
}

/**
 * Report a service as degraded. Logged + surfaces to UI via listeners.
 */
export function reportDegraded(service: string, reason: string, status: ServiceStatus = 'degraded'): void {
  const entry: DegradedService = { service, reason, timestamp: Date.now(), status };
  serviceRegistry.set(service, entry);
  console.warn(`[Degradation] ${service}: ${reason} (${status})`);
  notifyListeners();
}

/**
 * Report a service as recovered (healthy).
 */
export function reportHealthy(service: string): void {
  if (serviceRegistry.has(service)) {
    serviceRegistry.delete(service);
    notifyListeners();
  }
}

/**
 * Get all currently degraded services.
 */
export function getDegradedServices(): DegradedService[] {
  return Array.from(serviceRegistry.values()).filter((s) => s.status !== 'healthy');
}

/**
 * Check if a specific service is healthy.
 */
export function isServiceHealthy(service: string): boolean {
  return !serviceRegistry.has(service) || serviceRegistry.get(service)!.status === 'healthy';
}

/**
 * Subscribe to degradation changes.
 * Returns an unsubscribe function.
 */
export function onDegradationChange(callback: (services: DegradedService[]) => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyListeners(): void {
  const services = getDegradedServices();
  for (const listener of listeners) {
    try {
      listener(services);
    } catch {
      // Listener errors shouldn't break the notification chain
    }
  }
}
