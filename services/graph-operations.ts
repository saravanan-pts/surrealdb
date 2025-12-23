import { surrealDB } from "@/lib/surrealdb-client";
import { TABLES } from "@/lib/schema";
import type { Entity, Relationship, Document } from "@/types";

export class GraphOperations {
  // --------------------------------------------------------------------------------
  // Entity Operations
  // --------------------------------------------------------------------------------
  
  async createEntity(entity: Omit<Entity, "id" | "createdAt" | "updatedAt">): Promise<Entity> {
    try {
      const db = surrealDB.getClient();
      const now = new Date().toISOString();
      
      const query = `
        CREATE ${TABLES.ENTITY} CONTENT {
          type: $type,
          label: $label,
          properties: $properties,
          metadata: $metadata,
          createdAt: type::datetime($createdAt),
          updatedAt: type::datetime($updatedAt)
        }
      `;
      
      const result = await db.query(query, {
        type: entity.type,
        label: entity.label,
        properties: entity.properties || {},
        metadata: entity.metadata || {},
        createdAt: now,
        updatedAt: now,
      });
      
      const records = Array.isArray(result) && result[0] && 'result' in result[0] 
        ? (result[0].result as any[])
        : [];
      const record = records[0];
      if (!record) throw new Error("Failed to create entity record");

      return this.mapRecordToEntity(record);
    } catch (error: any) {
      if (error?.message?.includes("permissions") || error?.message?.includes("IAM error")) {
        throw new Error("Insufficient permissions to create entities. Please check your JWT token permissions.");
      }
      throw error;
    }
  }

  async updateEntity(id: string, updates: Partial<Omit<Entity, "id" | "createdAt">>): Promise<Entity> {
    try {
      const db = surrealDB.getClient();
      const updateFields: string[] = [];
      const params: any = { id };

      Object.keys(updates).forEach(key => {
        if (key !== 'createdAt' && key !== 'updatedAt' && updates[key as keyof typeof updates] !== undefined) {
          updateFields.push(`${key}: $${key}`);
          params[key] = updates[key as keyof typeof updates];
        }
      });

      updateFields.push('updatedAt: type::datetime()');

      const query = `
        UPDATE $id CONTENT {
          ${updateFields.join(',\n          ')}
        }
      `;

      const result = await db.query(query, params);
      const records = Array.isArray(result) && result[0] && 'result' in result[0] 
        ? (result[0].result as any[])
        : [];
      const record = records[0];
      
      if (!record) throw new Error("Failed to update entity record");

      return this.mapRecordToEntity(record);
    } catch (error: any) {
      if (error?.message?.includes("permissions")) {
        throw new Error("Insufficient permissions to update entities.");
      }
      throw error;
    }
  }

  async deleteEntity(id: string): Promise<void> {
    const db = surrealDB.getClient();
    // Clean up connections first (best effort for production cleanup)
    try {
        // Note: In production with dynamic tables, cascading delete is harder.
        // We attempt to clear from the default table.
        await db.query(`DELETE FROM ${TABLES.RELATIONSHIP} WHERE from = $id OR to = $id`, { id });
    } catch (e) { 
        console.warn("Relationship cleanup warning:", e); 
    }
    
    await db.delete(id);
  }

  async getEntity(id: string): Promise<Entity | null> {
    const db = surrealDB.getClient();
    const record = await db.select(id);
    if (!record) return null;
    return this.mapRecordToEntity(record);
  }

