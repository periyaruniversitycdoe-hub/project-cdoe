export const errorHandler = (err, req, res, next) => {
  console.error('🔥 Global Error Handler:', err);

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    success: false,
    message: status === 500 ? 'Failed to send email' : message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
