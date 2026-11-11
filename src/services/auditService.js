const { AuditLog } = require('../models');

/** Records an event. Never throws: auditing must not break the action itself. */
const audit = async (req, action, { actor, targetType, targetId, detail } = {}) => {
  try {
    const who = actor || req?.user || null;
    await AuditLog.create({
      actor_id: who?.id || null,
      actor_name: who?.name || null,
      action,
      target_type: targetType || null,
      target_id: targetId ? String(targetId) : null,
      detail: detail ? String(detail).slice(0, 500) : null,
      ip: req?.ip || null,
    });
  } catch (error) {
    console.error('[audit] failed:', error.message);
  }
};

module.exports = { audit };
