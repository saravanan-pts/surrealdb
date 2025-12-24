import { useState, useCallback } from "react";
import { graphOps } from "@/services/graph-operations";
import { useGraphStore } from "@/lib/store";
import type { Entity, Relationship } from "@/types";

export function useGraph() {
  const store = useGraphStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entities = Array.from(store.entities.values());
  const relationships = store.relationships;
  const selectedRelationship = store.selectedRelationship;

  const loadGraph = useCallback(async (documentId: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch Data
      let loadedEntities: Entity[] = [];
      if (documentId) {
        loadedEntities = await graphOps.getEntitiesByDocument(documentId);
      } else {
        loadedEntities = await graphOps.getAllEntities();
      }

      const loadedRelationships = await graphOps.getAllRelationships(documentId || undefined);

      // 2. STRICT FILTERING (No Ghost Nodes)
      const validNodeIds = new Set(loadedEntities.map((e) => e.id));
      
      // Only keep edges where BOTH nodes exist in the DB
      const validRelationships = loadedRelationships.filter(rel => {
        const hasFrom = validNodeIds.has(rel.from);
        const hasTo = validNodeIds.has(rel.to);
        return hasFrom && hasTo;
      });

      // 3. Update Store
      store.setEntities(loadedEntities);
      store.setRelationships(validRelationships);

      // Log if we hid anything (for developer awareness)
      const hiddenCount = loadedRelationships.length - validRelationships.length;
      if (hiddenCount > 0) {
        console.warn(`[Strict Mode] Hid ${hiddenCount} edges because their nodes are missing.`);
      }

    } catch (err: any) {
      console.error("Failed to load graph:", err);
      setError(err.message || "Failed to load graph data");
    } finally {
      setIsLoading(false);
    }
  }, [store]);

  const refresh = useCallback(() => { loadGraph(null); }, [loadGraph]);

  // --- Standard CRUD (Same as before) ---
  const createEntity = async (e: any) => { const n = await graphOps.createEntity(e); store.addEntity(n); return n; };
  const updateEntity = async (id: string, u: any) => { const n = await graphOps.updateEntity(id, u); store.updateEntity(id, n); return n; };
  const deleteEntity = async (id: string) => { await graphOps.deleteEntity(id); store.deleteEntity(id); };
  const createRelationship = async (f: string, t: string, ty: string, p?: any, c?: number) => { const r = await graphOps.createRelationship(f, t, ty, p, c); store.addRelationship(r); return r; };
  const updateRelationship = async (id: string, u: any) => { const r = await graphOps.updateRelationship(id, u); store.updateRelationship(id, r); return r; };
  const deleteRelationship = async (id: string) => { await graphOps.deleteRelationship(id); store.deleteRelationship(id); };
  const getRelationship = async (id: string) => { return await graphOps.getRelationship(id); };
  const selectRelationship = (rel: Relationship | null) => { store.setSelectedRelationship(rel); };

  return {
    entities, relationships, selectedRelationship, isLoading, error,
    loadGraph, refresh,
    createEntity, updateEntity, deleteEntity,
    createRelationship, updateRelationship, deleteRelationship,
    getRelationship, selectRelationship
  };
}