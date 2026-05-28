const pool = require('../config/db');
const ExcelJS = require('exceljs');
const Engine = require('./EntranceWorkflowEngine');

class AttendanceXlsGenerationEngine {

    static async generateDynamicAttendanceXls(session_id, department, venue_id, res) {
        // Build Strict Filter Pipeline conditions
        // 1. Payment Approved 2. Hall Ticket Generated 3. Venue Assigned 4. Resulting set is XLS Eligible
        const conditions = [
            "a.status IN ('Approved', 'Submitted')", 
            "a.payment_status IN ('Paid', 'Approved', 'Success')", 
            "ht.hall_ticket_number IS NOT NULL",
            "ht.venue_id IS NOT NULL"
        ];
        const params = [];

        if (session_id) { 
            conditions.push('COALESCE(a.session_id, u.session_id) = ?'); 
            params.push(session_id); 
        }
        if (department) { 
            conditions.push('a.subject = ?'); 
            params.push(department); 
        }
        if (venue_id) { 
            conditions.push('ht.venue_id = ?'); 
            params.push(venue_id); 
        }

        // Live DB scan — guarantees NO stale exports when allocation shifts
        const [rows] = await pool.execute(`
            SELECT a.application_id, ht.hall_ticket_number, u.full_name,
                   a.subject AS department, a.attendance_status, a.entrance_mark
            FROM applications a
            JOIN users u ON a.user_id = u.id
            JOIN hall_tickets ht ON ht.application_id = a.application_id
            WHERE ${conditions.join(' AND ')}
            ORDER BY ht.hall_ticket_number ASC
        `, params);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Periyar University ERP';
        const ws = workbook.addWorksheet('Attendance', { views: [{ state: 'frozen', ySplit: 3 }] });

        const TEAL = 'FF32C5D2';
        const DARK = 'FF2C3E50';

        ws.addRow(['ATTENDANCE & MARKS SHEET — Fill Present(P)/Absent(AAA) and Marks, then upload back']);
        ws.mergeCells('A1:F1');
        const instrCell = ws.getRow(1).getCell(1);
        instrCell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        instrCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
        instrCell.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(1).height = 22;

        ws.addRow(['NOTE: Present/Absent column — enter exactly "P" or "AAA". Marks column — numeric only. Do NOT change Application ID or Hall Ticket columns.']);
        ws.mergeCells('A2:F2');
        const noteCell = ws.getRow(2).getCell(1);
        noteCell.font = { italic: true, size: 9, color: { argb: 'FF555555' } };
        noteCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
        noteCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        ws.getRow(2).height = 28;

        const headers = ['Application ID', 'Hall Ticket No', 'Candidate Name', 'Department', 'Attendance Status', 'Mark'];
        ws.columns = [
            { key: 'application_id',     width: 18 },
            { key: 'hall_ticket_number', width: 18 },
            { key: 'full_name',          width: 30 },
            { key: 'department',         width: 24 },
            { key: 'attendance_status',  width: 16 },
            { key: 'entrance_mark',      width: 10 },
        ];
        
        const headerRow = ws.addRow(headers);
        headerRow.height = 22;
        headerRow.eachCell(cell => {
            cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { bottom: { style: 'medium', color: { argb: TEAL } } };
        });

        rows.forEach((r, i) => {
            const dr = ws.addRow([
                r.application_id,
                r.hall_ticket_number,
                r.full_name,
                r.department,
                r.attendance_status === 'Absent' ? 'AAA' : (r.attendance_status === 'Present' ? 'P' : ''),
                r.entrance_mark != null ? r.entrance_mark : '',
            ]);
            dr.height = 18;
            const bg = i % 2 === 0 ? 'FFF0FBFC' : 'FFFFFFFF';
            dr.eachCell({ includeEmpty: true }, (cell, cn) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                cell.font = { size: 10 };
                cell.alignment = { vertical: 'middle', horizontal: cn <= 2 ? 'center' : 'left' };
            });
            ws.getRow(3 + i + 1).getCell(1).protection = { locked: true };
            ws.getRow(3 + i + 1).getCell(2).protection = { locked: true };
            ws.getRow(3 + i + 1).getCell(3).protection = { locked: true };
            ws.getRow(3 + i + 1).getCell(4).protection = { locked: true };
        });

        ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 6 } };

        const filename = `attendance_template_${venue_id || department || 'all'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        await workbook.xlsx.write(res);
        res.end();
    }

    static async processAttendanceImport(filePath, session_id, venue_id, adminEmail) {
        let connection = await pool.getConnection();
        const errors = [];
        let successRows = 0;
        let totalRows = 0;
        let logId = null;
        let seenVenues = new Set();
        
        try {
            const [logResult] = await pool.execute(
                `INSERT INTO attendance_upload_logs (session_id, venue_id, file_name, file_path, uploaded_by, status)
                 VALUES (?, ?, ?, ?, ?, 'Processing')`,
                [session_id || null, venue_id || null, 'Bulk_Upload.xlsx', filePath, adminEmail]
            );
            logId = logResult.insertId;

            await connection.beginTransaction();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(filePath);
            const ws = workbook.worksheets[0];

            let headerRowNum = null;
            ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
                if (headerRowNum) return;
                if (String(row.getCell(1).value || '').trim() === 'Application ID') headerRowNum = rowNum;
            });

            if (!headerRowNum) throw new Error('Invalid file format. Header row not found.');

            const colMap = {};
            ws.getRow(headerRowNum).eachCell({ includeEmpty: false }, (cell, colNum) => {
                colMap[String(cell.value || '').trim()] = colNum;
            });

            const appIdCol = colMap['Application ID'];
            const htCol = colMap['Hall Ticket No'];
            const attCol = colMap['Attendance Status'];
            const markCol = colMap['Mark'];

            if (!appIdCol || !htCol || !attCol) throw new Error('Required columns missing in XLS');

            const seenIds = new Set();
            for (let rowNum = headerRowNum + 1; rowNum <= ws.rowCount; rowNum++) {
                const row = ws.getRow(rowNum);
                const appId = String(row.getCell(appIdCol).value || '').trim();
                const htNum = String(row.getCell(htCol).value || '').trim();
                const attRaw = String(row.getCell(attCol).value || '').trim().toUpperCase();
                const marksRaw = markCol ? row.getCell(markCol).value : null;

                if (!appId) continue;
                totalRows++;

                if (seenIds.has(appId)) { errors.push(`Row ${rowNum}: Duplicate App ID`); continue; }
                seenIds.add(appId);

                if (attRaw !== 'P' && attRaw !== 'AAA') {
                    errors.push(`Row ${rowNum}: Invalid attendance value "${attRaw}". Must be P or AAA`);
                    continue;
                }

                // Strictly validate Hall Ticket assignment mapping (prevents modifying students allocated elsewhere)
                const [[ht]] = await connection.execute(
                    'SELECT venue_id FROM hall_tickets WHERE application_id = ? AND hall_ticket_number = ?', 
                    [appId, htNum]
                );
                if (!ht) { errors.push(`Row ${rowNum}: Invalid Hall Ticket mapping for App ID ${appId}`); continue; }
                seenVenues.add(ht.venue_id);

                const [[app]] = await connection.execute('SELECT entrance_exam_status FROM applications WHERE application_id = ?', [appId]);
                if (app && app.entrance_exam_status === 'Exempted') {
                    errors.push(`Row ${rowNum}: Exempted student cannot have attendance tracked`);
                    continue;
                }

                let attendanceVal = 'Absent';
                let finalMark = null;

                if (attRaw === 'P') {
                    attendanceVal = 'Present';
                    if (marksRaw === null || marksRaw === '') {
                        errors.push(`Row ${rowNum}: Mark is required for Present student`);
                        continue;
                    }
                    finalMark = parseFloat(marksRaw);
                    if (isNaN(finalMark)) {
                        errors.push(`Row ${rowNum}: Invalid numeric mark`);
                        continue;
                    }
                }

                await connection.execute(
                    `UPDATE applications SET attendance_status = ?, entrance_mark = ?, updated_at = NOW() WHERE application_id = ?`,
                    [attendanceVal, finalMark, appId]
                );
                
                await Engine.processResult(appId, connection);
                successRows++;
            }
            await connection.commit();
            
            const detectedVenue = seenVenues.size === 1 ? [...seenVenues][0] : venue_id;
            await pool.execute(
                `UPDATE attendance_upload_logs SET status = 'Completed', venue_id = ?, total_rows = ?, success_rows = ?, error_rows = ?, errors_json = ?, processed_at = NOW() WHERE id = ?`,
                [detectedVenue || null, totalRows, successRows, errors.length, JSON.stringify(errors), logId]
            );

            connection.release();
            return { success: true, message: `Processed ${successRows} rows with ${errors.length} errors`, errors };
        } catch (e) {
            await connection.rollback();
            if (logId) {
                await pool.execute(
                    'UPDATE attendance_upload_logs SET status = ?, errors_json = ? WHERE id = ?', 
                    ['Failed', JSON.stringify([e.message]), logId]
                );
            }
            connection.release();
            throw e;
        }
    }
}

module.exports = AttendanceXlsGenerationEngine;
