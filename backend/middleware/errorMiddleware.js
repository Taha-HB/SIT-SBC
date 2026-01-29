const errorMiddleware = (err, req, res, next) => {
  console.error('Error:', err);
  
  let error = { ...err };
  error.message = err.message;
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error.statusCode = 400;
    error.message = `Validation Error: ${message}`;
  }
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error.statusCode = 400;
    error.message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
  }
  
  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    error.statusCode = 400;
    error.message = 'Invalid resource ID format';
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error.statusCode = 401;
    error.message = 'Invalid authentication token';
  }
  
  if (err.name === 'TokenExpiredError') {
    error.statusCode = 401;
    error.message = 'Authentication token expired';
  }
  
  // Default error
  error.statusCode = error.statusCode || 500;
  error.status = error.status || 'error';
  
  res.status(error.statusCode).json({
    status: error.status,
    message: error.message || 'Internal server error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = errorMiddleware;
