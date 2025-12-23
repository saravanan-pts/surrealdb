const { Surreal } = require('surrealdb.js');
require('dotenv').config({ path: '.env.local' });

async function resetSchema() {
  const db = new Surreal();
  
  try {
    console.log(' Connecting to SurrealDB...'); 
    await db.connect(process.env.NEXT_PUBLIC_SURREALDB_URL);
    await db.authenticate(process.env.NEXT_PUBLIC_SURREALDB_TOKEN);
    
    await db.use({ 
      ns: process.env.NEXT_PUBLIC_SURREALDB_NAMESPACE, 
      db: process.env.NEXT_PUBLIC_SURREALDB_DATABASE 
    });

    console.log(' Dropping old strict tables...'); 
    // Drop tables to remove SCHEMAFULL constraints
    await db.query('REMOVE TABLE entity');
    await db.query('REMOVE TABLE relationship');
    await db.query('REMOVE TABLE document');

    console.log('  Recreating tables as SCHEMALESS (Flexible)...'); 
    
    // Recreate as SCHEMALESS so they accept your data
    // PERMISSIONS FULL ensures your frontend can see them
    await db.query(`
      DEFINE TABLE entity SCHEMALESS PERMISSIONS FULL;
      DEFINE FIELD type ON entity TYPE string;
      DEFINE FIELD label ON entity TYPE string;
      DEFINE INDEX idx_label ON entity FIELDS label;

      DEFINE TABLE relationship SCHEMALESS PERMISSIONS FULL;
      DEFINE INDEX idx_from ON relationship FIELDS from;
      DEFINE INDEX idx_to ON relationship FIELDS to;

      DEFINE TABLE document SCHEMALESS PERMISSIONS FULL;
    `);

    console.log(' Schema Reset Complete.'); 
    console.log(' Your database is now unlocked and ready for data.'); 

  } catch (error) {
    console.error(' Error:', error); 
  } finally {
    await db.close();
  }
}

resetSchema();