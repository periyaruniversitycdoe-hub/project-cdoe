const pool = require('../../../admin/backend/config/db');

/**
 * Enterprise Supervisor Capacity Automation Engine
 *
 * Rules:
 *   max_candidates         — from designation config (admin-set)
 *   current_vacancy        — max_candidates − current_scholars_count
 *   full_time_available    — max_candidates − current_scholars_count
 *   part_time_available    — floor(max_candidates / 2) − current_part_time_scholars_count
 *
 * Scholar counts are 0 until the Scholar Allocation module is implemented.
 * Architecture is future-ready: pass actual counts when that module ships.
 */
class SupervisorCapacityEngine {

    // ── Designation Config ────────────────────────────────────────────────────

    static async getAllConfigs() {
        const [rows] = await pool.query(`
            SELECT id AS designation_id, id, max_capacity, is_active, name AS designation_name,
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
            `SELECT max_capacity, is_active FROM master_designations
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
     * Calculate capacity details for a designation.
     * currentScholarsCount / currentPtScholarsCount are 0 today.
     * Pass real values when Scholar Allocation Engine is implemented.
     */
    static calculateVacancyBreakdown(maxCandidates, currentScholarsCount = 0, currentPtScholarsCount = 0) {
        const max           = Math.max(0, maxCandidates);
        const scholars      = Math.max(0, currentScholarsCount);
        const ptScholars    = Math.max(0, currentPtScholarsCount);
        const maxPt         = Math.floor(max / 2);

        return {
            max_candidates:                   max,
            current_vacancy:                  Math.max(0, max - scholars),
            current_scholars_count:           scholars,
            current_part_time_scholars_count: ptScholars,
            max_full_time:                    max,
            max_part_time:                    maxPt,
            full_time_available:              Math.max(0, max - scholars),
            part_time_available:              Math.max(0, maxPt - ptScholars),
        };
    }

    /**
     * Full capacity detail lookup for a designation.
     * Used by forms when designation changes.
     */
    static async calculateCapacityDetails(designationId, currentScholarsCount = 0, currentPtScholarsCount = 0) {
        const config      = await this.getCapacityByDesignation(designationId);
        const maxCandidates = config ? config.max_capacity : 0;
        const isActive      = config ? config.is_active : 0;
        const breakdown     = this.calculateVacancyBreakdown(maxCandidates, currentScholarsCount, currentPtScholarsCount);
        return {
            ...breakdown,
            is_active: isActive
        };
    }

    /**
     * Recalculate vacancy for an EXISTING supervisor record.
     * Reads current_scholars_count from the DB (0 until Scholar Allocation ships).
     */
    static async recalculateForSupervisor(supervisorId) {
        const [rows] = await pool.query(
            `SELECT COALESCE(d.max_capacity, s.max_candidates, 0) AS max_candidates,
                    COALESCE(s.current_scholars_count, 0)           AS current_scholars_count,
                    COALESCE(s.current_part_time_scholars_count, 0) AS current_part_time_scholars_count
             FROM supervisors s
             LEFT JOIN master_designations d ON s.designation_id = d.id
             WHERE s.id = ?`,
            [supervisorId]
        );
        if (!rows[0]) return null;

        const { max_candidates, current_scholars_count, current_part_time_scholars_count } = rows[0];
        return this.calculateVacancyBreakdown(
            max_candidates,
            current_scholars_count,
            current_part_time_scholars_count
        );
    }

    // ── Validation ────────────────────────────────────────────────────────────

    static async validateAllocation(designationId, ft, pt) {
        const config = await this.getCapacityByDesignation(designationId);
        if (!config) return { isValid: true };

        const maxTotal = config.max_capacity;
        const maxPt    = Math.floor(maxTotal / 2);

        // FT and PT are independent slot limits — NOT additive.
        // A supervisor with max_candidates=6 can have up to 6 FT slots OR up to 3 PT slots.
        if (ft > maxTotal) {
            return {
                isValid: false,
                message: `Full-Time slots (${ft}) exceeds designation maximum of ${maxTotal}`,
            };
        }
        if (pt > maxPt) {
            return {
                isValid: false,
                message: `Part-Time slots (${pt}) exceeds allowed maximum of ${maxPt} (half of ${maxTotal})`,
            };
        }
        return { isValid: true };
    }

    static calculateInitialVacancy(maxTotal) {
        return Math.max(0, maxTotal);
    }
}

module.exports = SupervisorCapacityEngine;
