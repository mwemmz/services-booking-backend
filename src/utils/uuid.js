const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate that all specified url params are well-formed UUIDs. Returns a 400
 * (without touching the database) so garbage ids like /services/repair-plumbing
 * become a clean client error instead of a Postgres 22P02 500.
 *
 * Usage: router.param('id', uuidParam('id'));
 */
const uuidParam = (...names) => (req, res, next) => {
  for (const name of names) {
    const value = req.params[name];
    if (value !== undefined && !UUID_PATTERN.test(value)) {
      return res.status(400).json({ message: 'Invalid resource id format.' });
    }
  }
  next();
};

const isValidUuid = (value) => Boolean(value) && UUID_PATTERN.test(value);

module.exports = { isValidUuid, uuidParam };