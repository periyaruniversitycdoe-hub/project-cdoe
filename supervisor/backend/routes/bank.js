const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const https = require('https');

// Master list of Indian banks
const INDIAN_BANKS = [
  "STATE BANK OF INDIA",
  "HDFC BANK",
  "ICICI BANK",
  "AXIS BANK",
  "CANARA BANK",
  "UNION BANK OF INDIA",
  "BANK OF BARODA",
  "PUNJAB NATIONAL BANK",
  "INDIAN BANK",
  "INDIAN OVERSEAS BANK",
  "KOTAK MAHINDRA BANK",
  "YES BANK",
  "IDFC FIRST BANK",
  "UCO BANK",
  "CENTRAL BANK OF INDIA",
  "BANK OF INDIA",
  "FEDERAL BANK",
  "KARUR VYSYA BANK",
  "SOUTH INDIAN BANK",
  "CITY UNION BANK",
  "PUNJAB & SIND BANK",
  "BANDHAN BANK",
  "STANDARD CHARTERED BANK",
  "HSBC BANK",
  "CITIBANK",
  "INDUSIND BANK",
  "RBL BANK",
  "KARNATAKA BANK",
  "DBS BANK",
  "JAMMU & KASHMIR BANK",
  "TAMILNAD MERCANTILE BANK"
];

