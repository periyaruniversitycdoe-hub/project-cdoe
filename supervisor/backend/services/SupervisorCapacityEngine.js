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
            SELECT scm.id, scm.designation_id, scm.max_capacity, scm.status,
                   d.name AS designation_name
            FROM supervisor_capacity_master scm
            JOIN master_designations d ON scm.designation_id = d.id
            ORDER BY d.name ASC
        `);
        return rows;
    }

    static async getCapacityByDesignation(designationId) {
        if (!designationId) return null;
        const id = parseInt(designationId);
        const [rows] = await pool.query(
            `SELECT max_capacity FROM supervisor_capacity_master
             WHERE designation_id = ? AND status = 'Active' LIMIT 1`,
            [id]
        );
        return rows[0] || null;
    }

    static async upsertConfig(designationId, maxCapacity, status) {
        const desigId  = parseInt(designationId);
        const capacity = parseInt(maxCapacity) || 0;
        const stat     = status === 'Inactive' ? 'Inactive' : 'Active';

        const [existing] = await pool.query(
            'SELECT id FROM supervisor_capacity_master WHERE designation_id = ? LIMIT 1',
            [desigId]
        );

        if (existing.length > 0) {
            await pool.query(
                'UPDATE supervisor_capacity_master SET max_capacity = ?, status = ? WHERE designation_id = ?',
                [capacity, stat, desigId]
            );
        } else {
            await pool.query(
                'INSERT INTO supervisor_capacity_master (designation_id, max_capacity, status) VALUES (?, ?, ?)',
                [desigId, capacity, stat]
            );
        }
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
        return this.calculateVacancyBreakdown(maxCandidates, currentScholarsCount, currentPtScholarsCount);
    }

    /**
     * Recalculate vacancy for an EXISTING supervisor record.
     * Reads current_scholars_count from the DB (0 until Scholar Allocation ships).
     */
    static async recalculateForSupervisor(supervisorId) {
        const [rows] = await pool.query(
            `SELECT s.max_candidates,
                    COALESCE(s.current_scholars_count, 0)           AS current_scholars_count,
                    COALESCE(s.current_part_time_scholars_count, 0) AS current_part_time_scholars_count
             FROM supervisors s
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
