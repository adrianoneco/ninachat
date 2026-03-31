const { Client } = require('pg');
(async () => {
  const c = new Client({ host: 'localhost', port: 5436, user: 'postgres', password: 'postgres', database: 'nina_db' });
  try {
    await c.connect();
    
    // Make contact_id nullable in conversations table
    console.log('Making contact_id nullable...');
    await c.query(`
      ALTER TABLE conversations 
      ALTER COLUMN contact_id DROP NOT NULL;
    `);
    console.log('Done!');
    
    await c.end();
  } catch (e) {
    console.error(e);
    process.exit(2);
  }
})();