// Helper to query Razorpay IFSC API via https built-in module
function fetchIFSCDetails(ifscCode) {
  return new Promise((resolve, reject) => {
    const url = `https://ifsc.razorpay.com/${ifscCode}`;
    https.get(url, (res) => {
      if (res.statusCode === 404) {
        return resolve(null); // Unknown IFSC
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Razorpay API status: ${res.statusCode}`));
      }
      let rawData = '';
      res.on('data', chunk => rawData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(rawData));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', err => reject(err));
  });
}

// Safely execute Database alterations on module load
(async function runDbMigrations() {
  console.log('[Bank Migration] Verifying bank fields in supervisors table...');
  try {
    const [columns] = await pool.query("SHOW COLUMNS FROM supervisors");
    const fields = columns.map(c => c.Field.toLowerCase());

    const migrations = [
      { name: 'bank_holder_name', query: 'ALTER TABLE supervisors ADD COLUMN bank_holder_name VARCHAR(255) NULL' },
      { name: 'bank_name', query: 'ALTER TABLE supervisors ADD COLUMN bank_name VARCHAR(255) NULL' },
      { name: 'account_number', query: 'ALTER TABLE supervisors ADD COLUMN account_number VARCHAR(50) NULL' },
      { name: 'ifsc_code', query: 'ALTER TABLE supervisors ADD COLUMN ifsc_code VARCHAR(20) NULL' }
    ];

    for (const m of migrations) {
      if (!fields.includes(m.name)) {
        console.log(`[Bank Migration] Adding column: ${m.name}`);
        await pool.query(m.query);
      }
    }
    console.log('[Bank Migration] Table verification completed successfully.');
  } catch (err) {
    console.error('[Bank Migration] Database schema update failed:', err.message);
  }
})();

// 1. GET /api/banks — Returns master list of major Indian banks
router.get('/banks', (req, res) => {
  res.json({ success: true, data: INDIAN_BANKS });
});

// 2. GET /api/ifsc/:ifsc — Resolves IFSC via Razorpay proxy API
router.get('/ifsc/:ifsc', async (req, res) => {
  let { ifsc } = req.params;
  ifsc = ifsc ? ifsc.trim().toUpperCase() : '';

  // Validation
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  if (!ifscRegex.test(ifsc)) {
    return res.status(400).json({ success: false, message: 'Invalid IFSC format. Must be 11 characters (e.g. SBIN0000456)' });
  }

  try {
    const details = await fetchIFSCDetails(ifsc);
    if (!details) {
      return res.status(404).json({ success: false, message: 'IFSC code not found' });
    }

    // Dynamic bank match
    const rawBank = (details.BANK || '').toUpperCase();
    const matchedBank = INDIAN_BANKS.find(b => 
      b === rawBank || rawBank.includes(b) || b.includes(rawBank)
    ) || rawBank;

    res.json({
      success: true,
      data: {
        ifsc: details.IFSC,
        bank_name: matchedBank,
        branch: details.BRANCH,
        city: details.CITY,
        state: details.STATE,
        address: details.ADDRESS
      }
    });
  } catch (err) {
    console.error(`[IFSC API Error] Failed resolving IFSC ${ifsc}:`, err.message);
    res.status(500).json({ success: false, message: 'Failed to resolve IFSC from lookup server. Please select your bank manually.' });
  }
});

// 3. GET /api/supervisor/bank-details — Fetch saved bank details
router.get('/supervisor/bank-details', verifyToken, async (req, res) => {
  try {
    const [userRows] = await pool.query('SELECT supervisor_id FROM supervisor_users WHERE id = ?', [req.user.id]);
    const supervisorId = userRows[0]?.supervisor_id;

    if (!supervisorId) {
      return res.json({
        success: true,
        data: { bank_holder_name: '', bank_name: '', account_number: '', ifsc_code: '' }
      });
    }

    const [rows] = await pool.query(
      'SELECT bank_holder_name, bank_name, account_number, ifsc_code FROM supervisors WHERE id = ?',
      [supervisorId]
    );

    if (rows.length === 0) {
      return res.json({
        success: true,
        data: { bank_holder_name: '', bank_name: '', account_number: '', ifsc_code: '' }
      });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[Get Bank Details Error]:', err.message);
    res.status(500).json({ success: false, message: 'Server error fetching bank details' });
  }
});

// 4. POST /api/supervisor/bank-details — Save bank details
router.post('/supervisor/bank-details', verifyToken, async (req, res) => {
  const { bank_holder_name, bank_name, account_number, ifsc_code } = req.body;

  // Real-time backend validations
  if (!bank_holder_name || !bank_name || !account_number || !ifsc_code) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  const holderUpper = bank_holder_name.trim().toUpperCase();
  const bankUpper = bank_name.trim().toUpperCase();
  const accountClean = account_number.trim();
  const ifscUpper = ifsc_code.trim().toUpperCase();

  // Validate Holder Name
  if (!/^[A-Z\s]{3,}$/.test(holderUpper)) {
    return res.status(400).json({ success: false, message: 'Bank Holder Name must contain at least 3 alphabetic characters and spaces only.' });
  }

  // Validate Bank Name in Master Dropdown
  if (!INDIAN_BANKS.includes(bankUpper)) {
    return res.status(400).json({ success: false, message: 'Invalid Bank Name selected. Please select from the suggestions list.' });
  }

  // Validate Account Number
  if (!/^\d{9,18}$/.test(accountClean)) {
    return res.status(400).json({ success: false, message: 'Account Number must contain between 9 and 18 numeric digits.' });
  }

  // Validate IFSC
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  if (!ifscRegex.test(ifscUpper)) {
    return res.status(400).json({ success: false, message: 'Invalid IFSC format. Must be 11 characters (e.g. SBIN0000456)' });
  }

  try {
    let [userRows] = await pool.query('SELECT supervisor_id, name, email, mobile FROM supervisor_users WHERE id = ?', [req.user.id]);
    let supervisorId = userRows[0]?.supervisor_id;

    const bankData = {
      bank_holder_name: holderUpper,
      bank_name: bankUpper,
      account_number: accountClean,
      ifsc_code: ifscUpper
    };

    if (supervisorId) {
      await pool.query('UPDATE supervisors SET ? WHERE id = ?', [bankData, supervisorId]);
    } else {
      // Create stub supervisor profile record
      const newSv = {
        name: userRows[0].name || 'Supervisor',
        email: userRows[0].email,
        mobile: userRows[0].mobile || null,
        status: 'Pending',
        ...bankData
      };
      const [result] = await pool.query('INSERT INTO supervisors SET ?', [newSv]);
      supervisorId = result.insertId;
      await pool.query('UPDATE supervisor_users SET supervisor_id = ? WHERE id = ?', [supervisorId, req.user.id]);
    }

    res.json({ success: true, message: 'Bank details saved successfully' });
  } catch (err) {
    console.error('[Save Bank Details Error]:', err.message);
    res.status(500).json({ success: false, message: 'Server error saving bank details' });
  }
});

module.exports = router;
