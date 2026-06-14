-- CGPA Normalization Engine: add cgpa_scale and normalized_cgpa to higher_education
-- Applies to UG, PG, and M.Phil records only.
-- cgpa_scale: the denominator selected by the student (4, 6, 8, or 10)
-- normalized_cgpa: (score_value / cgpa_scale) * 10 — always on a 10-point scale

ALTER TABLE higher_education
  ADD COLUMN IF NOT EXISTS cgpa_scale      TINYINT       DEFAULT NULL
    COMMENT 'CGPA scale denominator: 4, 6, 8, or 10. NULL when score_type = Percentage.',
  ADD COLUMN IF NOT EXISTS normalized_cgpa DECIMAL(5,2)  DEFAULT NULL
    COMMENT 'Normalized CGPA on 10-point scale = (score_value / cgpa_scale) * 10. NULL when score_type = Percentage.';
