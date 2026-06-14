-- Academic Timeline Engine Migration
-- Provides admin-configurable year-gap rules between academic stages
-- and course duration rules for start→completion enforcement.

-- ── Transition Gap Rules ─────────────────────────────────────────────────────
-- Controls how many years must/can elapse between completing one stage
-- and starting (or completing) the next.
CREATE TABLE IF NOT EXISTS academic_timeline_rules (
    id             INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    transition_key VARCHAR(30)  NOT NULL UNIQUE,
    transition_label VARCHAR(60) NOT NULL,
    from_stage     VARCHAR(20)  NOT NULL,
    to_stage       VARCHAR(20)  NOT NULL,
    min_gap_years  INT          NOT NULL DEFAULT 0,
    max_gap_years  INT          NOT NULL DEFAULT 15,
    status         ENUM('active','inactive') NOT NULL DEFAULT 'active',
    updated_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by     VARCHAR(100) DEFAULT NULL
);

INSERT IGNORE INTO academic_timeline_rules
    (transition_key, transition_label, from_stage, to_stage, min_gap_years, max_gap_years)
VALUES
    ('sslc_hsc',   '10th → +2',     'sslc',  'hsc',   2,  5),
    ('hsc_ug',     '+2 → UG',       'hsc',   'ug',    0,  10),
    ('ug_pg',      'UG → PG',       'ug',    'pg',    0,  10),
    ('pg_mphil',   'PG → M.Phil',   'pg',    'mphil', 0,  15),
    ('mphil_phd',  'M.Phil → Ph.D', 'mphil', 'phd',   0,  15);

-- ── Course Duration Rules ─────────────────────────────────────────────────────
-- Controls the allowed span between start_year and completion_year
-- for courses that capture both fields.
CREATE TABLE IF NOT EXISTS course_duration_rules (
    id           INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    course_key   VARCHAR(20)  NOT NULL UNIQUE,
    course_label VARCHAR(50)  NOT NULL,
    min_duration INT          NOT NULL DEFAULT 1,
    max_duration INT          NOT NULL DEFAULT 5,
    status       ENUM('active','inactive') NOT NULL DEFAULT 'active',
    updated_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by   VARCHAR(100) DEFAULT NULL
);

INSERT IGNORE INTO course_duration_rules
    (course_key, course_label, min_duration, max_duration)
VALUES
    ('ug',         'UG',         3, 4),
    ('pg',         'PG',         2, 2),
    ('mphil',      'M.Phil',     1, 1),
    ('integrated', 'Integrated', 5, 5);
