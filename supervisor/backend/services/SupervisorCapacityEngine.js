const pool = require('../../../admin/backend/config/db');

/**
 * Enterprise Supervisor Capacity Automation Engine
 *
 * Rules:
 *   max_candidates         — from designation max_capacity (admin-set)
 *   full_time_max          — from designation full_time_max_capacity (admin-set)
 *   part_time_max          — from designation part_time_max_capacity (admin-set)
 *   current_vacancy        — max_candidates − current_scholars_count
 *   full_time_available    — full_time_max − current_full_time_scholars_count
 *   part_time_available    — part_time_max − current_part_time_scholars_count
 *
 * Scholar counts are 0 until the Scholar Allocation module is implemented.
 */
class SupervisorCapacityEngine {

    // ── Designation Config ────────────────────────────────────────────────────

    static async getAllConfigs() {
        const [rows] = await pool.query(`
            SELECT id AS designation_id, id, max_capacity,
                   full_time_max_capacity, part_time_max_capacity,
                   full_time_required, part_time_required,
                   is_active, name AS designation_name,
                   CASE WHEN is_active = 1 THEN 'Active' ELSE 'Inactive' END AS status
            FROM master_designations
            ORDER BY name ASC
        `);
        return rows;
    }

    static async getCapacityByDesignation(designationId) {
        if (!designationId) return null;
        const id = parseInt(designationId);
        const [rows] = await pool.query(
            `SELECT max_capacity, full_time_max_capacity, part_time_max_capacity,
                    full_time_required, part_time_required, is_active
             FROM master_designations
             WHERE id = ? LIMIT 1`,
            [id]
        );
        return rows[0] || null;
    }

    static async upsertConfig(designationId, maxCapacity, status) {
        const desigId  = parseInt(designationId);
        const capacity = parseInt(maxCapacity) || 0;
        const isActive = status === 'Inactive' ? 0 : 1;

        await pool.query(
            'UPDATE master_designations SET max_capacity = ?, is_active = ? WHERE id = ?',
            [capacity, isActive, desigId]
        );
        return { success: true };
    }

    // ── Vacancy Calculations ──────────────────────────────────────────────────

    /**
     * Calculate capacity breakdown using the designation's explicit FT/PT limits.
     * Falls back to max/floor(max/2) if the new columns are not set (0).
     */
    static calculateVacancyBreakdown(
        maxCandidates,
        currentScholarsCount   = 0,
        currentPtScholarsCount = 0,
        ftMaxCapacity          = 0,
        ptMaxCapacity          = 0
    ) {
        const max        = Math.max(0, maxCandidates);
        const scholars   = Math.max(0, currentScholarsCount);
        const ptScholars = Math.max(0, currentPtScholarsCount);

        // Use the designation-specific values; fall back to the legacy formula when unset
        const maxFt = ftMaxCapacity > 0 ? ftMaxCapacity : max;
        const maxPt = ptMaxCapacity > 0 ? ptMaxCapacity : Math.floor(max / 2);

        return {
            max_candidates:                   max,
            current_vacancy:                  Math.max(0, max - scholars),
            current_scholars_count:           scholars,
            current_part_time_scholars_count: ptScholars,
            max_full_time:                    maxFt,
            max_part_time:                    maxPt,
            full_time_available:              Math.max(0, maxFt - scholars),
            part_time_available:              Math.max(0, maxPt - ptScholars),
        };
    }

    /**
     * Full capacity detail lookup for a designation.
     * Returns max_full_time and max_part_time from the DB columns,
     * plus mandatory/optional flags for supervisor registration form.
     */
    static async calculateCapacityDetails(designationId, currentScholarsCount = 0, currentPtScholarsCount = 0) {
        const config = await this.getCapacityByDesignation(designationId);
        const maxCandidates   = config ? config.max_capacity              : 0;
        const ftMaxCapacity   = config ? (config.full_time_max_capacity || 0) : 0;
        const ptMaxCapacity   = config ? (config.part_time_max_capacity || 0) : 0;
        const isActive        = config ? config.is_active : 0;
        const ftRequired      = config ? (config.full_time_required  || 0) : 0;
        const ptRequired      = config ? (config.part_time_required  || 0) : 0;

        const breakdown = this.calculateVacancyBreakdown(
            maxCandidates, currentScholarsCount, currentPtScholarsCount,
            ftMaxCapacity, ptMaxCapacity
        );

        return {
            ...breakdown,
            is_active:               isActive,
            full_time_max_capacity:  ftMaxCapacity,
            part_time_max_capacity:  ptMaxCapacity,
            full_time_required:      ftRequired,
            part_time_required:      ptRequired,
        };
    }

    /**
     * Recalculate vacancy for an EXISTING supervisor record.
     */
    static async recalculateForSupervisor(supervisorId) {
        const [rows] = await pool.query(
            `SELECT COALESCE(d.max_capacity, s.max_candidates, 0)                    AS max_candidates,
                    COALESCE(d.full_time_max_capacity, 0)                            AS ft_max,
                    COALESCE(d.part_time_max_capacity, 0)                            AS pt_max,
                    COALESCE(s.current_scholars_count, 0)                            AS current_scholars_count,
                    COALESCE(s.current_part_time_scholars_count, 0)                  AS current_part_time_scholars_count
             FROM supervisors s
             LEFT JOIN master_designations d ON s.designation_id = d.id
             WHERE s.id = ?`,
            [supervisorId]
        );
        if (!rows[0]) return null;

        const { max_candidates, ft_max, pt_max, current_scholars_count, current_part_time_scholars_count } = rows[0];
        return this.calculateVacancyBreakdown(
            max_candidates,
            current_scholars_count,
            current_part_time_scholars_count,
            ft_max,
            pt_max
        );
    }

    // ── Validation ────────────────────────────────────────────────────────────

    /**
     * Validate that the supervisor's declared FT/PT slots fit within the
     * designation's specific capacity limits.
     */
    static async validateAllocation(designationId, ft, pt) {
        const config = await this.getCapacityByDesignation(designationId);
        if (!config) return { isValid: true };

        const maxTotal = config.max_capacity;
        const maxFt    = config.full_time_max_capacity > 0 ? config.full_time_max_capacity : maxTotal;
        const maxPt    = config.part_time_max_capacity > 0 ? config.part_time_max_capacity : Math.floor(maxTotal / 2);

        if (ft > maxFt) {
            return {
                isValid: false,
                message: `Full-Time slots (${ft}) exceeds designation Full-Time maximum of ${maxFt}`,
            };
        }
        if (pt > maxPt) {
            return {
                isValid: false,
                message: `Part-Time slots (${pt}) exceeds designation Part-Time maximum of ${maxPt}`,
            };
        }
        if (ft + pt > maxTotal) {
            return {
                isValid: false,
                message: `Combined capacity (${ft + pt}) exceeds designation Max Capacity of ${maxTotal}`,
            };
        }
        return { isValid: true };
    }

    static calculateInitialVacancy(maxTotal) {
        return Math.max(0, maxTotal);
    }
}

module.exports = SupervisorCapacityEngine;
