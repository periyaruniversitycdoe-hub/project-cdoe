-- Research Centre Department Mapping
-- Many-to-Many: one research centre may be recognized for multiple departments.
-- Departments are sourced exclusively from the Eligibility Management departments table.

CREATE TABLE IF NOT EXISTS research_centre_departments (
    id                 INT           NOT NULL AUTO_INCREMENT,
    research_centre_id INT           NOT NULL,
    department_id      INT           NOT NULL,
    created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE  KEY uq_centre_dept (research_centre_id, department_id),
    CONSTRAINT fk_rcd_centre FOREIGN KEY (research_centre_id) REFERENCES research_centres (id) ON DELETE CASCADE,
    CONSTRAINT fk_rcd_dept   FOREIGN KEY (department_id)      REFERENCES departments       (id) ON DELETE CASCADE
);
