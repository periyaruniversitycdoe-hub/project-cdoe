function validateCentre(body, isUpdate = false) {
    const errors = [];

    if (!isUpdate && (!body.name || !body.name.trim())) errors.push('Centre name is required');
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) errors.push('Invalid email address');
    if (body.hod_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.hod_email)) errors.push('Invalid HOD email address');
    if (body.pincode && !/^\d{6}$/.test(body.pincode)) errors.push('Pincode must be 6 digits');
    if (body.recognition_date && isNaN(Date.parse(body.recognition_date))) errors.push('Invalid recognition date');
    if (body.contact_number && !/^\d{7,15}$/.test(body.contact_number.replace(/\s/g, ''))) errors.push('Invalid contact number');

    return errors;
}

module.exports = { validateCentre };
