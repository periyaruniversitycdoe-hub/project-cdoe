-- ═══════════════════════════════════════════════════════════════════════════
-- Minimal-Privilege MySQL User for Production
-- Run this ONCE as root/admin before deploying to production.
-- Then set DB_USER=rsm_app and DB_PASSWORD=<generated> in your .env
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Create the application user (localhost only — never allow remote root)
CREATE USER IF NOT EXISTS 'rsm_app'@'localhost'
    IDENTIFIED BY 'CHANGE_THIS_TO_A_STRONG_RANDOM_PASSWORD';

-- 2. Grant only the minimum required privileges on the application database
GRANT SELECT, INSERT, UPDATE, DELETE
    ON rsm_db.*
    TO 'rsm_app'@'localhost';

-- 3. Grant CREATE/DROP only on specific migration tables (needed for auto-migrations)
GRANT CREATE, DROP, ALTER, INDEX
    ON rsm_db.*
    TO 'rsm_app'@'localhost';

-- 4. Explicitly deny dangerous global privileges
REVOKE IF EXISTS FILE       ON *.* FROM 'rsm_app'@'localhost';
REVOKE IF EXISTS PROCESS    ON *.* FROM 'rsm_app'@'localhost';
REVOKE IF EXISTS SUPER       ON *.* FROM 'rsm_app'@'localhost';
REVOKE IF EXISTS SHUTDOWN   ON *.* FROM 'rsm_app'@'localhost';
REVOKE IF EXISTS REPLICATION SLAVE ON *.* FROM 'rsm_app'@'localhost';

FLUSH PRIVILEGES;

-- 5. Verify
SELECT User, Host, authentication_string != '' AS has_password
FROM mysql.user
WHERE User = 'rsm_app';

-- ═══════════════════════════════════════════════════════════════════════════
-- After running this script, update your .env:
--   DB_USER=rsm_app
--   DB_PASSWORD=<the password you chose above>
-- ═══════════════════════════════════════════════════════════════════════════