  // --------------------------------------------------------------------------------
  // PRODUCTION: Dynamic Entity Fetching
  // Scans for ALL node-like tables to ensure we see the full database state
  // --------------------------------------------------------------------------------
  async getAllEntities(): Promise<Entity[]> {
    try {
      const db = surrealDB.getClient();
      
      // 1. Discover tables
      const infoResult = await db.query('INFO FOR DB');
      // @ts-ignore
      const tablesObject = infoResult[0]?.result?.tables || {};
      const allTableNames = Object.keys(tablesObject);

      // 2. Filter for Node tables
      const knownEdgeTables = [
        "ASSOCIATED_WITH_BRANCH", "BELONGS_TO_CUSTOMER", "CLOSED_ON", 
        "HAS_ACCOUNT_NUMBER", "HAS_ACCOUNT_TYPE", "HAS_AMOUNT", 
        "HAS_BALANCE", "HAS_DATE", "HAS_EVENT", "HAS_PRODUCT",
        "HAS_STATUS", "HAS_TRANSACTION", "HAS_TYPE", "OWNED_BY",
        "relationship", "HELD_AT", "LOCATED_AT", "OCCURRED_ON", "OPENED_AT", "IS_PRODUCT_TYPE", "IS_TYPE"
      ];
      const systemTables = [
        "document", "relationship_def", "data_source_config", "user", "session"
      ];

      const nodeTables = allTableNames.filter(t => 
        !knownEdgeTables.includes(t) && !systemTables.includes(t)
      );

      if (!nodeTables.includes(TABLES.ENTITY)) {
        nodeTables.push(TABLES.ENTITY);
      }

      console.log("Production: Scanning tables for nodes:", nodeTables);

      // 3. Fetch
      const tableListStr = nodeTables.join(", ");
      if (!tableListStr) return [];

      const result = await db.query(`SELECT * FROM ${tableListStr}`);
      const records = Array.isArray(result[0]?.result) ? result[0].result : [];

      return records.map((r: any) => this.mapRecordToEntity(r));
    } catch (error: any) {
      console.error("Critical: Failed to fetch entities from DB.", error);
      return [];
    }
  }

  async searchEntities(query: string): Promise<Entity[]> {
    const db = surrealDB.getClient();
    // For now, searches default 'entity' table. 
    // Expanding to all tables dynamically is expensive for search bar.
    const results = await db.query(
      `SELECT * FROM ${TABLES.ENTITY} WHERE label ~ $query OR properties.* ~ $query`,
      { query }
    );
    const records = results[0]?.result || [];
    return Array.isArray(records) ? records.map((r) => this.mapRecordToEntity(r)) : [];
  }

  // --------------------------------------------------------------------------------
  // Relationship Operations
  // --------------------------------------------------------------------------------

  async createRelationship(
    from: string, to: string, type: Relationship["type"],
    properties?: Relationship["properties"], confidence?: number, source?: string
  ): Promise<Relationship> {
    try {
      const db = surrealDB.getClient();
      const now = new Date().toISOString();
      const query = `
        CREATE ${TABLES.RELATIONSHIP} CONTENT {
          from: $from, to: $to, type: $type,
          properties: $properties, confidence: $confidence,
          source: type::string($source), createdAt: type::datetime($createdAt)
        }
      `;
      const result = await db.query(query, {
        from, to, type, properties: properties || {},
        confidence: confidence ?? 1.0, source: source || "manual", createdAt: now,
      });
      
      const records = result[0]?.result;
      if (!records || !Array.isArray(records) || records.length === 0) {
        throw new Error("Failed to create relationship record");
      }
      return this.mapRecordToRelationship(records[0]);
    } catch (error: any) {
      if (error?.message?.includes("permissions")) throw new Error("Insufficient permissions.");
      throw error;
    }
  }

  async updateRelationship(id: string, updates: Partial<Relationship>): Promise<Relationship> {
    try {
      const db = surrealDB.getClient();
      const updateFields: string[] = [];
      const params: any = { id };

      Object.keys(updates).forEach(key => {
        if (key !== 'createdAt' && updates[key as keyof typeof updates] !== undefined) {
          if (key === 'source') updateFields.push(`${key}: type::string($${key})`);
          else updateFields.push(`${key}: $${key}`);
          params[key] = updates[key as keyof typeof updates];
        }
      });

      const query = `UPDATE $id CONTENT { ${updateFields.join(',\n')} }`;
      const result = await db.query(query, params);
      const records = Array.isArray(result) && result[0] && 'result' in result[0] 
        ? (result[0].result as any[]) : [];
      
      if (!records[0]) throw new Error("Failed to update relationship");
      return this.mapRecordToRelationship(records[0]);
    } catch (error: any) { throw error; }
  }

