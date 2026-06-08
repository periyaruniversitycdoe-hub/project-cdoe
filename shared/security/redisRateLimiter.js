'use strict';

/**
 * Redis-backed rate limiter factory with automatic memory-store fallback.
 * All requires are lazy so this shared module works from any backend without
 * needing its own node_modules — it resolves packages from the caller's tree.
 *
 * Usage:
 *   const { makeAuthLimiter, makeApiLimiter } = require('../../shared/security/redisRateLimiter');
 *   app.use('/api/auth', makeAuthLimiter());
 *   app.use('/api',      makeApiLimiter());
 */

let redisClient = null;
let RedisStore   = null;

function tryInitRedis() {
    if (redisClient) return;
    try {
        const Redis    = require('ioredis');
        const RLS      = require('rate-limit-redis');
        RedisStore     = RLS.default || RLS;

        const host = process.env.REDIS_HOST || '127.0.0.1';
        const port = parseInt(process.env.REDIS_PORT || '6379', 10);

        redisClient = new Redis({ host, port, lazyConnect: true, enableOfflineQueue: false });

        redisClient.on('error', () => {
            redisClient = null; // drop client on error so next request retries
        });
    } catch (_) {
        // packages not installed or Redis unavailable — use memory store
    }
}

function makeStore(keyPrefix) {
    if (process.env.NODE_ENV !== 'production') return undefined;
    tryInitRedis();
    if (!redisClient || !RedisStore) return undefined; // express-rate-limit default: memory

    return new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        prefix: `rl:${keyPrefix}:`,
    });
}

const isProd = () => process.env.NODE_ENV === 'production';

/** Auth endpoints — strict: 20 req / 15 min per IP */
function makeAuthLimiter(overrides = {}) {
    const { rateLimit } = require('express-rate-limit');
    return rateLimit({
        windowMs: 15 * 60 * 1000,
        limit:    isProd() ? 20 : 1_000_000,
        standardHeaders: true,
        legacyHeaders:   false,
        store: makeStore('auth'),
        skip: (req) => {
            if (!isProd()) return true;
            const ip = req.ip || '';
            return ip.includes('127.0.0.1') || ip === '::1';
        },
        message: { success: false, message: 'Too many requests. Please try again later.' },
        ...overrides,
    });
}

/** General API — generous: 300 req / 15 min per IP */
function makeApiLimiter(overrides = {}) {
    const { rateLimit } = require('express-rate-limit');
    return rateLimit({
        windowMs: 15 * 60 * 1000,
        limit:    isProd() ? 300 : 1_000_000,
        standardHeaders: true,
        legacyHeaders:   false,
        store: makeStore('api'),
        skip: (req) => {
            if (!isProd()) return true;
            const ip = req.ip || '';
            return ip.includes('127.0.0.1') || ip === '::1';
        },
        message: { success: false, message: 'Too many requests. Please try again later.' },
        ...overrides,
    });
}

module.exports = { makeAuthLimiter, makeApiLimiter };
