/**
 * Generic request body validation middleware using Zod schemas.
 * Returns structured 400 Bad Request with field-level error messages on validation failure.
 */
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

    // Replace req.body with parsed/sanitized data (including defaults)
    req.body = result.data;
    next();
  };
}
