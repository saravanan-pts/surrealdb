import { useCallback } from "react";
import { graphOps } from "@/services/graph-operations";
import { useGraphStore } from "@/lib/store";
import { surrealDB } from "@/lib/surrealdb-client";
import type { Entity, Relationship } from "@/types";

export function useGraph() {
  const {
    entities,
    relationships,
    selectedEntity,
    selectedRelationship,
    setEntities,
    addEntity,
    updateEntity,
    deleteEntity,
    setRelationships,
    addRelationship,
    updateRelationship: updateRelationshipInStore,
    deleteRelationship,
    setSelectedEntity,
    setSelectedRelationship,
    setLoading,
  } = useGraphStore();

  const loadGraph = useCallback(async (documentId?: string | null) => {
    const client = surrealDB.getClient();
    if (!client) {
      console.error("SurrealDB client not connected.");
      return;
    }
    
    setLoading(true);
    try {
      let allEntities: Entity[] = [];
      let allRelationships: Relationship[] = [];

      // Fetch verified data from the database
      if (documentId) {
        [allEntities, allRelationships] = await Promise.all([
          graphOps.getAllEntities(), 
          graphOps.getAllRelationships(documentId),
        ]);
      } else {
        [allEntities, allRelationships] = await Promise.all([
          graphOps.getAllEntities(),
          graphOps.getAllRelationships(),
        ]);
      }

      // PRODUCTION INTEGRITY CHECK
      // Instead of creating fake nodes, we simply log if data is missing
      // The GraphVisualization component handles skipping edges to prevent crashes
      const entityIds = new Set(allEntities.map(e => e.id));
      const danglingEdges = allRelationships.filter(r => !entityIds.has(r.from) || !entityIds.has(r.to));
      
      if (danglingEdges.length > 0) {
        console.warn(`[Data Integrity] Found ${danglingEdges.length} edges pointing to missing nodes. These will be hidden.`);
      }

      setEntities(allEntities);
      setRelationships(allRelationships);

    } catch (error: any) {
      console.error("Error loading graph data:", error);
      setEntities([]);
      setRelationships([]);
    } finally {
      setLoading(false);
    }
  }, [setEntities, setRelationships, setLoading]);

  // Wrappers for store actions
  const createEntity = useCallback(
    async (entity: Omit<Entity, "id" | "createdAt" | "updatedAt">) => {
      setLoading(true);
      try {
        const created = await graphOps.createEntity(entity);
        addEntity(created);
        return created;
      } catch (error) {
        console.error("Error creating entity:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [addEntity, setLoading]
  );

  const updateEntityById = useCallback(
    async (id: string, updates: Partial<Entity>) => {
      setLoading(true);
      try {
        const updated = await graphOps.updateEntity(id, updates);
        updateEntity(id, updated);
        return updated;
      } catch (error) {
        console.error("Error updating entity:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [updateEntity, setLoading]
  );

  const removeEntity = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        await graphOps.deleteEntity(id);
        deleteEntity(id);
      } catch (error) {
        console.error("Error deleting entity:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [deleteEntity, setLoading]
  );

  const createRelationship = useCallback(
    async (from: string, to: string, type: Relationship["type"], properties?: any, confidence?: number) => {
      setLoading(true);
      try {
        const created = await graphOps.createRelationship(from, to, type, properties, confidence);
        addRelationship(created);
        return created;
      } catch (error) {
        console.error("Error creating relationship:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [addRelationship, setLoading]
  );

  const updateRelationshipById = useCallback(
    async (id: string, updates: Partial<Relationship>) => {
      setLoading(true);
      try {
        const updated = await graphOps.updateRelationship(id, updates);
        updateRelationshipInStore(id, updated);
        return updated;
      } catch (error) {
        console.error("Error updating relationship:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [updateRelationshipInStore, setLoading]
  );

  const removeRelationship = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        await graphOps.deleteRelationship(id);
        deleteRelationship(id);
      } catch (error) {
        console.error("Error deleting relationship:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [deleteRelationship, setLoading]
  );

  const searchEntities = useCallback(
    async (query: string) => {
      setLoading(true);
      try {
        return await graphOps.searchEntities(query);
      } catch (error) {
        console.error("Error searching entities:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading]
  );

  const getNeighbors = useCallback(
    async (entityId: string, depth: number = 1) => {
      setLoading(true);
      try {
        return await graphOps.getNeighbors(entityId, depth);
      } catch (error) {
        console.error("Error getting neighbors:", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading]
  );

  return {
    entities: Array.from(entities.values()),
    relationships,
    selectedEntity,
    selectedRelationship,
    loadGraph,
    createEntity,
    updateEntity: updateEntityById,
    deleteEntity: removeEntity,
    createRelationship,
    updateRelationship: updateRelationshipById,
    deleteRelationship: removeRelationship,
    getRelationship: graphOps.getRelationship,
    searchEntities,
    getNeighbors,
    selectEntity: setSelectedEntity,
    selectRelationship: setSelectedRelationship,
  };
}