/**
 * Account Lockout
 * Tracks consecutive failed login attempts and locks accounts.
 * 5 failures → 15-minute lock, escalating to 1-hour after repeat offenses.
 *
 * All state is stored in the account_lockouts table so it persists across restarts
 * and works correctly when multiple backend instances are running.
 */

const MAX_ATTEMPTS    = 5;
const LOCK_MINUTES_1  = 15;   // first lockout
const LOCK_MINUTES_2  = 60;   // subsequent lockouts

/**
 * Record a failed login attempt.
 * Returns { locked, lockUntil, attemptsRemaining } after recording.
 * @param {object} db    - mysql2 pool
 * @param {string} email
 * @param {string} portal - 'student'|'admin'|'supervisor'|'center'
 */
async function recordFailure(db, email, portal) {
    const now = new Date();

    // Upsert attempt record
    await db.query(
        `INSERT INTO account_lockouts (email, portal, failed_attempts, last_attempt_at)
         VALUES (?, ?, 1, ?)
         ON DUPLICATE KEY UPDATE
           failed_attempts  = failed_attempts + 1,
           last_attempt_at  = VALUES(last_attempt_at)`,
        [email, portal, now]
    );

    const [[row]] = await db.query(
        `SELECT failed_attempts, locked_until, lockout_count FROM account_lockouts
          WHERE email = ? AND portal = ?`,
        [email, portal]
    );

    const attempts = row?.failed_attempts || 1;

    if (attempts >= MAX_ATTEMPTS) {
        const lockCount   = (row?.lockout_count || 0) + 1;
        const lockMinutes = lockCount >= 2 ? LOCK_MINUTES_2 : LOCK_MINUTES_1;
        const lockUntil   = new Date(now.getTime() + lockMinutes * 60 * 1000);

        await db.query(
            `UPDATE account_lockouts
                SET locked_until    = ?,
                    lockout_count   = ?,
                    failed_attempts = 0
              WHERE email = ? AND portal = ?`,
            [lockUntil, lockCount, email, portal]
        );

        return { locked: true, lockUntil, lockMinutes, attemptsRemaining: 0 };
    }

    return {
        locked:            false,
        lockUntil:         null,
        attemptsRemaining: MAX_ATTEMPTS - attempts,
    };
}

/**
 * Check whether an account is currently locked.
 * @returns {{ locked: boolean, lockUntil: Date|null, secondsRemaining: number }}
 */
async function checkLock(db, email, portal) {
    const [[row]] = await db.query(
        `SELECT locked_until FROM account_lockouts WHERE email = ? AND portal = ?`,
        [email, portal]
    );

    if (!row?.locked_until) return { locked: false, lockUntil: null, secondsRemaining: 0 };

    const lockUntil = new Date(row.locked_until);
    const now       = new Date();

    if (now >= lockUntil) {
        // Lock has expired — clear it
        await db.query(
            `UPDATE account_lockouts SET locked_until = NULL WHERE email = ? AND portal = ?`,
            [email, portal]
        );
        return { locked: false, lockUntil: null, secondsRemaining: 0 };
    }

    const secondsRemaining = Math.ceil((lockUntil - now) / 1000);
    return { locked: true, lockUntil, secondsRemaining };
}

/**
 * Clear failed attempts on successful login.
 */
async function clearFailures(db, email, portal) {
    await db.query(
        `UPDATE account_lockouts SET failed_attempts = 0, locked_until = NULL
          WHERE email = ? AND portal = ?`,
        [email, portal]
    );
}

module.exports = { recordFailure, checkLock, clearFailures, MAX_ATTEMPTS };
