'use strict';
const db = require('../config/db');

class CommunityFeeCalculationService {
    /**
     * Normalizes a community name string to match keys in community_fees table.
     * Maps descriptives/abbreviations like 'BC - Backward Class' or 'BCM' to correct master names.
     */
    static normalizeCommunity(community) {
        if (!community) return 'OC';
        const upper = community.toUpperCase().trim();
        if (upper.startsWith('BCM') || upper.includes('BC(MUSLIM)') || upper.includes('BACKWARD CLASS MUSLIM')) {
            return 'BC(Muslim)';
        }
        if (upper.startsWith('MBC') || upper.includes('MOST BACKWARD CLASS')) {
            return 'MBC';
        }
        if (upper.startsWith('BC') || upper.includes('BACKWARD CLASS')) {
            return 'BC';
        }
        if (upper.startsWith('DNC') || upper.includes('DENOTIFIED')) {
            return 'DNC';
        }
        if (upper.startsWith('SCA') || upper.includes('SCA') || upper.includes('ARUNTHATHIYAR')) {
            return 'SC(A)';
        }
        if (upper.startsWith('SC') || upper.includes('SCHEDULED CASTE')) {
            return 'SC';
        }
        if (upper.startsWith('ST') || upper.includes('SCHEDULED TRIBE')) {
            return 'ST';
        }
        if (upper.startsWith('OC') || upper.includes('OPEN CATEGORY')) {
            return 'OC';
        }
        for (const key of ['OC', 'BC', 'BC(Muslim)', 'MBC', 'DNC', 'OBC', 'SC', 'SC(A)', 'ST']) {
            if (upper.startsWith(key.toUpperCase())) return key;
        }
        return 'OC';
    }

    /**
     * Legacy signature compatibility. Returns General fee for the community.
     */
    static async getFeeForCommunity(communityName, connection = db) {
        return this.calculateFee(communityName, false, connection);
    }

    /**
     * Calculates fee based on community and differently abled status.
     * Enforces Priority: Differently Abled Fee > General Fee.
     */
    static async calculateFee(communityName, isPhysicallyChallenged, connection = db) {
        const normalized = this.normalizeCommunity(communityName);
        const [rows] = await connection.query(
            'SELECT general_fee, differently_abled_fee FROM community_fees WHERE community_name = ?',
            [normalized]
        );
        
        let general = 1500;
        let diffAbled = 500;
        if (rows.length > 0) {
            general = rows[0].general_fee !== null ? parseFloat(rows[0].general_fee) : 1500;
            diffAbled = rows[0].differently_abled_fee !== null ? parseFloat(rows[0].differently_abled_fee) : 500;
        }

        const isDA = [1, '1', 'Yes', 'yes'].includes(isPhysicallyChallenged);
        const finalAmount = isDA ? diffAbled : general;

        return finalAmount;
    }

    /**
     * Validates payment amount against expected fee. Throws error if there's a mismatch.
     * Additionally logs the calculation to payment_audit_logs for audit tracking.
     */
    static async validatePaymentAmount(orderId, userId, communityName, isPhysicallyChallenged, amountProvided, connection = db) {
        const expectedFee = await this.calculateFee(communityName, isPhysicallyChallenged, connection);
        const provided = parseFloat(amountProvided);

        // Audit Log entry
        try {
            await connection.query(
                `INSERT INTO payment_audit_logs (order_id, user_id, action, old_status, new_status, details, created_at)
                 VALUES (?, ?, 'FEE_CALCULATION', 'INIT', ?, ?, NOW())`,
                [
                    orderId || null,
                    userId || null,
                    provided === expectedFee ? 'SUCCESS' : 'MISMATCH_ALERT',
                    JSON.stringify({
                        community: communityName,
                        normalizedCommunity: this.normalizeCommunity(communityName),
                        isPhysicallyChallenged,
                        expectedFee,
                        amountProvided: provided
                    })
                ]
            );
        } catch (e) {
            console.error('[CommunityFeeCalculationService] Audit log error:', e.message);
        }

        if (Math.abs(provided - expectedFee) > 0.01) {
            throw new Error(`Payment amount mismatch. Expected ₹${expectedFee}, got ₹${provided}`);
        }

        return expectedFee;
    }
}

module.exports = CommunityFeeCalculationService;
