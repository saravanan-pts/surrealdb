import type { EntityType, RelationshipType } from "@/types";

export const ENTITY_TYPES: EntityType[] = [
  "Person", "Organization", "Location", "Concept", "Event", "Technology"
];

export const RELATIONSHIP_TYPES: RelationshipType[] = [
  "RELATED_TO", "PART_OF", "WORKS_AT", "LOCATED_IN", "MENTIONS", "CREATED_BY"
];

export const TABLES = {
  ENTITY: "entity",
  RELATIONSHIP: "relationship",
  DOCUMENT: "document",
  RELATIONSHIP_DEF: "relationship_def",
  DATA_SOURCE_CONFIG: "data_source_config"
} as const;

export function isValidEntityType(type: string): type is EntityType {
  return ENTITY_TYPES.includes(type as EntityType);
}

export function isValidRelationshipType(type: string): boolean {
  return true; 
}

// FIX: ALL TABLES SET TO SCHEMALESS
export const SCHEMA_QUERIES = {
  defineEntityTable: `
    DEFINE TABLE ${TABLES.ENTITY} SCHEMALESS PERMISSIONS FULL;
    DEFINE FIELD type ON ${TABLES.ENTITY} TYPE string; 
    DEFINE FIELD label ON ${TABLES.ENTITY} TYPE string;
    DEFINE INDEX idx_label ON ${TABLES.ENTITY} FIELDS label;
  `,
  defineRelationshipTable: `
    DEFINE TABLE ${TABLES.RELATIONSHIP} SCHEMALESS PERMISSIONS FULL;
    DEFINE FIELD from ON ${TABLES.RELATIONSHIP} TYPE record<${TABLES.ENTITY}>;
    DEFINE FIELD to ON ${TABLES.RELATIONSHIP} TYPE record<${TABLES.ENTITY}>;
    DEFINE FIELD type ON ${TABLES.RELATIONSHIP} TYPE string; 
    DEFINE INDEX idx_from ON ${TABLES.RELATIONSHIP} FIELDS from;
    DEFINE INDEX idx_to ON ${TABLES.RELATIONSHIP} FIELDS to;
    DEFINE INDEX idx_type ON ${TABLES.RELATIONSHIP} FIELDS type;
  `,
  defineDocumentTable: `
    DEFINE TABLE ${TABLES.DOCUMENT} SCHEMALESS PERMISSIONS FULL;
    DEFINE FIELD filename ON ${TABLES.DOCUMENT} TYPE string;
  `,
  defineRelationshipDefTable: `
    DEFINE TABLE ${TABLES.RELATIONSHIP_DEF} SCHEMALESS PERMISSIONS FULL;
  `,
  defineConfigTable: `
    DEFINE TABLE ${TABLES.DATA_SOURCE_CONFIG} SCHEMALESS PERMISSIONS FULL;
  `
};