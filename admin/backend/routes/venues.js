
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { getActiveSessionId }   = require('../services/sessionCache');

// ── helpers ────────────────────────────────────────────────────────────────────

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  const ampm = hr >= 12 ? 'PM' : 'AM';
  const hr12 = hr % 12 || 12;
  return `${String(hr12).padStart(2, '0')}:${m} ${ampm}`;
}

// ── GET /api/venues?session_id=active|all|<id>&department= ─────────────────────
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { session_id, department } = req.query;

    let resolvedSessionId = session_id;
    if (!resolvedSessionId || resolvedSessionId === 'active') {
      resolvedSessionId = await getActiveSessionId();
    } else if (resolvedSessionId === 'all') {
      resolvedSessionId = null;
    }

    const conditions = [];
    const params     = [];

    if (resolvedSessionId) { conditions.push('v.session_id = ?'); params.push(resolvedSessionId); }
    if (department)        { conditions.push('v.department = ?'); params.push(department); }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.execute(`
      SELECT v.*,
             CONCAT(s.month, ' ', s.year) AS session_name,
             TIME_FORMAT(v.from_time, '%h:%i %p') AS from_time_fmt,
             TIME_FORMAT(v.to_time,   '%h:%i %p') AS to_time_fmt,
             COALESCE((
               SELECT COUNT(*) FROM hall_tickets ht WHERE ht.venue_id = v.id
             ), 0) AS allocated_count,
             v.capacity - COALESCE((
               SELECT COUNT(*) FROM hall_tickets ht WHERE ht.venue_id = v.id
             ), 0) AS remaining_seats
      FROM venues v
      JOIN sessions s ON v.session_id = s.id
      ${whereClause}
      ORDER BY v.department, v.exam_date, v.from_time
    `, params);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/venues/:id ────────────────────────────────────────────────────────
router.get('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT v.*,
             CONCAT(s.month, ' ', s.year) AS session_name,
             TIME_FORMAT(v.from_time, '%h:%i %p') AS from_time_fmt,
             TIME_FORMAT(v.to_time,   '%h:%i %p') AS to_time_fmt,
             COALESCE((
               SELECT COUNT(*) FROM hall_tickets ht WHERE ht.venue_id = v.id
             ), 0) AS allocated_count
      FROM venues v
      JOIN sessions s ON v.session_id = s.id
      WHERE v.id = ?
    `, [req.params.id]);

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'Venue not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/venues ───────────────────────────────────────────────────────────
router.post('/', verifyToken, isAdmin, async (req, res) => {
  const { session_id, department, hall_name, exam_date, from_time, to_time, capacity } = req.body;

  if (!session_id || !department || !hall_name || !exam_date || !from_time || !to_time || !capacity) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }
  if (from_time >= to_time) {
    return res.status(400).json({ success: false, message: '"From Time" must be before "To Time"' });
  }
  const cap = parseInt(capacity, 10);
  if (isNaN(cap) || cap < 1) {
    return res.status(400).json({ success: false, message: 'Capacity must be a positive number' });
  }

  try {
    // Time-overlap check: same hall, same date, overlapping slot
    const [overlap] = await pool.execute(`
      SELECT id FROM venues
      WHERE hall_name = ? AND exam_date = ?
        AND NOT (to_time <= ? OR from_time >= ?)
    `, [hall_name, exam_date, from_time, to_time]);

    if (overlap.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Time conflict: "${hall_name}" already has a slot that overlaps with ${fmtTime(from_time)}–${fmtTime(to_time)} on ${exam_date}.`
      });
    }

    const [result] = await pool.execute(
      'INSERT INTO venues (session_id, department, hall_name, exam_date, from_time, to_time, capacity) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [session_id, department, hall_name, exam_date, from_time, to_time, cap]
    );
    res.json({ success: true, message: 'Venue created successfully', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/venues/:id ────────────────────────────────────────────────────────
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  const { session_id, department, hall_name, exam_date, from_time, to_time, capacity } = req.body;
  const { id } = req.params;

  if (!session_id || !department || !hall_name || !exam_date || !from_time || !to_time || !capacity) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }
  if (from_time >= to_time) {
    return res.status(400).json({ success: false, message: '"From Time" must be before "To Time"' });
  }
  const cap = parseInt(capacity, 10);
  if (isNaN(cap) || cap < 1) {
    return res.status(400).json({ success: false, message: 'Capacity must be a positive number' });
  }

  try {
    // Time-overlap check (excluding self)
    const [overlap] = await pool.execute(`
      SELECT id FROM venues
      WHERE hall_name = ? AND exam_date = ? AND id != ?
        AND NOT (to_time <= ? OR from_time >= ?)
    `, [hall_name, exam_date, id, from_time, to_time]);

    if (overlap.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Time conflict: "${hall_name}" already has a slot that overlaps with ${fmtTime(from_time)}–${fmtTime(to_time)} on ${exam_date}.`
      });
    }

    // Capacity must not go below already-allocated count
    const [[{ allocated }]] = await pool.execute(
      'SELECT COUNT(*) as allocated FROM hall_tickets WHERE venue_id = ?', [id]
    );
    if (cap < allocated) {
      return res.status(400).json({
        success: false,
        message: `Cannot reduce capacity below ${allocated} (students already allocated to this venue).`
      });
    }

    await pool.execute(
      `UPDATE venues SET session_id=?, department=?, hall_name=?, exam_date=?, from_time=?, to_time=?, capacity=?, updated_at=NOW()
       WHERE id=?`,
      [session_id, department, hall_name, exam_date, from_time, to_time, cap, id]
    );
    
    // Enterprise sync: update dependent hall_tickets to match new venue department
    await pool.execute(
      `UPDATE hall_tickets SET department=? WHERE venue_id=?`,
      [department, id]
    );
    
    res.json({ success: true, message: 'Venue updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/venues/:id ─────────────────────────────────────────────────────
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const [[{ allocated }]] = await pool.execute(
      'SELECT COUNT(*) as allocated FROM hall_tickets WHERE venue_id = ?', [req.params.id]
    );
    if (allocated > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete: ${allocated} hall ticket(s) are already allocated to this venue. Revoke them first.`
      });
    }
    await pool.execute('DELETE FROM venues WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Venue deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