  async deleteRelationship(id: string): Promise<void> {
    const db = surrealDB.getClient();
    await db.delete(id);
  }

  async getRelationship(id: string): Promise<Relationship | null> {
    try {
      const db = surrealDB.getClient();
      const record = await db.select(id);
      if (!record) return null;
      return this.mapRecordToRelationship(record);
    } catch (e) { return null; }
  }

  // --------------------------------------------------------------------------------
  // PRODUCTION: Dynamic Relationship Fetching
  // --------------------------------------------------------------------------------
  async getAllRelationships(documentId?: string): Promise<Relationship[]> {
    try {
      const db = surrealDB.getClient();
      
      const infoResult = await db.query('INFO FOR DB');
      // @ts-ignore
      const tablesObject = infoResult[0]?.result?.tables || {};
      const allTableNames = Object.keys(tablesObject);

      // Exclude known system tables
      const excludedTables = [
        TABLES.ENTITY, TABLES.DOCUMENT, TABLES.RELATIONSHIP_DEF, 
        TABLES.DATA_SOURCE_CONFIG, 'user', 'session'
      ];
      
      // We accept all other tables as candidates, the mapper will filter out invalid ones
      const candidateTables = allTableNames.filter(t => !excludedTables.includes(t));
      console.log("Production: Scanning tables for relationships:", candidateTables);

      let allRecords: any[] = [];

      if (candidateTables.length > 0) {
          const tableListStr = candidateTables.join(", ");
          const records = await db.query(`SELECT * FROM ${tableListStr}`);
          if (Array.isArray(records[0]?.result)) {
              allRecords = records[0].result;
          }
      }

      // STRICT FILTER: Only keep records that strictly look like edges
      const validEdges = allRecords.filter(r => (r.in && r.out) || (r.from && r.to));
      
      return validEdges.map((r) => this.mapRecordToRelationship(r));

    } catch (error: any) {
      console.error("Critical: Failed to fetch relationships.", error);
      return [];
    }
  }

  // --------------------------------------------------------------------------------
  // Document Operations
  // --------------------------------------------------------------------------------

  async getAllDocuments(): Promise<Document[]> {
    try {
      const db = surrealDB.getClient();
      const records = await db.select(TABLES.DOCUMENT);
      return Array.isArray(records) ? records.map((r) => this.mapRecordToDocument(r)) : [];
    } catch (e) { return []; }
  }

  async getEntitiesByDocument(documentId: string): Promise<Entity[]> {
    try {
      const db = surrealDB.getClient();
      // For performance, we assume standard entity table here. 
      // If using split tables, we'd need to use getAllEntities() and filter in memory.
      const query = `SELECT * FROM ${TABLES.ENTITY} WHERE metadata.source = $documentId`;
      const result = await db.query(query, { documentId });
      return Array.isArray(result[0]?.result) 
        ? result[0].result.map((r: any) => this.mapRecordToEntity(r))
        : [];
    } catch (e) { return []; }
  }

