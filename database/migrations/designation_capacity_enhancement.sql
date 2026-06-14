-- Designation Master Capacity Enhancement
-- Adds Full-Time / Part-Time specific capacity columns plus mandatory/optional flags.
-- Run once against the live database; safe to re-run (IF NOT EXISTS guards).

ALTER TABLE master_designations
    ADD COLUMN IF NOT EXISTS full_time_max_capacity INT          NOT NULL DEFAULT 0  COMMENT 'Max scholars a supervisor of this designation may supervise Full-Time',
    ADD COLUMN IF NOT EXISTS part_time_max_capacity INT          NOT NULL DEFAULT 0  COMMENT 'Max scholars a supervisor of this designation may supervise Part-Time',
    ADD COLUMN IF NOT EXISTS full_time_required      TINYINT(1)  NOT NULL DEFAULT 0  COMMENT '1 = Full-Time capacity is mandatory for supervisor registration',
    ADD COLUMN IF NOT EXISTS part_time_required      TINYINT(1)  NOT NULL DEFAULT 0  COMMENT '1 = Part-Time capacity is mandatory for supervisor registration';

-- Back-fill sensible defaults from existing max_capacity
-- (FT = max, PT = floor(max/2) — mirrors the previous hard-coded formula)
UPDATE master_designations
   SET full_time_max_capacity = max_capacity,
       part_time_max_capacity = FLOOR(max_capacity / 2)
 WHERE full_time_max_capacity = 0
   AND part_time_max_capacity = 0
   AND max_capacity > 0;
