/**
 * Attributes safe to return inside nested includes. Sequelize serialises
 * included models to plain objects, which bypasses User#toJSON, so secrets must
 * be excluded at query time or they leak in booking, review and crew responses.
 */
const safeUserAttributes = {
  exclude: ['password_hash', 'fcm_token', 'reset_token', 'reset_token_expires', 'email_verify_token'],
};

module.exports = { safeUserAttributes };
