import { NextRequest, NextResponse } from "next/server";
import { surrealDB } from "@/lib/surrealdb-client";
import { azureOpenAI } from "@/services/azure-openai";
import { TABLES } from "@/lib/schema";

// Ensure this route only runs on the server
export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for large files

export async function POST(request: NextRequest) {
  try {
    // 1. Connect to DB
    await surrealDB.connect();
    const db = await surrealDB.getClient();

    // 2. Parse JSON Body
    let body;
    try {
        body = await request.json();
    } catch (e) {
        return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    }

    const { textContent, fileName, approvedMapping, saveToMemory } = body;

    if (!textContent) {
        return NextResponse.json({ error: "No text content provided" }, { status: 400 });
    }

    // 3. Save Configuration to Memory
    if (saveToMemory && approvedMapping) {
        try {
            const headers = approvedMapping.map((m: any) => m.header_column);
            const signature = headers.sort().join("|");
            
            const [exists] = await db.query(`SELECT * FROM ${TABLES.DATA_SOURCE_CONFIG} WHERE signature = $sig`, { sig: signature });
            
            if (!exists[0]) {
                await db.create(TABLES.DATA_SOURCE_CONFIG, {
                    signature,
                    last_file_name: fileName,
                    approved_mapping: approvedMapping,
                    created_at: new Date().toISOString()
                });
                console.log(" Knowledge Graph learned a new file format."); 
            }
        } catch (err) {
            console.warn("Failed to save config to memory:", err);
        }
    }

    // 4. Process the Content
    const lines = textContent.split('\n');
    const dataLines = lines.length > 0 && approvedMapping && lines[0].includes(approvedMapping[0]?.header_column) 
        ? lines.slice(1) 
        : lines;

    const allEntities: any[] = [];
    const allRelationships: any[] = [];
    const BATCH_SIZE = 20; 
    const rowsToProcess = dataLines.slice(0, BATCH_SIZE);

    console.log(` Processing ${rowsToProcess.length} rows...`); 

    for (const row of rowsToProcess) {
        if (!row.trim()) continue;
        const result = await azureOpenAI.extractGraphWithMapping(row, approvedMapping || []);
        if (result.entities) allEntities.push(...result.entities);
        if (result.relationships) allRelationships.push(...result.relationships);
    }

    // 5. Insert into SurrealDB
    const sanitizeId = (label: string) => label.trim().replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

    // A. Insert Entities (FIXED)
    console.log(`Inserting ${allEntities.length} entities...`);
    for (const entity of allEntities) {
        try {
            const id = `entity:${sanitizeId(entity.label)}`;
            
            // FIX: Nest properties inside 'properties' object to satisfy SCHEMAFULL definition
            await db.merge(id, {
                label: entity.label,
                type: entity.type,
                properties: entity.properties || {}, // Nested correctly
                updatedAt: new Date().toISOString()
            });
        } catch (e: any) { 
            console.error(`Failed to insert entity ${entity.label}:`, e.message); 
        }
    }

    // B. Insert Relationships
    console.log(`Inserting ${allRelationships.length} relationships...`);
    for (const rel of allRelationships) {
        try {
            const fromId = `entity:${sanitizeId(rel.from)}`;
            const toId = `entity:${sanitizeId(rel.to)}`;
            
            // Sanitize relationship type too
            const relType = rel.type.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();

            await db.query(`RELATE ${fromId}->${relType}->${toId} SET confidence = ${rel.confidence || 1.0}`);
        } catch (e: any) { 
             console.error(`Failed to insert relationship:`, e.message);
        }
    }

    return NextResponse.json({
      success: true,
      stats: {
        entityCount: allEntities.length,
        relationshipCount: allRelationships.length,
      },
      entities: allEntities.slice(0, 50),
      relationships: allRelationships.slice(0, 50)
    });

  } catch (error: any) {
    console.error("Processing Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process file" },
      { status: 500 }
    );
  }
}