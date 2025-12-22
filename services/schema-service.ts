import { surrealDB } from "@/lib/surrealdb-client";
import { TABLES } from "@/lib/schema";

export async function getDynamicMasterLibrary() {
  const db = await surrealDB.getClient();
  try {
    // Fetch all known relationship definitions
    const [result] = await db.query(`SELECT * FROM ${TABLES.RELATIONSHIP_DEF}`);
    return result || [];
  } catch (e) {
    console.warn("Could not fetch relationship library", e);
    return [];
  }
}

export async function learnNewRelationship(type: string, description: string) {
  const db = await surrealDB.getClient();
  try {
    // Check if exists first to avoid duplicates
    const [exists] = await db.query(
      `SELECT * FROM ${TABLES.RELATIONSHIP_DEF} WHERE type = $type`, 
      { type }
    );
    
    if (!exists[0]) {
      await db.create(TABLES.RELATIONSHIP_DEF, {
        type,
        description,
        learned_at: new Date().toISOString()
      });
      console.log(` Knowledge Graph learned new concept: ${type}`); 
    }
  } catch (e) {
    console.error("Failed to save new relationship", e);
  }
}