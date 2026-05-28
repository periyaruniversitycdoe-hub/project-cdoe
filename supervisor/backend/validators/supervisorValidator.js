function validateSupervisor(body, isUpdate = false) {
    const errors = [];

    if (!isUpdate && (!body.name || !body.name.trim())) errors.push('Supervisor name is required');
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) errors.push('Invalid email address');
    if (body.mobile && !/^\d{10,15}$/.test(body.mobile.replace(/\s/g, ''))) errors.push('Mobile must be 10-15 digits');
    if (body.aadhaar_no && !/^\d{12}$/.test(body.aadhaar_no)) errors.push('Aadhaar must be 12 digits');
    if (body.pincode && !/^\d{6}$/.test(body.pincode)) errors.push('Pincode must be 6 digits');
    if (body.dob && isNaN(Date.parse(body.dob))) errors.push('Invalid date of birth');
    if (body.date_of_joining && isNaN(Date.parse(body.date_of_joining))) errors.push('Invalid date of joining');
    if (body.date_of_superannuation && isNaN(Date.parse(body.date_of_superannuation))) errors.push('Invalid date of superannuation');
    if (body.gender && !['Male', 'Female', 'Other'].includes(body.gender)) errors.push('Invalid gender');

    const intFields = ['max_candidates', 'current_vacancy', 'max_part_time', 'max_full_time'];
    for (const f of intFields) {
        if (body[f] !== undefined && body[f] !== '') {
            const n = parseInt(body[f]);
            if (isNaN(n) || n < 0) errors.push(`${f.replace(/_/g, ' ')} must be a non-negative integer`);
        }
    }

    return errors;
}

module.exports = { validateSupervisor };
