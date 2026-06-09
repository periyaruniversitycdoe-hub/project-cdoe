'use strict';

// Valid month names stored in the sessions table
const VALID_MONTHS = new Set([
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
]);

/**
 * ApplicationIdGenerationEngine
 *
 * Generates the official CETPHD Application ID ONLY after a student
 * submits their registration form. Never called at account-creation time.
 *
 * Format: CETPHD/{SESSION_CODE}/{SERIAL}
 *   SESSION_CODE = {MONTH_FIRST_LETTER}{YEAR_LAST_2_DIGITS}
 *     MONTH_FIRST_LETTER: First letter of the Admin-configured session month
 *       January   → J  |  February  → F  |  March     → M
 *       April     → A  |  May       → M  |  June      → J
 *       July      → J  |  August    → A  |  September → S
 *       October   → O  |  November  → N  |  December  → D
 *     YEAR: last 2 digits of the active session year
 *   SERIAL = 4-digit session-scoped running sequence (0001 → 9999)
 *            resets automatically when a new session is activated
 *
 * Examples:
 *   June 2026 session     → CETPHD/J26/0001, CETPHD/J26/0002 …
 *   July 2026 session     → CETPHD/J26/0001, CETPHD/J26/0002 …
 *   December 2026 session → CETPHD/D26/0001, CETPHD/D26/0002 …
 *   January 2027 session  → CETPHD/J27/0001, CETPHD/J27/0002 …
 *
 * Thread / concurrency safety:
 *   Uses SELECT … FOR UPDATE inside a transaction so concurrent
 *   simultaneous submissions cannot receive the same serial number.
 *
 * @param {import('mysql2/promise').Pool} db - mysql2 promise pool
 * @param {number} sessionId - active session id (from users.session_id)
 * @returns {Promise<string>} application ID, e.g. "CETPHD/J26/0001"
 */
async function generateCETPHDApplicationId(db, sessionId) {
    // ── 1. Resolve session details from Admin-configured active session ────────
    const [sessionRows] = await db.query(
        'SELECT year, month FROM sessions WHERE id = ? LIMIT 1',
        [sessionId]
    );
    if (!sessionRows.length) {
        throw new Error(`ApplicationIdEngine: session ${sessionId} not found`);
    }

    const { year, month } = sessionRows[0];

    // Derive month code: first letter of the Admin-configured session month name.
    // The month column stores full English month names (e.g. "June", "December").
    const monthTrimmed = String(month).trim();
    if (!VALID_MONTHS.has(monthTrimmed)) {
        throw new Error(
            `ApplicationIdEngine: invalid session month "${monthTrimmed}" for session ${sessionId}. ` +
            `Expected one of: ${[...VALID_MONTHS].join(', ')}`
        );
    }
    const monthCode   = monthTrimmed.charAt(0).toUpperCase(); // "June" → "J", "December" → "D"
    const yearCode    = String(year).slice(-2);               // "2026" → "26"
    const sessionCode = `${monthCode}${yearCode}`;            // "J26", "D26", "J27" …

    // ── 2. Atomic serial generation with row-level lock ───────────────────────
    const conn = await db.getConnection();
    try {
        // Pre-insert row if this is the first applicant for the session.
        // INSERT IGNORE is safe to run outside the transaction.
        await conn.execute(
            `INSERT IGNORE INTO application_id_serials (session_id, last_serial)
             VALUES (?, 0)`,
            [sessionId]
        );

        await conn.beginTransaction();

        // Lock the row exclusively so concurrent requests queue behind this one.
        const [[lockedRow]] = await conn.execute(
            'SELECT last_serial FROM application_id_serials WHERE session_id = ? FOR UPDATE',
            [sessionId]
        );

        const newSerial = lockedRow.last_serial + 1;

        if (newSerial > 9999) {
            await conn.rollback();
            throw new Error('ApplicationIdEngine: serial overflow — session has exceeded 9999 applicants');
        }

        await conn.execute(
            'UPDATE application_id_serials SET last_serial = ? WHERE session_id = ?',
            [newSerial, sessionId]
        );

        await conn.commit();

        // ── 3. Format and return ───────────────────────────────────────────────
        const serial = String(newSerial).padStart(4, '0'); // "0001" … "9999"
        return `CETPHD/${sessionCode}/${serial}`;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

module.exports = { generateCETPHDApplicationId };
