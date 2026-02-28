const { db } = require('./db');
const dbUtils = require('./dbUtils');

async function run() {
  try {
    const user = await dbUtils.findUserByUsername('admin');
    console.log('Found user:', user ? { id: user.id, username: user.username, role_id: user.role_id, is_active: user.is_active } : null);

    if (user) {
      const ok = dbUtils.verifyPassword('admin123', user.password_hash);
      console.log('Password verify for admin123:', ok);
    }

    // list sessions
    db.all('SELECT * FROM user_sessions', (err, rows) => {
      if (err) console.error('sessions err', err);
      else console.log('user_sessions:', rows);

      db.close(() => process.exit(0));
    });
  } catch (err) {
    console.error(err);
    db.close(() => process.exit(1));
  }
}

run();
