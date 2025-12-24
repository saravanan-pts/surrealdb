import { OpenAIClient, AzureKeyCredential } from "@azure/openai";
import type { EntityExtractionResult } from "@/types";

export class AzureOpenAIService {
  private client: OpenAIClient | null = null;
  private maxRetries = 3;
  private baseDelay = 1000;

  constructor() {
    this.initializeClient();
  }

  private initializeClient(): void {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;

    if (!endpoint || !apiKey) {
      console.warn("Azure OpenAI credentials not found.");
      return;
    }

    try {
      this.client = new OpenAIClient(endpoint, new AzureKeyCredential(apiKey));
    } catch (error) {
      console.error("Failed to initialize Azure OpenAI client:", error);
    }
  }

  // --- MERGED LOGIC: Strict Mapping + Event Detection ---
  async extractGraphWithMapping(rowText: string, mapping: any[]): Promise<EntityExtractionResult> {
    if (!this.client) throw new Error("Azure OpenAI client not initialized");

    // 1. Convert User Mapping to Rules
    const rules = mapping.map((m: any) => 
      `- If you see column "${m.header_column}", create relationship "${m.relationship_type}" to entity "${m.target_entity}".`
    ).join("\n");

    // 2. Combined Prompt (Strict + Events)
    const prompt = `
      You are an expert in Knowledge Graphs and Process Mining.
      
      ### PART 1: USER MAPPING RULES
      ${rules}

      ### PART 2: EVENT & TIME RULES (CRITICAL)
      1. **Identify the Event:** If the row describes an action (e.g., "Login", "Purchase", "Claim"), label that node as 'Event', 'Activity', or 'Transaction'.
      2. **Timestamps:** If you find a Date or Time, do **NOT** create a separate node. Instead, add it as a property called 'timestamp' to the Event node.
      3. **Entities:** Extract other entities (Customer, Branch, etc.) as usual.

      ### PART 3: FORBIDDEN (STRICT MODE)
      - **DO NOT use "RELATED_TO"** under any circumstances. Use specific verbs (e.g. "PERFORMED", "OCCURRED_AT") or the ones defined in the mapping.
      - If a column does not match a rule or an event property, **IGNORE IT**. Do not invent relationships.

      ### INPUT DATA
      ${rowText}

      ### OUTPUT JSON FORMAT
      {
        "entities": [ 
          {"type": "Event", "label": "Login", "confidence": 1.0, "properties": { "timestamp": "2023-10-01T10:00:00Z" }},
          {"type": "Customer", "label": "C001", "confidence": 1.0}
        ],
        "relationships": [ 
          {"from": "C001", "to": "Login", "type": "PERFORMED", "confidence": 1.0} 
        ]
      }
    `;

    return this.callOpenAI(prompt, 0.0);
  }

  // Fallback for raw text (Legacy support)
  async extractEntitiesAndRelationships(text: string): Promise<EntityExtractionResult> {
    const prompt = `
      Analyze this text as an Event Log / Audit Trail.
      
      ### RULES
      1. **Events:** Identify specific events/actions.
      2. **Timestamps:** Extract timestamps as properties of Event nodes (do not create Date nodes).
      3. **STRICT VERBS:** Do NOT use "RELATED_TO". Use specific verbs like "WORKS_AT", "LOCATED_IN", "PERFORMED".
      
      Input: ${text.substring(0, 8000)}
    `;
    return this.callOpenAI(prompt, 0.1);
  }

  private async callOpenAI(prompt: string, temperature: number): Promise<EntityExtractionResult> {
    if (!this.client) throw new Error("Client not ready");
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    if (!deploymentName) throw new Error("Deployment name missing");

    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        const response = await this.client.getChatCompletions(
          deploymentName,
          [
            { role: "system", content: "You are a precise JSON extractor. Respond with valid JSON only." },
            { role: "user", content: prompt }
          ],
          { temperature, maxTokens: 4000, responseFormat: { type: "json_object" } }
        );

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error("No content");
        return this.parseExtractionResult(content);

      } catch (error: any) {
        attempt++;
        if (attempt >= this.maxRetries) throw error;
        await this.sleep(this.baseDelay * Math.pow(2, attempt - 1));
      }
    }
    throw new Error("Retries exhausted");
  }

  private parseExtractionResult(content: string): EntityExtractionResult {
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return {
        entities: Array.isArray(parsed.entities) ? parsed.entities : [],
        relationships: Array.isArray(parsed.relationships) ? parsed.relationships : []
      };
    } catch (e) {
      console.error("JSON Parse Error", e);
      return { entities: [], relationships: [] };
    }
  }

  private sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
}

export const azureOpenAI = new AzureOpenAIService();