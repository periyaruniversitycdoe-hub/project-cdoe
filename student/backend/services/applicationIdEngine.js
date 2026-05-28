'use strict';

/**
 * ApplicationIdGenerationEngine
 *
 * Generates the official CETPHD Application ID ONLY after a student
 * submits their registration form. Never called at account-creation time.
 *
 * Format: CETPHD/{SESSION_CODE}/{SERIAL}
 *   SESSION_CODE = {MONTH_CODE}{YEAR_LAST_2_DIGITS}
 *     MONTH_CODE:  J  → July session
 *                  D  → December session
 *     YEAR (last 2 digits of the active session year)
 *   SERIAL = 4-digit session-scoped running sequence (0001 → 9999)
 *
 * Examples:
 *   July 2026 session     → CETPHD/J26/0001, CETPHD/J26/0002 …
 *   December 2026 session → CETPHD/D26/0001, CETPHD/D26/0002 …
 *
 * Thread / concurrency safety:
 *   Uses SELECT … FOR UPDATE inside a transaction so concurrent
 *   simultaneous submissions cannot receive the same serial number.
 *
 * @param {import('mysql2/promise').Pool} db - mysql2 promise pool
 * @param {number} sessionId - active session id
 * @returns {Promise<string>} application ID, e.g. "CETPHD/J26/0001"
 */
async function generateCETPHDApplicationId(db, sessionId) {
    // ── 1. Resolve session details ────────────────────────────────────────────
    const [sessionRows] = await db.query(
        'SELECT year, month FROM sessions WHERE id = ? LIMIT 1',
        [sessionId]
    );
    if (!sessionRows.length) {
        throw new Error(`ApplicationIdEngine: session ${sessionId} not found`);
    }

    const { year, month } = sessionRows[0];

    // Determine month code: J = July, D = December
    const monthLower = String(month).toLowerCase().trim();
    const monthCode = monthLower.startsWith('jul') ? 'J' : 'D';
    const yearCode  = String(year).slice(-2);              // e.g. "2026" → "26"
    const sessionCode = `${monthCode}${yearCode}`;          // e.g. "J26"

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
