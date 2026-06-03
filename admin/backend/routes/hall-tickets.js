
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { getActiveSessionId }   = require('../services/sessionCache');
const DependencyEngine = require('../services/EntranceFlowDependencyEngine');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(t) {
  if (!t) return '';
  const parts = String(t).split(':');
  const h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
}

function deptCode(dept) {
  return (dept || '').replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase() || 'GEN';
}

function seatLabel(index) {
  const letter = String.fromCharCode(65 + Math.floor(index / 99));
  const num    = (index % 99) + 1;
  return `${letter}${String(num).padStart(2, '0')}`;
}

// ─── EXISTING ROUTES (preserved exactly) ─────────────────────────────────────

/**
 * GET /api/hall-tickets/eligible
 */
router.get('/eligible', verifyToken, isAdmin, async (_req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT a.id, a.application_id, u.full_name, a.subject, a.exam_center_1
      FROM applications a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN hall_tickets h ON a.application_id = h.application_id
      WHERE a.status = 'Approved' AND h.id IS NULL
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/hall-tickets/issued
 */
router.get('/issued', verifyToken, isAdmin, async (req, res) => {
  try {
    const { session_id, department } = req.query;

    const conditions = [];
    const params     = [];

    if (session_id && session_id !== 'all') {
      if (session_id === 'active') {
        const activeId = await getActiveSessionId();
        if (activeId) { conditions.push('ht.session_id = ?'); params.push(activeId); }
      } else {
        conditions.push('ht.session_id = ?');
        params.push(session_id);
      }
    }
    if (department) { conditions.push('a.subject = ?'); params.push(department); }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.execute(`
      SELECT ht.*, u.full_name, a.subject, a.application_id AS app_id,
             v.hall_name AS venue_hall_name,
             TIME_FORMAT(v.from_time, '%h:%i %p') AS venue_from,
             TIME_FORMAT(v.to_time,   '%h:%i %p') AS venue_to,
             CONCAT(s.month, ' ', s.year) AS session_name
      FROM hall_tickets ht
      JOIN applications a  ON ht.application_id = a.application_id
      JOIN users u          ON a.user_id = u.id
      LEFT JOIN venues v    ON ht.venue_id = v.id
      LEFT JOIN sessions s  ON ht.session_id = s.id
      ${whereClause}
      ORDER BY ht.created_at DESC
    `, params);

    const formatted = rows.map(r => {
      const dept = r.subject ? r.subject.trim().toUpperCase() : '';
      const hall = (r.venue_hall_name || r.exam_venue || '').trim().toUpperCase();
      let venue = '';
      if (dept && hall) {
        venue = hall.includes(dept) ? hall : `${dept} - ${hall}`;
      } else {
        venue = hall || dept || '—';
      }
      return {
        ...r,
        venue_hall_name: venue,
        exam_venue: venue
      };
    });

    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/hall-tickets/generate
 * Legacy single-application generate (kept intact)
 */
router.post('/generate', verifyToken, isAdmin, async (req, res) => {
  const { application_id, exam_date, exam_time, exam_venue } = req.body;

  if (!application_id || !exam_date || !exam_time || !exam_venue) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }
  try {
    const [app] = await pool.execute(
      "SELECT id, session_id, subject, payment_status, entrance_exam_status FROM applications WHERE application_id = ? AND status = 'Approved'",
      [application_id]
    );
    if (app.length === 0)
      return res.status(400).json({ success: false, message: 'Application must be approved first' });
    if (app[0].entrance_exam_status === 'Exempted')
      return res.status(400).json({ success: false, message: 'Exempted students do not require a hall ticket' });
    if (app[0].payment_status !== 'Paid')
      return res.status(400).json({ success: false, message: 'Hall ticket cannot be generated: application fee not paid' });

    const year      = new Date().getFullYear();
    const dc        = deptCode(app[0].subject);
    const [[{maxNum}]] = await pool.execute(
      `SELECT MAX(CAST(SUBSTRING_INDEX(hall_ticket_number, '-', -1) AS UNSIGNED)) as maxNum
       FROM hall_tickets WHERE hall_ticket_number LIKE ?`,
      [`PHD${year}-${dc}-%`]
    );
    const htNumber = `PHD${year}-${dc}-${String((maxNum || 0) + 1).padStart(3, '0')}`;

    await pool.execute(
      `INSERT INTO hall_tickets
         (application_id, hall_ticket_number, exam_date, exam_time, exam_venue, session_id, department)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [application_id, htNumber, exam_date, exam_time, exam_venue,
       app[0].session_id || null, app[0].subject || null]
    );

    const [[appUser]] = await pool.execute('SELECT user_id FROM applications WHERE application_id = ?', [application_id]);
    if (appUser) {
      const { notifyUser } = require('../services/notifyUser');
      await notifyUser(pool, appUser.user_id,
        'Hall Ticket Generated ✓',
        `Your hall ticket (${htNumber}) has been generated. Exam: ${exam_date} at ${exam_time}, Venue: ${exam_venue}. Download it from your dashboard.`,
        'hall_ticket'
      );
    }

    res.json({ success: true, message: 'Hall Ticket generated successfully', hall_ticket_number: htNumber });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/hall-tickets/print/:id
 */
router.get('/print/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT h.*, u.full_name, a.subject, a.exam_center_1, a.application_id AS app_id,
             v.hall_name AS venue_hall_name,
             TIME_FORMAT(v.from_time, '%h:%i %p') AS venue_from,
             TIME_FORMAT(v.to_time,   '%h:%i %p') AS venue_to,
             (SELECT file_path
              FROM application_documents
              WHERE application_id = a.application_id AND document_type IN ('Photo', 'photo')
              LIMIT 1) AS photo_path
      FROM hall_tickets h
      JOIN applications a ON h.application_id = a.application_id
      JOIN users u         ON a.user_id = u.id
      LEFT JOIN venues v   ON h.venue_id = v.id
      WHERE h.id = ?
    `, [req.params.id]);

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'Hall Ticket not found' });

    const ticket = rows[0];
    const dept = ticket.subject ? ticket.subject.trim().toUpperCase() : '';
    const hall = (ticket.venue_hall_name || ticket.exam_venue || '').trim().toUpperCase();
    if (dept && hall) {
      if (hall.includes(dept)) {
        ticket.venue_hall_name = hall;
        ticket.exam_venue = hall;
      } else {
        ticket.venue_hall_name = `${dept} - ${hall}`;
        ticket.exam_venue = `${dept} - ${hall}`;
      }
    } else {
      const val = hall || dept || '—';
      ticket.venue_hall_name = val;
      ticket.exam_venue = val;
    }

    res.json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/hall-tickets/send/:id
 */
router.post('/send/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const [[ticket]] = await pool.execute(`
      SELECT ht.id, ht.application_id, ht.hall_ticket_number, ht.exam_date, ht.exam_time, ht.exam_venue,
             a.user_id
      FROM hall_tickets ht
      JOIN applications a ON ht.application_id = a.application_id
      WHERE ht.id = ?
    `, [req.params.id]);

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Hall Ticket not found' });
    }

    await pool.execute(
      'UPDATE hall_tickets SET is_sent = 1, sent_at = CURRENT_TIMESTAMP WHERE id = ?',
      [req.params.id]
    );

    if (ticket.user_id) {
      const { notifyUser } = require('../services/notifyUser');
      await notifyUser(pool, ticket.user_id,
        'Hall Ticket Dispatched ✓',
        `Your hall ticket (${ticket.hall_ticket_number}) has been sent. Exam: ${ticket.exam_date} at ${ticket.exam_time}, Venue: ${ticket.exam_venue}. You can download/print it from your dashboard.`,
        'hall_ticket'
      );
    }

    res.json({ success: true, message: 'Hall Ticket sent to student dashboard and email enqueued.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/hall-tickets/send-bulk
 */
router.post('/send-bulk', verifyToken, isAdmin, async (req, res) => {
  const { venue_id } = req.body;
  if (!venue_id)
    return res.status(400).json({ success: false, message: 'venue_id required' });
  try {
    const [unsentTickets] = await pool.execute(`
      SELECT ht.id, ht.application_id, ht.hall_ticket_number, ht.exam_date, ht.exam_time, ht.exam_venue,
             a.user_id
      FROM hall_tickets ht
      JOIN applications a ON ht.application_id = a.application_id
      WHERE ht.venue_id = ? AND ht.is_sent = 0
    `, [venue_id]);

    if (unsentTickets.length === 0) {
      return res.json({ success: true, message: 'No pending tickets in this venue to send.' });
    }

    await pool.execute(
      'UPDATE hall_tickets SET is_sent = 1, sent_at = CURRENT_TIMESTAMP WHERE venue_id = ? AND is_sent = 0',
      [venue_id]
    );

    for (const ticket of unsentTickets) {
      if (!ticket.user_id) continue;
      const { notifyUser } = require('../services/notifyUser');
      await notifyUser(pool, ticket.user_id,
        'Hall Ticket Dispatched ✓',
        `Your hall ticket (${ticket.hall_ticket_number}) has been sent. Exam: ${ticket.exam_date} at ${ticket.exam_time}, Venue: ${ticket.exam_venue}. You can download/print it from your dashboard.`,
        'hall_ticket'
      );
    }

    res.json({ success: true, message: `${unsentTickets.length} ticket(s) sent to student dashboards and emails.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/hall-tickets/send-all
 */
router.post('/send-all', verifyToken, isAdmin, async (req, res) => {
  try {
    const activeId = await getActiveSessionId();
    if (!activeId) {
      return res.status(400).json({ success: false, message: 'No active session found.' });
    }

    const [tickets] = await pool.execute(`
      SELECT ht.id, ht.application_id, ht.hall_ticket_number, ht.exam_date, ht.exam_time, ht.exam_venue,
             a.user_id
      FROM hall_tickets ht
      JOIN applications a ON ht.application_id = a.application_id
      WHERE ht.session_id = ?
    `, [activeId]);

    if (tickets.length === 0) {
      return res.json({ success: true, message: 'No hall tickets found to send.' });
    }

    const ticketIds = tickets.map(t => t.id);
    const placeholders = ticketIds.map(() => '?').join(',');

    await pool.execute(
      `UPDATE hall_tickets SET is_sent = 1, sent_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
      ticketIds
    );

    for (const ticket of tickets) {
      if (!ticket.user_id) continue;
      const { notifyUser } = require('../services/notifyUser');
      await notifyUser(pool, ticket.user_id,
        'Hall Ticket Dispatched ✓',
        `Your hall ticket (${ticket.hall_ticket_number}) has been sent. Exam: ${ticket.exam_date} at ${ticket.exam_time}, Venue: ${ticket.exam_venue}. You can download/print it from your dashboard.`,
        'hall_ticket'
      );
    }

    res.json({ success: true, message: `Successfully sent/re-sent ${tickets.length} hall ticket(s) to student dashboards and emails.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/hall-tickets/:id
 */
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const [[ticket]] = await pool.execute('SELECT application_id FROM hall_tickets WHERE id = ?', [req.params.id]);
    if (!ticket) return res.status(404).json({ success: false, message: 'Not found' });

    await DependencyEngine.onHallTicketRevoked(ticket.application_id);

    await pool.execute('DELETE FROM hall_tickets WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Hall Ticket revoked and workflows synchronized' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── RESTRUCTURED ROUTES ──────────────────────────────────────────────────────

/**
 * GET /api/hall-tickets/offered-courses
 * Kept for backward compatibility — no longer called by the new UI.
 */
router.get('/offered-courses', verifyToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT DISTINCT program_offered_name
      FROM applications
      WHERE program_offered_name IS NOT NULL AND program_offered_name != ''
      ORDER BY program_offered_name ASC
    `);
    res.json({ success: true, data: rows.map(r => r.program_offered_name) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/hall-tickets/students?session_id=&department=
 * Eligible students with allocation status. Offered-course filter removed;
 * generation is now application-ID based across the whole department.
 */
router.get('/students', verifyToken, isAdmin, async (req, res) => {
  try {
    const { session_id, department } = req.query;

    let resolvedSessionId = session_id;
    if (!resolvedSessionId || resolvedSessionId === 'active') {
      resolvedSessionId = await getActiveSessionId();
    } else if (resolvedSessionId === 'all') {
      resolvedSessionId = null;
    }

    const conditions = ["a.status IN ('Approved', 'Submitted')", "a.entrance_exam_status != 'Exempted'"];
    const params     = [];

    if (resolvedSessionId) { conditions.push('COALESCE(a.session_id, u.session_id) = ?'); params.push(resolvedSessionId); }
    if (department)        { conditions.push('a.subject = ?'); params.push(department); }

    const [rows] = await pool.execute(`
      SELECT a.id, a.application_id, u.full_name, a.subject,
             ht.id          AS ticket_id,
             ht.hall_ticket_number,
             ht.venue_id,
             ht.seat_number,
             ht.is_sent,
             v.hall_name    AS venue_name
      FROM applications a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN hall_tickets ht ON ht.application_id = a.application_id AND ht.venue_id IS NOT NULL
      LEFT JOIN venues v        ON ht.venue_id = v.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY u.full_name ASC
    `, params);

    // Department-wise summary
    const deptParams = [];
    const conditionsSummary = ["a.status IN ('Approved', 'Submitted')", "a.payment_status IN ('Paid', 'Approved')"];
    if (resolvedSessionId) {
      conditionsSummary.push("COALESCE(a.session_id, u.session_id) = ?");
      deptParams.push(resolvedSessionId);
    }
    const whereSummary = conditionsSummary.length ? `WHERE ${conditionsSummary.join(' AND ')}` : '';
    const [deptCounts] = await pool.execute(`
      SELECT a.subject                                                                 AS department,
             COUNT(*)                                                                  AS total,
             SUM(CASE WHEN ht.venue_id IS NOT NULL THEN 1 ELSE 0 END)                AS allocated,
             COUNT(*) - SUM(CASE WHEN ht.venue_id IS NOT NULL THEN 1 ELSE 0 END)     AS unallocated
      FROM applications a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN hall_tickets ht ON ht.application_id = a.application_id AND ht.venue_id IS NOT NULL
      ${whereSummary}
      GROUP BY a.subject
      ORDER BY a.subject
    `, deptParams);

    res.json({ success: true, data: rows, deptCounts, resolvedSessionId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/hall-tickets/preview
 * Dry-run: returns the list of students + generated numbers WITHOUT committing.
 * Exam date/time are now supplied by the caller (generation form), not the venue.
 */
router.post('/preview', verifyToken, isAdmin, async (req, res) => {
  const { venue_id, session_id, department, exam_date, from_time, to_time, count } = req.body;

  if (!venue_id || !session_id || !department) {
    return res.status(400).json({ success: false, message: 'venue_id, session_id and department are required' });
  }
  if (!exam_date || !from_time || !to_time) {
    return res.status(400).json({ success: false, message: 'Exam Date, From Time and To Time are required' });
  }

  let resolvedSessionId = session_id;
  if (!resolvedSessionId || resolvedSessionId === 'active') {
    resolvedSessionId = await getActiveSessionId();
  }
  if (!resolvedSessionId) {
    return res.status(400).json({ success: false, message: 'Active session could not be resolved.' });
  }

  try {
    const [[venue]] = await pool.execute('SELECT * FROM venues WHERE id = ?', [venue_id]);
    if (!venue) return res.status(404).json({ success: false, message: 'Venue not found' });

    const [[{ allocated }]] = await pool.execute(
      'SELECT COUNT(*) as allocated FROM hall_tickets WHERE venue_id = ?', [venue_id]
    );
    const remaining     = venue.capacity - allocated;
    const numToAllocate = Math.min(parseInt(count, 10) || remaining, remaining);

    if (numToAllocate <= 0) {
      return res.status(400).json({ success: false, message: 'No remaining seats in this venue' });
    }

    // Students eligible for this session+department, not yet allocated to any venue
    const conditions = [
      "a.status IN ('Approved', 'Submitted')",
      "a.payment_status IN ('Paid', 'Approved')",
      "a.entrance_exam_status != 'Exempted'",
      "COALESCE(a.session_id, u.session_id) = ?",
      "a.subject = ?",
      "ht.id IS NULL"
    ];
    const params = [resolvedSessionId, department];

    const [students] = await pool.execute(`
      SELECT a.id, a.application_id, u.full_name, a.subject
      FROM applications a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN hall_tickets ht ON ht.application_id = a.application_id AND ht.venue_id IS NOT NULL
      WHERE ${conditions.join(' AND ')}
      ORDER BY a.created_at ASC
      LIMIT ${numToAllocate}
    `, params);

    if (students.length === 0) {
      return res.status(400).json({ success: false, message: 'No unallocated students found for this department' });
    }

    const year = new Date().getFullYear();
    const dc   = deptCode(department);
    const [[{ maxNum }]] = await pool.execute(
      `SELECT MAX(CAST(SUBSTRING_INDEX(hall_ticket_number, '-', -1) AS UNSIGNED)) AS maxNum
       FROM hall_tickets WHERE hall_ticket_number LIKE ?`,
      [`PHD${year}-${dc}-%`]
    );

    let runningNum = (maxNum || 0) + 1;
    let seatBase   = parseInt(allocated, 10);

    const preview = students.map(s => {
      const ht   = `PHD${year}-${dc}-${String(runningNum).padStart(3, '0')}`;
      const seat = seatLabel(seatBase);
      runningNum++;
      seatBase++;
      return { id: s.id, application_id: s.application_id, full_name: s.full_name, hall_ticket_number: ht, seat_number: seat };
    });

    res.json({
      success: true,
      venue: { id: venue.id, hall_name: venue.hall_name, capacity: venue.capacity },
      exam_date,
      from_time,
      to_time,
      from_time_fmt: fmtTime(from_time),
      to_time_fmt:   fmtTime(to_time),
      allocated,
      remaining,
      count: preview.length,
      preview
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/hall-tickets/bulk-generate
 * Confirm and commit the allocation.
 * Exam date/time are supplied by the caller, not pulled from the venue record.
 */
router.post('/bulk-generate', verifyToken, isAdmin, async (req, res) => {
  const { venue_id, session_id, department, exam_date, from_time, to_time, count, auto_send } = req.body;

  if (!venue_id || !session_id || !department) {
    return res.status(400).json({ success: false, message: 'venue_id, session_id and department are required' });
  }
  if (!exam_date || !from_time || !to_time) {
    return res.status(400).json({ success: false, message: 'Exam Date, From Time and To Time are required' });
  }

  let resolvedSessionId = session_id;
  if (!resolvedSessionId || resolvedSessionId === 'active') {
    resolvedSessionId = await getActiveSessionId();
  }
  if (!resolvedSessionId) {
    return res.status(400).json({ success: false, message: 'Active session could not be resolved.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [[venue]] = await connection.execute(
      'SELECT * FROM venues WHERE id = ? FOR UPDATE', [venue_id]
    );
    if (!venue) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    const [[{ allocated }]] = await connection.execute(
      'SELECT COUNT(*) as allocated FROM hall_tickets WHERE venue_id = ?', [venue_id]
    );
    const remaining     = venue.capacity - allocated;
    const numToAllocate = Math.min(parseInt(count, 10) || remaining, remaining);

    if (numToAllocate <= 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'No remaining seats in this venue' });
    }

    const conditions = [
      "a.status IN ('Approved', 'Submitted')",
      "a.payment_status IN ('Paid', 'Approved')",
      "a.entrance_exam_status != 'Exempted'",
      "COALESCE(a.session_id, u.session_id) = ?",
      "a.subject = ?",
      "ht.id IS NULL"
    ];
    const params = [resolvedSessionId, department];

    const [students] = await connection.execute(`
      SELECT a.id, a.application_id, u.full_name, a.subject
      FROM applications a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN hall_tickets ht ON ht.application_id = a.application_id AND ht.venue_id IS NOT NULL
      WHERE ${conditions.join(' AND ')}
      ORDER BY a.created_at ASC
      LIMIT ${numToAllocate}
    `, params);

    if (students.length === 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'No unallocated students found' });
    }

    const year        = new Date().getFullYear();
    const dc          = deptCode(department);
    const examTimeStr = `${fmtTime(from_time)} - ${fmtTime(to_time)}`;
    const isSent      = auto_send ? 1 : 0;

    const [[{ maxNum }]] = await connection.execute(
      `SELECT MAX(CAST(SUBSTRING_INDEX(hall_ticket_number, '-', -1) AS UNSIGNED)) AS maxNum
       FROM hall_tickets WHERE hall_ticket_number LIKE ?`,
      [`PHD${year}-${dc}-%`]
    );

    let runningNum = (maxNum || 0) + 1;
    let seatBase   = parseInt(allocated, 10);
    const generated = [];

    for (const student of students) {
      const htNumber   = `PHD${year}-${dc}-${String(runningNum).padStart(3, '0')}`;
      const seatNumber = seatLabel(seatBase);

      await connection.execute(`
        INSERT INTO hall_tickets
          (application_id, hall_ticket_number, exam_date, exam_time, exam_venue,
           venue_id, seat_number, session_id, department, is_sent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        student.application_id, htNumber,
        exam_date, examTimeStr, venue.hall_name,
        venue_id, seatNumber, resolvedSessionId, department, isSent
      ]);

      generated.push({ application_id: student.application_id, full_name: student.full_name, hall_ticket_number: htNumber, seat_number: seatNumber });
      runningNum++;
      seatBase++;
    }

    await connection.commit();

    // Bulk notify
    if (generated.length > 0) {
      try {
        const appIds = generated.map(g => g.application_id);
        const placeholders = appIds.map(() => '?').join(',');
        const [userRows] = await connection.execute(
          `SELECT user_id, application_id FROM applications WHERE application_id IN (${placeholders})`,
          appIds
        );
        if (userRows.length > 0) {
          const { notifyBulk } = require('../services/notifyUser');
          const userIds = userRows.map(r => r.user_id);
          await notifyBulk(connection, userIds,
            'Hall Ticket Generated ✓',
            `Your hall ticket has been generated. Exam: ${exam_date} at ${examTimeStr}, Venue: ${venue.hall_name}. Download it from your dashboard.`,
            'hall_ticket'
          );
        }
      } catch (_) {}
    }

    res.json({
      success: true,
      message: `${generated.length} hall ticket(s) generated successfully`,
      generated
    });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/hall-tickets/auto-allocate
 * Auto-fill ALL venues for a session.
 * Exam date/time are now supplied in the request body and applied to all generated tickets.
 */
router.post('/auto-allocate', verifyToken, isAdmin, async (req, res) => {
  const { session_id, exam_date, from_time, to_time } = req.body;

  if (!session_id)
    return res.status(400).json({ success: false, message: 'session_id required' });
  if (!exam_date || !from_time || !to_time)
    return res.status(400).json({ success: false, message: 'Exam Date, From Time and To Time are required for auto-allocation' });

  const examTimeStr = `${fmtTime(from_time)} - ${fmtTime(to_time)}`;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [venues] = await connection.execute(`
      SELECT v.*,
             v.capacity - COALESCE((SELECT COUNT(*) FROM hall_tickets ht WHERE ht.venue_id = v.id), 0) AS remaining
      FROM venues v
      WHERE v.session_id = ?
      HAVING remaining > 0
      ORDER BY v.department, v.hall_name
    `, [session_id]);

    if (venues.length === 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'No venues with remaining capacity found for this session' });
    }

    const year = new Date().getFullYear();
    let totalGenerated = 0;

    for (const venue of venues) {
      const remaining = parseInt(venue.remaining, 10);
      if (remaining <= 0) continue;

      const [students] = await connection.execute(`
        SELECT a.application_id, u.full_name, a.subject
        FROM applications a
        JOIN users u ON a.user_id = u.id
        LEFT JOIN hall_tickets ht ON ht.application_id = a.application_id AND ht.venue_id IS NOT NULL
        WHERE a.status IN ('Approved', 'Submitted')
          AND a.entrance_exam_status != 'Exempted'
          AND COALESCE(a.session_id, u.session_id) = ?
          AND a.subject = ?
          AND ht.id IS NULL
        ORDER BY a.created_at ASC
        LIMIT ${remaining}
      `, [session_id, venue.department]);

      if (students.length === 0) continue;

      const dc = deptCode(venue.department);
      const [[{ allocated }]] = await connection.execute(
        'SELECT COUNT(*) as allocated FROM hall_tickets WHERE venue_id = ?', [venue.id]
      );
      const [[{ maxNum }]] = await connection.execute(
        `SELECT MAX(CAST(SUBSTRING_INDEX(hall_ticket_number, '-', -1) AS UNSIGNED)) AS maxNum
         FROM hall_tickets WHERE hall_ticket_number LIKE ?`,
        [`PHD${year}-${dc}-%`]
      );

      let runningNum = (maxNum || 0) + 1;
      let seatBase   = parseInt(allocated, 10);

      for (const student of students) {
        const htNumber   = `PHD${year}-${dc}-${String(runningNum).padStart(3, '0')}`;
        const seatNumber = seatLabel(seatBase);
        await connection.execute(`
          INSERT INTO hall_tickets
            (application_id, hall_ticket_number, exam_date, exam_time, exam_venue,
             venue_id, seat_number, session_id, department)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [student.application_id, htNumber, exam_date, examTimeStr, venue.hall_name,
            venue.id, seatNumber, session_id, venue.department]);
        runningNum++;
        seatBase++;
        totalGenerated++;
      }
    }

    await connection.commit();
    res.json({ success: true, message: `Auto-allocated ${totalGenerated} hall ticket(s)`, totalGenerated });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
