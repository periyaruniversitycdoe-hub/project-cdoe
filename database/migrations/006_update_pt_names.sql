-- Migration: Update Part-Time Categories, Reference Codes, and Hints to match official guidelines order
USE rsm_db;

-- 1. College Teacher (2.2.2.1)
UPDATE part_time_categories 
SET category_name = 'College Teacher', 
    category_hint = 'A faculty member working in a University Department or in an affiliated college of this University or any institution located within the Periyar University jurisdiction affiliated to any technical institution/university.',
    category_reference_code = '2.2.2.1'
WHERE category_name = 'Teaching → College' OR category_reference_code = '2.2.2.1';

-- 2. School Teacher (2.2.2.2)
UPDATE part_time_categories 
SET category_name = 'School Teacher', 
    category_hint = 'A teacher working in a Higher Secondary School or High School located within Tamil Nadu with a minimum two years of continuous service.',
    category_reference_code = '2.2.2.2'
WHERE category_name = 'High School/Higher Secondary School' OR category_reference_code = '2.2.2.2';

-- 3. Non Teacher (2.2.2.3)
UPDATE part_time_categories 
SET category_name = 'Non Teacher', 
    category_hint = 'A candidate (other than a teacher) in a regular job, within Tamil Nadu with a minimum two years of continuous service after the qualifying degree.',
    category_reference_code = '2.2.2.3'
WHERE category_name = 'Non Teaching' OR category_reference_code = '2.2.2.3';

-- 4. Research assistant (2.2.2.4)
UPDATE part_time_categories 
SET category_name = 'Research assistant', 
    category_hint = 'Research assistant, Technical assistant and non-teaching staff working in the Periyar University office/departments with a minimum two years of continuous service.',
    category_reference_code = '2.2.2.4'
WHERE category_name = 'Others' OR category_reference_code = '2.2.2.4';

-- 5. polytechnics Teacher (2.2.2.5)
UPDATE part_time_categories 
SET category_name = 'polytechnics Teacher', 
    category_hint = 'Any teacher possessing the minimum qualifications prescribed by the UGC and working as a teacher in polytechnics (only teachers of Arts, Science, and allied multidisciplinary subjects) within Tamil Nadu, which are recognized or approved by the Government, shall be permitted to register as a Part-Time scholar to pursue research under a recognized supervisor in a University Department or an affiliated college or a Research Centre approved by the University.',
    category_reference_code = '2.2.2.5'
WHERE category_name = 'Polytechnic Teacher' OR category_reference_code = '2.2.2.5';
