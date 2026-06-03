/**
 * Password Hashing — Argon2id with bcrypt fallback migration
 *
 * Migration strategy (zero-downtime):
 *   1. New passwords → hashed with Argon2id
 *   2. On login, detect hash type:
 *      - Argon2id prefix "$argon2id$" → verify with argon2
 *      - bcrypt prefix "$2a$" / "$2b$" → verify with bcrypt,
 *        then transparently re-hash with Argon2id and save
 *   3. Over time all active users are silently migrated
 *
 * Argon2id parameters (OWASP recommended):
 *   - memoryCost: 65536 KB (64 MB)
 *   - timeCost:   3 iterations
 *   - parallelism: 4
 */

let argon2;
try {
    argon2 = require('argon2');
} catch (_) {
    argon2 = null;
}

const bcrypt = require('bcryptjs');

const ARGON2_OPTIONS = {
    type:         argon2?.argon2id,
    memoryCost:   65536,   // 64 MB
    timeCost:     3,
    parallelism:  4,
};

function isArgon2Hash(hash) {
    return typeof hash === 'string' && hash.startsWith('$argon2');
}

function isBcryptHash(hash) {
    return typeof hash === 'string' && (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$'));
}

/**
 * Hash a new password with Argon2id.
 * Falls back to bcrypt (cost 12) if argon2 package is not installed.
 */
async function hashPassword(plaintext) {
    if (argon2) {
        return argon2.hash(plaintext, ARGON2_OPTIONS);
    }
    // Fallback: bcrypt with higher cost factor
    return bcrypt.hash(plaintext, 12);
}

/**
 * Verify a password and detect which algorithm was used.
 * @returns {{ valid: boolean, needsRehash: boolean }}
 *   needsRehash=true means the caller should re-hash the plaintext and update the stored hash.
 */
async function verifyPassword(plaintext, storedHash) {
    if (!plaintext || !storedHash) return { valid: false, needsRehash: false };

    if (isArgon2Hash(storedHash)) {
        if (!argon2) {
            // Can't verify argon2 hash without the package
            console.error('[PasswordHash] argon2 package required to verify argon2id hashes');
            return { valid: false, needsRehash: false };
        }
        const valid = await argon2.verify(storedHash, plaintext);
        return { valid, needsRehash: false };
    }

    if (isBcryptHash(storedHash)) {
        const valid = await bcrypt.compare(plaintext, storedHash);
        // If valid and argon2 is available, signal caller to upgrade the hash
        return { valid, needsRehash: valid && argon2 !== null };
    }

    // Unknown hash format
    return { valid: false, needsRehash: false };
}

/**
 * Convenience: verify + transparently re-hash if needed.
 * @param {object} db           - mysql2 pool
 * @param {string} plaintext    - submitted password
 * @param {string} storedHash   - hash from DB
 * @param {number} userId       - row to update on re-hash
 * @param {string} tableName    - 'users' | 'supervisor_users' | 'center_users'
 * @returns {boolean} - true if password is valid
 */
async function verifyAndMigrate(db, plaintext, storedHash, userId, tableName = 'users') {
    const { valid, needsRehash } = await verifyPassword(plaintext, storedHash);

    if (valid && needsRehash) {
        // Silently upgrade bcrypt → argon2id in background
        hashPassword(plaintext)
            .then(newHash =>
                db.query(`UPDATE ${tableName} SET password = ? WHERE id = ?`, [newHash, userId])
            )
            .catch(err => console.error('[PasswordHash] rehash failed:', err.message));
    }

    return valid;
}

module.exports = { hashPassword, verifyPassword, verifyAndMigrate, isArgon2Hash, isBcryptHash };