  async createDocument(document: Omit<Document, "id" | "uploadedAt">): Promise<Document> {
    try {
      const db = surrealDB.getClient();
      const processedAtValue = document.processedAt || new Date().toISOString();
      
      const query = `
        CREATE ${TABLES.DOCUMENT} CONTENT {
          filename: $filename,
          content: $content,
          fileType: $fileType,
          processedAt: type::datetime($processedAt),
          entityCount: $entityCount,
          relationshipCount: $relationshipCount
        }
      `;
      
      const result = await db.query(query, {
        filename: document.filename,
        content: document.content,
        fileType: document.fileType,
        processedAt: processedAtValue,
        entityCount: document.entityCount ?? 0,
        relationshipCount: document.relationshipCount ?? 0,
      });
      
      const records = Array.isArray(result) && result[0] && 'result' in result[0] 
        ? (result[0].result as any[])
        : [];
      const record = records[0];
      if (!record) {
        throw new Error("Failed to create document record");
      }

      return this.mapRecordToDocument(record);
    } catch (error: any) {
      throw error;
    }
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document> {
    const db = surrealDB.getClient();
    const record = await db.merge(id, updates);
    return this.mapRecordToDocument(record);
  }

  async clearAllData(): Promise<{ entitiesDeleted: number; relationshipsDeleted: number; documentsDeleted: number }> {
    try {
      const db = surrealDB.getClient();
      // For production safety, explicit delete is better than implicit.
      // This resets standard tables.
      await db.query(`DELETE FROM ${TABLES.RELATIONSHIP}`); 
      await db.query(`DELETE FROM ${TABLES.ENTITY}`);
      await db.query(`DELETE FROM ${TABLES.DOCUMENT}`);
      
      return { entitiesDeleted: 0, relationshipsDeleted: 0, documentsDeleted: 0 };
    } catch (e) { throw e; }
  }

  // --------------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------------

  private mapRecordToEntity(record: any): Entity {
    const entity = Array.isArray(record) ? record[0] : record;
    if (!entity || typeof entity !== 'object') throw new Error(`Invalid entity: ${JSON.stringify(record)}`);
    
    // Auto-detect type if missing (for production robustness)
    let type = entity.type;
    if (!type && typeof entity.id === 'string') {
        type = entity.id.split(':')[0];
    }

    let label = entity.label;
    if (!label) {
        label = entity.name || entity.id; 
    }

    return {
      id: entity.id || String(entity),
      type: type || "Unknown",
      label: label,
      properties: entity.properties || entity,
      metadata: entity.metadata || {},
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private mapRecordToRelationship(record: any): Relationship {
    const rel = Array.isArray(record) ? record[0] : record;
    if (!rel || typeof rel !== 'object') throw new Error(`Invalid relationship: ${JSON.stringify(record)}`);
    
    return {
      id: rel.id || String(rel),
      // Handle SurrealDB 'in'/'out' pointers natively
      from: rel.from || rel.in,
      to: rel.to || rel.out,
      type: rel.type || (typeof rel.id === 'string' ? rel.id.split(':')[0] : 'Edge'),
      properties: rel.properties || {},
      confidence: rel.confidence,
      source: rel.source,
      createdAt: rel.createdAt,
    };
  }

  private mapRecordToDocument(record: any): Document {
    return {
      id: record.id || record,
      filename: record.filename,
      content: record.content,
      fileType: record.fileType,
      uploadedAt: record.uploadedAt,
      processedAt: record.processedAt,
      entityCount: record.entityCount,
      relationshipCount: record.relationshipCount,
    };
  }

  async getNeighbors(entityId: string, depth: number = 1): Promise<{ entities: Entity[]; relationships: Relationship[]; }> {
    const db = surrealDB.getClient();
    // Simplified neighbor fetch. 
    const query = `
        SELECT * FROM ${TABLES.ENTITY} WHERE id IN (
            SELECT from FROM ${TABLES.RELATIONSHIP} WHERE to = $id
            UNION
            SELECT to FROM ${TABLES.RELATIONSHIP} WHERE from = $id
        );
        SELECT * FROM ${TABLES.RELATIONSHIP} WHERE from = $id OR to = $id;
    `;
    const results = await db.query(query, { id: entityId });
    const entities = Array.isArray(results[0]?.result) ? results[0].result.map((r: any) => this.mapRecordToEntity(r)) : [];
    const relationships = Array.isArray(results[1]?.result) ? results[1].result.map((r: any) => this.mapRecordToRelationship(r)) : [];
    return { entities, relationships };
  }

  async getSubgraph(entityIds: string[]): Promise<{ entities: Entity[]; relationships: Relationship[]; }> {
    return { entities: [], relationships: [] };
  }
}

export const graphOps = new GraphOperations();