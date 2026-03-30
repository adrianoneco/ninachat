const { Client } = require('pg');
(async () => {
  const c = new Client({ host: 'localhost', port: 5436, user: 'postgres', password: 'postgres', database: 'nina_db' });
  try {
    await c.connect();
    const res = await c.query(`
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'contacts'::regclass
        AND contype = 'u'
      ORDER BY conname;
    `);
    console.log(JSON.stringify(res.rows, null, 2));
    await c.end();
  } catch (e) {
    console.error(e);
    process.exit(2);
  }
})();
