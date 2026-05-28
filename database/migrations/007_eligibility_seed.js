/**
 * 007_eligibility_seed.js
 * Idempotent seed: inserts all departments, programmes, and PG eligibility
 * mappings extracted from the BOS Eligibility List PDF.
 * Run: node database/migrations/007_eligibility_seed.js
 * Safe to re-run — uses INSERT IGNORE to skip duplicates.
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');

// ── Eligibility data sourced from BOS PDF ─────────────────────────────────────
const ELIGIBILITY_DATA = [
  {
    department: 'Biochemistry',
    programs: [
      {
        name: 'Ph.D. Biochemistry',
        pg: [
          'Biochemistry', 'Animal Science', 'Animal Biotechnology', 'Zoology',
          'Bioinformatics', 'Biotechnology', 'Botany', 'Plant Science',
          'Genetic Engineering', 'Molecular Biology', 'Life Sciences',
          'Nanoscience', 'Nanotechnology', 'Clinical laboratory technology', 'Toxicology'
        ],
        mphil: []
      }
    ]
  },
  {
    department: 'Biotechnology',
    programs: [
      {
        name: 'Ph.D. Biotechnology',
        pg: [
          'Agriculture', 'Animal Science', 'Animal Biotechnology', 'Zoology',
          'Biochemistry', 'Bioinformatics', 'Biomedical Genetics', 'Biomedical Science',
          'Biotechnology', 'Botany', 'Plant Science', 'Environmental Science',
          'Environmental Biotechnology', 'Food Science', 'Food Technology',
          'Genetic Engineering', 'Molecular Biology', 'Industrial Biotechnology',
          'Life Sciences', 'Nanoscience', 'Nanotechnology', 'Marine Biotechnology',
          'Medical Biotechnology', 'Microbiology', 'Medical Microbiology', 'Toxicology'
        ],
        mphil: []
      }
    ]
  },
  {
    department: 'Botany',
    programs: [
      {
        name: 'Ph.D. Botany',
        pg: ['Botany', 'Plant Science', 'Life Sciences'],
        mphil: []
      }
    ]
  },
  {
    department: 'Chemistry',
    programs: [
      {
        name: 'Ph.D. Chemistry',
        pg: [
          'Chemistry', 'Organic Chemistry', 'Inorganic Chemistry',
          'Physical Chemistry', 'Analytical Chemistry', 'Polymer Chemistry',
          'Industrial Chemistry'
        ],
        mphil: []
      }
    ]
  },
  {
    department: 'Nutrition and Dietetics',
    programs: [
      {
        name: 'Ph.D. Clinical Nutrition and Dietetics',
        pg: [
          'Clinical Nutrition and Dietetics', 'Clinical Nutrition',
          'Nutrition and Dietetics', 'Food Science and Nutrition',
          'Food and Nutrition', 'Food, Nutrition and Dietetics',
          'Food Service Management and Dietetics',
          'Nutrition, Food Service Management and Dietetics',
          'Human Nutrition and Nutraceuticals', 'Dietetics and Food Management',
          'Home Science with Food Science and Nutrition',
          'Home Science Food Service Management & Dietetics'
        ],
        mphil: []
      }
    ]
  },
  {
    department: 'Commerce',
    programs: [
      {
        name: 'Ph.D. Commerce',
        pg: [
          'General', 'Computer Application', 'Business Intelligence',
          'Financial Management', 'International Business',
          'Accounting and Finance', 'Bank Management',
          'Finance and Computer Management', 'Cooperation',
          'Corporate Secretaryship', 'Marketing Management',
          'Banking and Insurance', 'Corporate Secretaryship Computer Applications'
        ],
        mphil: []
      }
    ]
  },
  {
    department: 'Computer Science',
    programs: [
      {
        name: 'Ph.D. Computer Science',
        pg: [
          'Computer Science', 'Computer Applications', 'Software Science',
          'Computer Communication', 'Information Technology',
          'Software Engineering', 'Theoretical Computer Science',
          'Computer Technology', 'Information Science and Management',
          'Information Technology and Management', 'Data Analytics',
          'Data Science', 'Cyber Security', 'Computer Science and Engineering',
          'Artificial Intelligence and Machine Learning'
        ],
        mphil: []
      }
    ]
  },
  {
    department: 'Economics',
    programs: [
      {
        name: 'Ph.D. Economics',
        pg: [
          'Economics', 'Mathematical Economics', 'Business Economics',
          'Econometrics', 'Applied Economics'
        ],
        mphil: []
      }
    ]
  },
  {
    department: 'Education',
    programs: [
      {
        name: 'Ph.D. Education',
        pg: ['M.Ed'],
        mphil: []
      }
    ]
  },
  {
    department: 'Energy Science and Energy Technology',
    programs: [
      {
        name: 'Ph.D. Energy Science',
        pg: [
          'Energy Science', 'Physics', 'Nanoscience',
          'Material Science', 'Chemistry'
        ],
        mphil: []
      },
      {
        name: 'Ph.D. Energy Technology',
        pg: [
          'Energy Technology', 'Environmental Engineering', 'Thermal Engineering',
          'Manufacturing Engineering', 'Engineering Design',
          'CAD (Computer aided design)', 'Embedded Systems',
          'Process Control & Instrumentation', 'Energy Engineering',
          'Green Energy Technology', 'Communication Systems'
        ],
        mphil: []
      },
      {
        name: 'Ph.D. Physics Interdisciplinary with Energy Science',
        pg: ['Physics'],
        mphil: []
      }
    ]
  },
  {
    department: 'English',
    programs: [
      {
        name: 'Ph.D. English',
        pg: ['English'],
        mphil: []
      }
    ]
  },
  {
    department: 'Environmental Science',
    programs: [
      {
        name: 'Ph.D. Environmental Science',
        pg: [
          'Environmental Science', 'Environmental Biotechnology', 'Botany',
          'Plant Science', 'Zoology', 'Microbiology', 'Biotechnology',
          'Wildlife Biology', 'Agriculture Science', 'Horticulture',
          'Chemistry', 'Geology', 'Geography'
        ],
        mphil: []
      }
    ]
  },
  {
    department: 'Food Science Technology and Nutrition',
    programs: [
      {
        name: 'Ph.D. Food Science Technology and Nutrition',
        pg: [
          'Nutrition and Dietetics', 'Food Science and Nutrition',
          'Food and Nutrition', 'Food Technology',
          'Nutrition Food Service Management and Dietetics',
          'Food Processing', 'Clinical Nutrition and Dietetics',
          'Food Process Engineering'
        ],
        mphil: []
      }
    ]
  },
  {
    department: 'Geology',
    programs: [
      {
        name: 'Ph.D. Geology',
        pg: [
          'Geology', 'Applied Geology', 'Earth Sciences',
          'Geosciences', 'Marine Geology'
        ],
        mphil: []
      }
    ]
  },
  {
    department: 'History',
    programs: [
      {
        name: 'Ph.D. History',
        pg: ['History'],
        mphil: []
      }
    ]
  },
  {
    department: 'Journalism and Mass Communication',
    programs: [
      {
        name: 'Ph.D. Journalism and Mass Communication',
        pg: [
          'Journalism and Mass communication', 'Journalism / Communication',
          'Mass Communication', 'Electronic Media',
          'Visual Communication', 'Media & Communication'
        ],
        mphil: []
      }
    ]
  },
  {
    department: 'Library and Information Science',
    programs: [
      {
        name: 'Ph.D. Library and Information Science',
        pg: ['Library and Information Science'],
        mphil: []
      }
    ]
  },
  {
    department: 'Management',
    programs: [
      {
        name: 'Ph.D. Management',
        pg: ['Management'],
        mphil: []
      }
    ]
  },
  {
    department: 'Mathematics',
    programs: [
      {
        name: 'Ph.D. Mathematics',
        pg: ['Mathematics', 'Mathematics with CA'],
        mphil: []
      }
    ]
  },
  {
    department: 'Microbiology',
    programs: [
      {
        name: 'Ph.D. Microbiology',
        pg: [
          'Microbiology', 'Biotechnology', 'Applied Microbiology',
          'Industrial Microbiology', 'Botany', 'Plant Sciences',
          'Zoology', 'Animal Science', 'Biochemistry', 'Bioinformatics',
          'Biology', 'Life Sciences', 'Home Science',
          'Food Science & Nutrition', 'Genomics',
          'Bio-medical Science', 'Microbial Gene Technology'
        ],
        mphil: []
      }
    ]
  },
  {
    department: 'Physics',
    programs: [
      {
        name: 'Ph.D. Physics',
        pg: ['Physics', 'Biophysics'],
        mphil: []
      }
    ]
  },
  {
    department: 'Psychology',
    programs: [
      {
        name: 'Ph.D. Psychology',
        pg: [
          'Psychology', 'Applied Psychology', 'Counselling Psychology',
          'Clinical Psychology', 'Para Psychology', 'Organizational Psychology',
          'Forensic Psychology', 'Human Resources Development Psychology',
          'Cyber and Crime Psychology', 'Sports Psychology',
          'Rehabilitation Psychology', 'Human Development', 'Child Psychology',
          'Cognitive Psychology', 'Psychological Counselling',
          'Counselling & Psychotherapy', 'Neuro Psychology',
          'Industrial Psychology', 'Psychotherapy',
          'Positive Psychology', 'Health Psychology'
        ],
        mphil: []
      }
    ]
  },
  {
    department: 'Sociology',
    programs: [
      {
        name: 'Ph.D. Sociology',
        pg: [
          'Sociology', 'Rural Sociology', 'Medical Sociology',
          'Social System', 'Urban Studies'
        ],
        mphil: []
      }
    ]
  },
  {
    department: 'Statistics',
    programs: [
      {
        name: 'Ph.D. Statistics',
        pg: ['Statistics', 'Bio-Statistics'],
        mphil: []
      }
    ]
  },
  {
    department: 'Tamil',
    programs: [
      {
        name: 'Ph.D. Tamil',
        pg: ['Tamil'],
        mphil: []
      }
    ]
  },
  {
    department: 'Textiles and Apparel Design',
    programs: [
      {
        name: 'Ph.D. Textiles and Apparel Design',
        pg: [
          'Textiles and Apparel Design', 'Costume Design and Fashion',
          'Textile and Fashion Designing', 'Textiles and Clothing',
          'Textile and Fashion Apparel', 'Fashion Technology and Costume Designing',
          'Fashion and Apparel Design', 'Textile Science and Fashion Technology',
          'Fashion Designing', 'Bio Textiles'
        ],
        mphil: []
      }
    ]
  },
  {
    department: 'Zoology',
    programs: [
      {
        name: 'Ph.D. Zoology',
        pg: [
          'Zoology', 'Animal Science', 'Animal Biotechnology',
          'Environmental Science', 'Wild Life Biology', 'Bio Medical Science',
          'Biochemistry', 'Biotechnology', 'Medical Pharmacology',
          'Veterinary Science'
        ],
        mphil: []
      }
    ]
  },
  {
    department: 'Sericulture',
    programs: [
      {
        name: 'Ph.D. Sericulture',
        pg: ['Zoology', 'Botany', 'Life Sciences', 'Sericulture', 'Biotechnology'],
        mphil: []
      }
    ]
  },
  {
    department: 'Political Science',
    programs: [
      {
        name: 'Ph.D. Political Science',
        pg: ['Political Science', 'Public Administration'],
        mphil: []
      }
    ]
  }
];

async function seed() {
  const pool = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'phd_erp',
    charset:  'utf8mb4',
    waitForConnections: true,
    connectionLimit: 5,
  });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let deptInserted = 0, progInserted = 0, pgInserted = 0, mphilInserted = 0;

    for (const entry of ELIGIBILITY_DATA) {
      // Upsert department
      await conn.query(
        `INSERT INTO departments (name) VALUES (?)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [entry.department]
      );
      const [[deptRow]] = await conn.query(
        `SELECT id FROM departments WHERE name = ? LIMIT 1`,
        [entry.department]
      );
      const deptId = deptRow.id;
      deptInserted++;

      for (const prog of entry.programs) {
        // Upsert program
        await conn.query(
          `INSERT INTO programs_offered (department_id, name) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name)`,
          [deptId, prog.name]
        );
        const [[progRow]] = await conn.query(
          `SELECT id FROM programs_offered WHERE department_id = ? AND name = ? LIMIT 1`,
          [deptId, prog.name]
        );
        const progId = progRow.id;
        progInserted++;

        // Insert PG eligibility
        for (const course of prog.pg) {
          const [r] = await conn.query(
            `INSERT IGNORE INTO program_pg_eligibility (program_id, course_name) VALUES (?, ?)`,
            [progId, course]
          );
          if (r.affectedRows > 0) pgInserted++;
        }

        // Insert M.Phil eligibility
        for (const course of prog.mphil) {
          const [r] = await conn.query(
            `INSERT IGNORE INTO program_mphil_eligibility (program_id, course_name) VALUES (?, ?)`,
            [progId, course]
          );
          if (r.affectedRows > 0) mphilInserted++;
        }
      }
    }

    await conn.commit();
    console.log(`✅ Seed complete:`);
    console.log(`   Departments  : ${deptInserted}`);
    console.log(`   Programmes   : ${progInserted}`);
    console.log(`   PG mappings  : ${pgInserted}`);
    console.log(`   MPhil mappings: ${mphilInserted}`);
  } catch (err) {
    await conn.rollback();
    console.error('❌ Seed failed — rolled back:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

seed();
