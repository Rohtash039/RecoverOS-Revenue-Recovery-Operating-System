
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const fieldErrors = result.error.errors.map(err => ({
        field: err.path.join('.') || 'body',
        message: err.message
      }));

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body payload.',
          details: fieldErrors
        }
      });
    }

    req.body = result.data;
    next();
  };
}

