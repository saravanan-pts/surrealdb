import { OpenAIClient, AzureKeyCredential } from "@azure/openai";
import type { EntityExtractionResult, ExtractedEntity, ExtractedRelationship, EntityType, RelationshipType } from "@/types";

export class AzureOpenAIService {
  private client: OpenAIClient | null = null;
  private maxRetries: number = 3;
  private baseDelay: number = 1000;

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

  /**
   * THE NEW METHOD: Extracts strictly based on the User's Mapping
   * This prevents "RELATED_TO" because it follows the specific rules.
   */
  async extractGraphWithMapping(rowText: string, mapping: any[]): Promise<EntityExtractionResult> {
    if (!this.client) throw new Error("Azure OpenAI client not initialized");

    // 1. Convert the JSON mapping into strict English rules
    const rules = mapping.map((m: any) => 
      `- When you see column "${m.header_column}", create a relationship of type "${m.relationship_type}" pointing to the entity "${m.target_entity}".`
    ).join("\n");

    const prompt = `
      You are a Strict Knowledge Graph Extractor.
      
      ### STRICT MAPPING RULES
      You must extract relationships based ONLY on these rules. Do not invent others.
      ${rules}

      ### FORBIDDEN
      - **DO NOT use "RELATED_TO"** under any circumstances.
      - If a column does not match a rule, ignore it.

      ### INPUT DATA ROW
      ${rowText}

      ### OUTPUT JSON FORMAT
      {
        "entities": [ 
          {"type": "Entity", "label": "ExtractedValue", "confidence": 1.0} 
        ],
        "relationships": [ 
          {"from": "SourceNode", "to": "TargetNode", "type": "RELATIONSHIP_TYPE", "confidence": 1.0} 
        ]
      }
    `;

    return this.callOpenAI(prompt, 0.0); // 0.0 temperature ensures strict rule following
  }

  // Fallback for generic text (Legacy support)
  async extractEntitiesAndRelationships(text: string): Promise<EntityExtractionResult> {
    const prompt = `
      Analyze the text and extract entities.
      STRICT RULE: Do not use "RELATED_TO". Use specific verbs like "WORKS_AT", "LOCATED_IN", etc.
      
      Input: ${text.substring(0, 8000)}
    `;
    return this.callOpenAI(prompt, 0.2);
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