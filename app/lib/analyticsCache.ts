// ==================================================================
// CALEA: app/lib/analyticsCache.ts
// DATA: 02.10.2025 23:00 (ora României)
// DESCRIERE: Cache manager pentru analytics stats - reducere API calls
// FUNCȚIONALITATE: TTL 5 minute pentru overview, daily, team, project stats
// ==================================================================

'use client';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface CacheStore {
  [key: string]: CacheEntry<any>;
}

class AnalyticsCacheManager {
  private static instance: AnalyticsCacheManager | null = null;
  private cache: CacheStore = {};
  private readonly TTL = 5 * 60 * 1000; // 5 minute

  static getInstance(): AnalyticsCacheManager {
    if (!AnalyticsCacheManager.instance) {
      AnalyticsCacheManager.instance = new AnalyticsCacheManager();
    }
    return AnalyticsCacheManager.instance;
  }

  private constructor() {}

  // Generează cache key din parametri
  private generateKey(type: string, period: string, userId?: string): string {
    return `analytics_${type}_${period}_${userId || 'global'}`;
  }

  // Verifică dacă cache-ul e valid (nu a expirat)
  private isValid(entry: CacheEntry<any>): boolean {
    const now = Date.now();
    return (now - entry.timestamp) < this.TTL;
  }

  // Get data din cache (sau null dacă nu există/expirat)
  get<T>(type: string, period: string, userId?: string): T | null {
    const key = this.generateKey(type, period, userId);
    const entry = this.cache[key];

    if (!entry) {
      console.log(`📦 Cache MISS: ${key}`);
      return null;
    }

    if (!this.isValid(entry)) {
      console.log(`⏰ Cache EXPIRED: ${key}`);
      delete this.cache[key];
      return null;
    }

    console.log(`✅ Cache HIT: ${key} (age: ${Math.floor((Date.now() - entry.timestamp) / 1000)}s)`);
    return entry.data as T;
  }

  // Set data în cache
  set<T>(type: string, period: string, data: T, userId?: string): void {
    const key = this.generateKey(type, period, userId);
    this.cache[key] = {
      data,
      timestamp: Date.now()
    };
    console.log(`💾 Cache SET: ${key}`);
  }

  // Invalidează cache pentru un tip specific
  invalidate(type: string, period?: string, userId?: string): void {
    if (period && userId !== undefined) {
      const key = this.generateKey(type, period, userId);
      delete this.cache[key];
      console.log(`🗑️ Cache INVALIDATED: ${key}`);
    } else {
      // Invalidează toate cache-urile pentru tipul specificat
      const prefix = `analytics_${type}_`;
      Object.keys(this.cache).forEach(key => {
        if (key.startsWith(prefix)) {
          delete this.cache[key];
          console.log(`🗑️ Cache INVALIDATED: ${key}`);
        }
      });
    }
  }

  // Invalidează tot cache-ul
  clear(): void {
    this.cache = {};
    console.log('🗑️ Cache CLEARED: All entries');
  }

  // Debug: Afișează starea cache-ului
  getStatus(): { key: string; age: number; size: number }[] {
    const now = Date.now();
    return Object.entries(this.cache).map(([key, entry]) => ({
      key,
      age: Math.floor((now - entry.timestamp) / 1000),
      size: JSON.stringify(entry.data).length
    }));
  }
}

export const analyticsCache = AnalyticsCacheManager.getInstance();
