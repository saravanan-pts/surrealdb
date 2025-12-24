import { surrealDB } from "@/lib/surrealdb-client";
import { TABLES } from "@/lib/schema";
import type { Entity, Relationship, Document } from "@/types";

export class GraphOperations {
  private get db() {
    return surrealDB.getClient();
  }

  // --- Entity Operations ---
  async createEntity(entity: Omit<Entity, "id" | "createdAt" | "updatedAt">): Promise<Entity> {
    try {
      const now = new Date().toISOString();
      const query = `CREATE ${TABLES.ENTITY} CONTENT { 
        type: $type, label: $label, properties: $properties, 
        metadata: $metadata, createdAt: type::datetime($createdAt), updatedAt: type::datetime($updatedAt) 
      }`;
      const result = await this.db.query(query, {
        type: entity.type, label: entity.label, properties: entity.properties || {}, 
        metadata: entity.metadata || {}, createdAt: now, updatedAt: now,
      });
      // @ts-ignore
      const record = result[0]?.result?.[0];
      if (!record) throw new Error("Failed to create entity");
      return this.mapRecordToEntity(record);
    } catch (error: any) { throw error; }
  }

  async updateEntity(id: string, updates: any): Promise<Entity> {
    const result = await this.db.merge(id, updates);
    return this.mapRecordToEntity(result);
  }

  async deleteEntity(id: string): Promise<void> {
    try { await this.db.query(`DELETE FROM ${TABLES.RELATIONSHIP} WHERE from = $id OR to = $id`, { id }); } catch (e) {}
    await this.db.delete(id);
  }

  // STANDARD FETCH: Only look in 'entity' table
  async getAllEntities(): Promise<Entity[]> {
    try {
      const result = await this.db.query(`SELECT * FROM ${TABLES.ENTITY}`);
      // @ts-ignore
      const records = result[0]?.result || [];
      return Array.isArray(records) ? records.map((r: any) => this.mapRecordToEntity(r)) : [];
    } catch (e) { return []; }
  }

  // DYNAMIC SCANNER: Finds all 24+ Relationship Tables
  async getAllRelationships(documentId?: string): Promise<Relationship[]> {
    try {
      // 1. Get all table names
      const info = await this.db.query('INFO FOR DB');
      
      // @ts-ignore
      const tablesObject = info[0]?.result?.tables || {}; 
      const allTableNames = Object.keys(tablesObject);

      // 2. Filter for edge tables (Exclude known nodes/system)
      const exclude = ["entity", "document", "relationship_def", "data_source_config", "user", "session"];
      const edgeTables = allTableNames.filter(t => !exclude.includes(t));
      
      if (edgeTables.length === 0) return [];
      
      // 3. Query all of them
      console.log(`Scanning ${edgeTables.length} relationship tables...`);
      let query = `SELECT * FROM ${edgeTables.join(', ')}`;
      
      if (documentId) query += ` WHERE source = $documentId`;
      
      const result = await this.db.query(query, { documentId });
      // @ts-ignore
      const records = result[0]?.result || [];
      
      // 4. Validate edges
      const validEdges = records.filter((r: any) => (r.in && r.out) || (r.from && r.to));
      return validEdges.map((r: any) => this.mapRecordToRelationship(r));
    } catch (e) { 
        console.error("Error fetching dynamic relationships:", e);
        return []; 
    }
  }

  // --- Helpers ---
  private mapRecordToEntity(r: any): Entity {
    return { 
      id: r.id, type: r.type || "Unknown", label: r.label || r.id, 
      properties: r.properties || r, metadata: r.metadata || {}, 
      createdAt: r.createdAt, updatedAt: r.updatedAt 
    };
  }

  private mapRecordToRelationship(r: any): Relationship {
    return { 
      id: r.id, 
      from: r.from || r.in, 
      to: r.to || r.out, 
      // Extract type from table name
      type: r.id ? r.id.split(':')[0] : "Edge", 
      properties: r.properties || {}, 
      confidence: r.confidence, 
      source: r.source, 
      createdAt: r.createdAt 
    };
  }

  private mapRecordToDocument(r: any): Document { return { id: r.id, filename: r.filename, content: r.content, fileType: r.fileType, uploadedAt: r.uploadedAt, processedAt: r.processedAt, entityCount: r.entityCount, relationshipCount: r.relationshipCount }; }
  
  async getEntitiesByDocument(id: string) { const r = await this.db.query(`SELECT * FROM ${TABLES.ENTITY} WHERE metadata.source = $id`, { id }); return r[0]?.result?.map(this.mapRecordToEntity) || []; }
  async createDocument(d: any) { const r = await this.db.create(TABLES.DOCUMENT, d); return this.mapRecordToDocument(r[0]); }
  async updateDocument(id: string, u: any) { const r = await this.db.merge(id, u); return this.mapRecordToDocument(r); }
  async deleteDocument(id: string) { await this.db.delete(id); }
  async clearAllData() { await this.db.query('DELETE FROM entity; DELETE FROM relationship; DELETE FROM document;'); return { entitiesDeleted:0, relationshipsDeleted:0, documentsDeleted:0 }; }
  async getNeighbors(id: string) { return { entities:[], relationships:[] }; }
  async getSubgraph(ids: string[]) { return { entities:[], relationships:[] }; }
  async searchEntities(q: string) { return []; }
  async createRelationship(f, t, type, p={}, c=1, s="man") { return {} as any; }
  async updateRelationship(id, u) { return {} as any; }
  async deleteRelationship(id) {}
  async getEntity(id) { return null; }
  async getRelationship(id) { return null; }
  async getAllDocuments() { return []; }
}

export const graphOps = new GraphOperations();