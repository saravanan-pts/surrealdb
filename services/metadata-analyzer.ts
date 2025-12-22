import { OpenAIClient, AzureKeyCredential } from "@azure/openai";
import { getDynamicMasterLibrary } from "@/services/schema-service";

export async function proposeSchemaFromHeaders(fileName: string, headers: string[]) {
  // 1. Get Knowledge from DB
  const dbRules = await getDynamicMasterLibrary();
  const rulesText = Array.isArray(dbRules) 
    ? dbRules.map((r: any) => `"${r.type}" (${r.description})`).join("\n")
    : "No existing rules.";

  const systemPrompt = `
    You are a Data Architect. Analyze the CSV headers.
    
    ### EXISTING KNOWLEDGE BASE (Prioritize these)
    ${rulesText}

    ### TASK
    Map headers to relationships.
    - If a header matches an existing rule, use it.
    - If a header implies a NEW relationship (e.g. 'doctor_id' implies 'TREATED_BY'), propose it and set "is_new": true.
    
    ### OUTPUT JSON
    {
      "proposals": [
        {
          "header_column": "ColumnName",
          "relationship_type": "EXISTING_OR_NEW_TYPE",
          "target_entity": "EntityName",
          "is_new": boolean,
          "reason": "Why?"
        }
      ]
    }
  `;

  const client = new OpenAIClient(
    process.env.AZURE_OPENAI_ENDPOINT!,
    new AzureKeyCredential(process.env.AZURE_OPENAI_API_KEY!)
  );

  const result = await client.getChatCompletions(
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME!,
    [{ role: "system", content: systemPrompt }, { role: "user", content: `File: ${fileName}, Headers: ${headers.join(",")}` }],
    { temperature: 0.1, responseFormat: { type: "json_object" } }
  );

  return JSON.parse(result.choices[0].message?.content || "{}");
}