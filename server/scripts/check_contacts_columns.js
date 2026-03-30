const { Client } = require('pg');
(async () => {
  const c = new Client({ host: 'localhost', port: 5436, user: 'postgres', password: 'postgres', database: 'nina_db' });
  try {
    await c.connect();
    const res = await c.query("SELECT column_name, ordinal_position, data_type FROM information_schema.columns WHERE table_name='contacts' ORDER BY ordinal_position;");
    console.log(JSON.stringify(res.rows, null, 2));
    await c.end();
  } catch (e) {
    console.error(e);
    process.exit(2);
  }
})();
