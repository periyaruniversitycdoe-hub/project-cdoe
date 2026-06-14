/**
 * In-memory active-session cache.
 *
 * Every admin API request that needs to know which session is currently active
 * previously issued a standalone "SELECT … WHERE is_active = 1" query each time.
 * This module replaces that pattern with a single shared result that is
 * re-fetched at most once per TTL window (10 s), dramatically reducing DB load
 * under burst traffic (many tabs, frequent refreshes, concurrent requests).
 *
 * Call invalidate() immediately after any operation that changes is_active so
 * the very next request always sees the freshest value.
 */

const pool = require('../config/db');

const TTL_MS = 10_000; // 10-second cache window

let _session   = null;   // cached row (or null)
let _fetchedAt = 0;      // epoch-ms of last successful fetch

/**
 * Returns the currently active session row from cache, refreshing when stale.
 * Returns null when no session is active.
 */
async function getActiveSession() {
    const now = Date.now();
    if (_session !== null && now - _fetchedAt < TTL_MS) {
        return _session;
    }
    const [[row]] = await pool.execute(
        `SELECT id, year, month, is_active,
                registration_open, application_open, entrance_result_published AS result_published
         FROM sessions WHERE is_active = 1 LIMIT 1`
    );
    _session   = row || null;
    _fetchedAt = now;
    return _session;
}

/**
 * Returns only the active session id (convenience wrapper, same cache).
 * Returns null when no session is active.
 */
async function getActiveSessionId() {
    const s = await getActiveSession();
    return s ? s.id : null;
}

/**
 * Force-expire the cache. Call this after any operation that flips is_active
 * (session create, activate, update) so the next request re-queries the DB.
 */
function invalidate() {
    _session   = null;
    _fetchedAt = 0;
}

module.exports = { getActiveSession, getActiveSessionId, invalidate };
