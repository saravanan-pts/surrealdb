import { NextRequest, NextResponse } from "next/server";
import { surrealDB } from "@/lib/surrealdb-client";
import { azureOpenAI } from "@/services/azure-openai";
import { TABLES } from "@/lib/schema";
import { graphOps } from "@/services/graph-operations";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    // 1. Connect
    await surrealDB.connect();
    const db = surrealDB.getClient();

    let body;
    try { body = await request.json(); } 
    catch (e) { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { textContent, fileName, approvedMapping } = body;
    if (!textContent) return NextResponse.json({ error: "No text content" }, { status: 400 });

    // 2. Create Document Record
    const document = await graphOps.createDocument({
        filename: fileName || "input.txt",
        content: textContent,
        fileType: "text",
        processedAt: new Date().toISOString(),
        entityCount: 0,
        relationshipCount: 0
    });

    // 3. Extract Data from AI
    const result = await azureOpenAI.extractGraphWithMapping(textContent.slice(0, 15000), approvedMapping || []);
    
    // 4. Insert Entities
    const sanitizeId = (label: string) => label ? label.trim().replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() : "unknown";
    
    console.log(`Inserting ${result.entities.length} entities...`);
    let entitiesInserted = 0;

    for (const entity of result.entities) {
        try {
            if(!entity.label) continue;
            const id = `entity:${sanitizeId(entity.label)}`;
            // Robust Insert (Create or Update)
            try {
                await db.create(id, {
                    label: entity.label,
                    type: entity.type || "Concept",
                    properties: entity.properties || {}, 
                    metadata: { source: document.id },
                    updatedAt: new Date().toISOString()
                });
            } catch (err) {
                await db.merge(id, {
                    properties: entity.properties || {},
                    updatedAt: new Date().toISOString()
                });
            }
            entitiesInserted++;
        } catch (e: any) { 
            console.error(`Entity Error:`, e.message); 
        }
    }

    // -----------------------------------------------------------------------
    // 4A. KEY FIX: UNLOCK ALL DYNAMIC TABLES (HAS_ACCOUNT, BELONGS_TO, etc.)
    // -----------------------------------------------------------------------
    const uniqueRelTypes = new Set(result.relationships.map(r => 
        (r.type || "RELATED_TO").replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase()
    ));

    console.log(`Unlocking permissions for ${uniqueRelTypes.size} tables:`, Array.from(uniqueRelTypes));
    
    for (const type of Array.from(uniqueRelTypes)) {
        try {
            // This ensures the 24+ tables are readable by the frontend
            await db.query(`DEFINE TABLE ${type} SCHEMALESS PERMISSIONS FULL`);
        } catch (e) {
            console.warn(`Warning: Could not define permission for ${type}`, e);
        }
    }

    // 5. Insert Relationships (Into their specific tables)
    console.log(`Inserting ${result.relationships.length} relationships...`);
    let relsInserted = 0;

    for (const rel of result.relationships) {
        try {
            if(!rel.from || !rel.to) continue;
            const fromId = `entity:${sanitizeId(rel.from)}`;
            const toId = `entity:${sanitizeId(rel.to)}`;
            // Use the dynamic table name (e.g., HAS_ACCOUNT)
            const relType = (rel.type || "RELATED_TO").replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();

            await db.query(`
                RELATE ${fromId}->${relType}->${toId} 
                SET confidence = 1.0, 
                    source = $doc
            `, { 
                doc: document.id 
            });
            relsInserted++;
        } catch (e: any) { 
             console.error(`Edge Error:`, e.message);
        }
    }

    // 6. Update Stats
    await graphOps.updateDocument(document.id, { entityCount: entitiesInserted, relationshipCount: relsInserted });

    return NextResponse.json({
      success: true,
      stats: { entitiesInserted, relsInserted },
      entities: result.entities.slice(0, 50),
      relationships: result.relationships.slice(0, 50)
    });

  } catch (error: any) {
    console.error("Processing Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}