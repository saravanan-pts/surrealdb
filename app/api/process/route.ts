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

    // 2. Parse JSON Body (New Flow)
    // The frontend must now send JSON with 'approvedMapping'
    let body;
    try {
        body = await request.json();
    } catch (e) {
        return NextResponse.json({ error: "Invalid JSON. Ensure you are sending 'Content-Type: application/json'" }, { status: 400 });
    }

    const { textContent, fileName, approvedMapping, saveToMemory } = body;

    if (!textContent) {
        return NextResponse.json({ error: "No text content provided" }, { status: 400 });
    }

    // 3. Save Configuration to Memory (If this is a new file type)
    if (saveToMemory && approvedMapping) {
        try {
            // Create a unique signature based on the columns
            const headers = approvedMapping.map((m: any) => m.header_column);
            const signature = headers.sort().join("|");
            
            // Check if we already remembered this
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

    // 4. Process the Content using the Strict Mapping
    const lines = textContent.split('\n');
    
    // Skip the header row if it matches our mapping keys
    const dataLines = lines.length > 0 && approvedMapping && lines[0].includes(approvedMapping[0]?.header_column) 
        ? lines.slice(1) 
        : lines;

    const allEntities = [];
    const allRelationships = [];

    // Limit processing for the demo (to avoid timeout on Vercel/Free tier)
    // In production, you would use a Queue (like BullMQ) here.
    const BATCH_SIZE = 20; 
    const rowsToProcess = dataLines.slice(0, BATCH_SIZE);

    console.log(` Processing ${rowsToProcess.length} rows using ${approvedMapping?.length || 0} strict rules...`); 

    for (const row of rowsToProcess) {
        if (!row.trim()) continue;

        // CRITICAL: We use the NEW method that forces the specific relationships
        const result = await azureOpenAI.extractGraphWithMapping(row, approvedMapping || []);
        
        if (result.entities) allEntities.push(...result.entities);
        if (result.relationships) allRelationships.push(...result.relationships);
    }

    // 5. Insert into SurrealDB
    // We use a helper to sanitize IDs (remove spaces, special chars)
    const sanitizeId = (label: string) => label.trim().replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

    // A. Insert Entities
    for (const entity of allEntities) {
        try {
            const id = `entity:${sanitizeId(entity.label)}`;
            // MERGE ensures we don't overwrite existing data, just update it
            await db.merge(id, {
                label: entity.label,
                type: entity.type,
                ...entity.properties
            });
        } catch (e) { /* Ignore duplicates */ }
    }

    // B. Insert Relationships
    for (const rel of allRelationships) {
        try {
            const fromId = `entity:${sanitizeId(rel.from)}`;
            const toId = `entity:${sanitizeId(rel.to)}`;
            
            // The magic line: Create the specific edge (e.g., BANKED_AT)
            await db.query(`RELATE ${fromId}->${rel.type}->${toId} SET confidence = ${rel.confidence || 1.0}`);
        } catch (e) { /* Ignore errors */ }
    }

    return NextResponse.json({
      success: true,
      stats: {
        entityCount: allEntities.length,
        relationshipCount: allRelationships.length,
      },
      // Return samples for the UI to display immediately
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