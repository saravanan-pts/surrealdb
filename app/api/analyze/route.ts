import { NextResponse } from "next/server";
import { surrealDB } from "@/lib/surrealdb-client";
import { proposeSchemaFromHeaders } from "@/services/metadata-analyzer";
import { TABLES } from "@/lib/schema";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    // 1. Read Headers
    const text = await file.slice(0, 1024).text();
    const firstLine = text.split('\n')[0];
    const headers = firstLine.split(',').map(h => h.trim().replace(/['"]+/g, ''));
    
    // 2. Check Memory (Have we seen this file type?)
    const signature = headers.slice().sort().join("|");
    const db = await surrealDB.getClient();
    const [existing] = await db.query(
      `SELECT * FROM ${TABLES.DATA_SOURCE_CONFIG} WHERE signature = $sig LIMIT 1`, 
      { sig: signature }
    );

    if (existing && existing[0]) {
      return NextResponse.json({ 
        success: true, 
        headers, 
        proposals: existing[0].approved_mapping, 
        source: "MEMORY" 
      });
    }

    // 3. Ask AI (New file type)
    const analysis = await proposeSchemaFromHeaders(file.name, headers);
    
    return NextResponse.json({ 
      success: true, 
      headers, 
      proposals: analysis.proposals, 
      source: "AI" 
    });

  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}