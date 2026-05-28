export const validateMailPayload = (payload) => {
  const { to, subject, message } = payload;
  const errors = [];

  // Recipient Validation
  if (!to) {
    errors.push({ field: 'to', message: 'Recipient email is required' });
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      errors.push({ field: 'to', message: 'Invalid email format' });
    }
  }

  // Subject Validation
  if (!subject) {
    errors.push({ field: 'subject', message: 'Subject is required' });
  } else if (subject.length < 3) {
    errors.push({ field: 'subject', message: 'Subject must be at least 3 characters' });
  } else if (subject.length > 100) {
    errors.push({ field: 'subject', message: 'Subject must not exceed 100 characters' });
  }

  // Message Validation
  if (!message) {
    errors.push({ field: 'message', message: 'Message is required' });
  } else if (message.length < 5) {
    errors.push({ field: 'message', message: 'Message must be at least 5 characters' });
  } else if (message.length > 2000) {
    errors.push({ field: 'message', message: 'Message must not exceed 2000 characters' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
