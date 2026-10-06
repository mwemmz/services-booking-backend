const { User } = require('../models');

/**
 * Creates the admin account from ADMIN_EMAIL/ADMIN_PASSWORD when both are set,
 * and otherwise guarantees the demo admin exists so the dashboard is reachable.
 */
const bootstrapAdmin = async () => {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  try {
    if (email && password) {
      const [user, created] = await User.findOrCreate({
        where: { email },
        defaults: {
          name: 'ServiceHub Admin',
          email,
          password_hash: password,
          phone: '',
          role: 'admin',
          is_active: true,
          email_verified: true,
        },
      });
      if (!created && user.role !== 'admin') {
        await user.update({ role: 'admin' });
      }
      if (!user.email_verified) {
        await user.update({ email_verified: true });
      }
      console.log(`[admin] Admin account ready: ${email}`);
      return;
    }
    const existingAdmin = await User.findOne({ where: { role: 'admin' } });
    if (existingAdmin) return;
    const [user, created] = await User.findOrCreate({
      where: { email: 'admin@test.com' },
      defaults: {
        name: 'ServiceHub Admin',
        email: 'admin@test.com',
        password_hash: 'admin123',
        phone: '',
        role: 'admin',
        is_active: true,
        email_verified: true,
      },
    });
    if (!created && user.role !== 'admin') {
      await user.update({ role: 'admin' });
    }
    if (!user.email_verified) {
      await user.update({ email_verified: true });
    }
    console.log('[admin] Demo admin account ready: admin@test.com');
  } catch (err) {
    console.error('[admin] Bootstrap failed:', err.message);
  }
};

module.exports = { bootstrapAdmin };
