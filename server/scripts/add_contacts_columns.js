const { Client } = require('pg');
(async () => {
  const c = new Client({ host: 'localhost', port: 5436, user: 'postgres', password: 'postgres', database: 'nina_db' });
  try {
    await c.connect();
    const res = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='contacts';");
    const cols = res.rows.map(r=>r.column_name);
    if (!cols.includes('picture_url')) {
      console.log('Adding column picture_url');
      await c.query("ALTER TABLE contacts ADD COLUMN picture_url text;");
    } else console.log('picture_url already exists');
    if (!cols.includes('lid')) {
      console.log('Adding column lid');
      await c.query("ALTER TABLE contacts ADD COLUMN lid text;");
    } else console.log('lid already exists');
      if (!cols.includes('whatsapp_id')) {
        console.log('Adding column whatsapp_id');
        await c.query("ALTER TABLE contacts ADD COLUMN whatsapp_id varchar(25);");
        try {
          await c.query("ALTER TABLE contacts ADD CONSTRAINT uq_contacts_whatsapp_id UNIQUE (whatsapp_id);");
        } catch (e) {
          /* ignore if already exists */
        }
      } else console.log('whatsapp_id already exists');
      if (!cols.includes('whastsapp_serialized')) {
        console.log('Adding column whastsapp_serialized');
        await c.query("ALTER TABLE contacts ADD COLUMN whastsapp_serialized varchar(25);");
        try {
          await c.query("ALTER TABLE contacts ADD CONSTRAINT uq_contacts_whastsapp_serialized UNIQUE (whastsapp_serialized);");
        } catch (e) {
          /* ignore if already exists */
        }
      } else console.log('whastsapp_serialized already exists');
    console.log('Done');
    await c.end();
  } catch (e) {
    console.error(e);
    process.exit(2);
  }
})();
