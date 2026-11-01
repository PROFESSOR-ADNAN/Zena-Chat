export const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Route not found: ${req.originalUrl}`));
};

export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  let message = err.message;
  let title = 'An error occurred';

  if (err.name === 'ValidationError') {
    statusCode = 400;
    title = 'Validation Error';
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  } else if (err.name === 'CastError') {
    statusCode = 400;
    title = 'Invalid Identifier';
    message = `Invalid ${err.path}: ${err.value}`;
  } else if (err.code === 11000) {
    statusCode = 409;
    title = 'Conflict';
    message = `Duplicate value for ${Object.keys(err.keyValue).join(', ')}`;
  } else if (statusCode === 401) {
    title = 'Unauthorized';
  } else if (statusCode === 403) {
    title = 'Forbidden';
  } else if (statusCode === 404) {
    title = 'Not Found';
  }

  res.status(statusCode);

  if (req?.headers?.accept?.includes('application/problem+json') && res.setHeader) {
    res.setHeader('Content-Type', 'application/problem+json');
  }

  res.json({
    type: 'about:blank',
    title,
    status: statusCode,
    detail: message,
    message, // Preserved for backwards compatibility with existing clients and tests
    instance: req?.originalUrl || undefined,
    requestId: req?.headers ? req.headers['x-request-id'] : undefined,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};
