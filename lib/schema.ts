import type { EntityType, RelationshipType } from "@/types";

// SurrealDB Schema Definitions
export const ENTITY_TYPES: EntityType[] = [
  "Person", "Organization", "Location", "Concept", "Event", "Technology"
];

// We keep this list for reference, but we won't strictly enforce it in the DB anymore
export const RELATIONSHIP_TYPES: RelationshipType[] = [
  "RELATED_TO", "PART_OF", "WORKS_AT", "LOCATED_IN", "MENTIONS", "CREATED_BY"
];

export const TABLES = {
  ENTITY: "entity",
  RELATIONSHIP: "relationship",
  DOCUMENT: "document",
  RELATIONSHIP_DEF: "relationship_def",     // New: Stores learned rules
  DATA_SOURCE_CONFIG: "data_source_config"  // New: Stores file mappings
} as const;

export function isValidEntityType(type: string): type is EntityType {
  return ENTITY_TYPES.includes(type as EntityType);
}

// Allow ANY string for relationships now (Dynamic Learning)
export function isValidRelationshipType(type: string): boolean {
  return true; 
}

// SurrealQL Schema Creation Queries
export const SCHEMA_QUERIES = {
  defineEntityTable: `
    DEFINE TABLE ${TABLES.ENTITY} SCHEMAFULL;
    DEFINE FIELD type ON ${TABLES.ENTITY} TYPE string; 
    DEFINE FIELD label ON ${TABLES.ENTITY} TYPE string;
    DEFINE FIELD properties ON ${TABLES.ENTITY} TYPE object;
    DEFINE FIELD metadata ON ${TABLES.ENTITY} TYPE object;
    DEFINE FIELD createdAt ON ${TABLES.ENTITY} TYPE datetime DEFAULT time::now();
    DEFINE FIELD updatedAt ON ${TABLES.ENTITY} TYPE datetime DEFAULT time::now();
    DEFINE INDEX idx_label ON ${TABLES.ENTITY} FIELDS label;
  `,
  defineRelationshipTable: `
    DEFINE TABLE ${TABLES.RELATIONSHIP} SCHEMAFULL;
    DEFINE FIELD from ON ${TABLES.RELATIONSHIP} TYPE record<${TABLES.ENTITY}>;
    DEFINE FIELD to ON ${TABLES.RELATIONSHIP} TYPE record<${TABLES.ENTITY}>;
    -- IMPORTANT: Removed the ASSERT statement so new types are allowed
    DEFINE FIELD type ON ${TABLES.RELATIONSHIP} TYPE string; 
    DEFINE FIELD properties ON ${TABLES.RELATIONSHIP} TYPE object;
    DEFINE FIELD confidence ON ${TABLES.RELATIONSHIP} TYPE float;
    DEFINE FIELD source ON ${TABLES.RELATIONSHIP} TYPE string;
    DEFINE FIELD createdAt ON ${TABLES.RELATIONSHIP} TYPE datetime DEFAULT time::now();
    DEFINE INDEX idx_from ON ${TABLES.RELATIONSHIP} FIELDS from;
    DEFINE INDEX idx_to ON ${TABLES.RELATIONSHIP} FIELDS to;
    DEFINE INDEX idx_type ON ${TABLES.RELATIONSHIP} FIELDS type;
  `,
  defineDocumentTable: `
    DEFINE TABLE ${TABLES.DOCUMENT} SCHEMAFULL;
    DEFINE FIELD filename ON ${TABLES.DOCUMENT} TYPE string;
    DEFINE FIELD content ON ${TABLES.DOCUMENT} TYPE string;
    DEFINE FIELD processedAt ON ${TABLES.DOCUMENT} TYPE datetime;
  `,
  // New Tables for Learning Capability
  defineRelationshipDefTable: `
    DEFINE TABLE ${TABLES.RELATIONSHIP_DEF} SCHEMALESS;
    DEFINE FIELD type ON ${TABLES.RELATIONSHIP_DEF} TYPE string;
    DEFINE INDEX idx_type ON ${TABLES.RELATIONSHIP_DEF} FIELDS type UNIQUE;
  `,
  defineConfigTable: `
    DEFINE TABLE ${TABLES.DATA_SOURCE_CONFIG} SCHEMALESS;
    DEFINE INDEX idx_signature ON ${TABLES.DATA_SOURCE_CONFIG} FIELDS signature;
  `
};