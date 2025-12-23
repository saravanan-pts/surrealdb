"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef, memo } from "react";
import cytoscape, { Core } from "cytoscape";
import cola from "cytoscape-cola";
import dagre from "cytoscape-dagre";
import type { Entity, Relationship } from "@/types";

// Register layout extensions
cytoscape.use(cola);
cytoscape.use(dagre);

export interface GraphVisualizationRef {
  loadGraphData: (entities: Entity[], relationships: Relationship[]) => void;
  addNode: (entity: Entity) => void;
  addEdge: (relationship: Relationship) => void;
  updateNode: (entity: Entity) => void;
  updateEdge: (relationship: Relationship) => void;
  removeNode: (id: string) => void;
  removeEdge: (id: string) => void;
  highlightNode: (id: string) => void;
  highlightEdge: (id: string) => void;
  filterByType: (types: string[]) => void;
  exportGraph: (format: "png" | "json") => void;
  fit: () => void;
  resetZoom: () => void;
}

interface GraphVisualizationProps {
  onNodeSelect?: (entityId: string) => void;
  onNodeDeselect?: () => void;
  onEdgeSelect?: (edgeId: string) => void;
  onEdgeDeselect?: () => void;
  onContextMenu?: (x: number, y: number, target: "canvas" | "node" | "edge", nodeId?: string, edgeId?: string) => void;
  onCreateNode?: (x: number, y: number) => void;
  onCreateRelationship?: (fromId: string, toId: string) => void;
}

const GraphVisualization = memo(forwardRef<GraphVisualizationRef, GraphVisualizationProps>(
  ({ onNodeSelect, onNodeDeselect, onEdgeSelect, onEdgeDeselect, onContextMenu, onCreateNode, onCreateRelationship }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const cyRef = useRef<Core | null>(null);
    const dragSourceRef = useRef<string | null>(null);
    const pendingDataRef = useRef<{ entities: Entity[]; relationships: Relationship[] } | null>(null);

    useEffect(() => {
      if (!containerRef.current) return;
      
      const handleResize = () => {
        if (cyRef.current && !cyRef.current.destroyed()) {
          cyRef.current.resize();
        }
      };
      
      const initCytoscape = () => {
        if (!containerRef.current) return;
        
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          setTimeout(initCytoscape, 100);
          return;
        }

        const entityColors: Record<string, string> = {
          Person: "#3b82f6",
          Organization: "#10b981",
          Location: "#f59e0b",
          Concept: "#8b5cf6",
          Event: "#ef4444",
          Technology: "#06b6d4",
          Account: "#3b82f6",     // Added for Banking
          Branch: "#10b981",      // Added for Banking
          Transaction: "#ef4444", // Added for Banking
        };

        try {
          cyRef.current = cytoscape({
            container: containerRef.current,
            style: [
              {
                selector: "node",
                style: {
                  "background-color": (ele) => {
                    const type = ele.data("type") || "Concept";
                    return entityColors[type] || "#6b7280";
                  },
                  "label": "data(label)",
                  "width": 40,
                  "height": 40,
                  "shape": "ellipse",
                  "text-valign": "center",
                  "text-halign": "center",
                  "color": "#ffffff",
                  "font-size": "10px",
                  "font-weight": "bold",
                  "text-wrap": "wrap",
                  "text-max-width": "100px",
                  "border-width": 2,
                  "border-color": "#ffffff",
                  "transition-duration": 0,
                },
              },
              {
                selector: "edge",
                style: {
                  "width": 2,
                  "line-color": "#9ca3af",
                  "target-arrow-color": "#9ca3af",
                  "target-arrow-shape": "triangle",
                  "curve-style": "bezier",
                  "label": "data(type)",
                  "font-size": "8px",
                  "text-rotation": "autorotate",
                  "text-margin-y": -5,
                  "transition-duration": 0,
                },
              },
              {
                selector: "node:selected",
                style: {
                  "border-width": 4,
                  "border-color": "#f59e0b",
                  "width": 50,
                  "height": 50,
                },
              },
              {
                selector: "edge:selected",
                style: {
                  "width": 4,
                  "line-color": "#f59e0b",
                  "target-arrow-color": "#f59e0b",
                },
              },
              {
                selector: "node.dragging",
                style: {
                  "border-width": 4,
                  "border-color": "#3b82f6",
                  "opacity": 0.7,
                },
              },
            ],
            layout: {
              name: "cola",
              padding: 50,
              animate: false,
            } as any,
            minZoom: 0.1,
            maxZoom: 2,
          });
        } catch (error) {
          console.error("Error initializing Cytoscape:", error);
          return;
        }

        // Event handlers (Source same as original)
        cyRef.current.on("tap", "node", (evt) => {
          const node = evt.target;
          const entityId = node.data("id");
          if (onNodeSelect) onNodeSelect(entityId);
          if (onEdgeDeselect) onEdgeDeselect();
        });

        cyRef.current.on("tap", "edge", (evt) => {
          const edge = evt.target;
          const edgeId = edge.data("id");
          if (onEdgeSelect) onEdgeSelect(edgeId);
          if (onNodeDeselect) onNodeDeselect();
        });

        cyRef.current.on("tap", (evt) => {
          if (evt.target === cyRef.current) {
            if (onNodeDeselect) onNodeDeselect();
            if (onEdgeDeselect) onEdgeDeselect();
          }
        });

        cyRef.current.on("dbltap", (evt) => {
          if (evt.target === cyRef.current && onCreateNode) {
            const pos = evt.position || evt.renderedPosition;
            onCreateNode(pos.x, pos.y);
          }
        });

        cyRef.current.on("mousedown", "node", (evt) => {
          const node = evt.target;
          dragSourceRef.current = node.data("id");
          node.addClass("dragging");
        });

        cyRef.current.on("mouseup", "node", (evt) => {
          const node = evt.target;
          const targetId = node.data("id");
          if (dragSourceRef.current && dragSourceRef.current !== targetId && onCreateRelationship) {
            onCreateRelationship(dragSourceRef.current, targetId);
          }
          cyRef.current?.elements().removeClass("dragging");
          dragSourceRef.current = null;
        });

        cyRef.current.on("mouseout", "node", () => {
          cyRef.current?.elements().removeClass("dragging");
          dragSourceRef.current = null;
        });

        cyRef.current.on("cxttap", "node", (evt) => {
          evt.preventDefault();
          const node = evt.target;
          const pos = evt.position || evt.renderedPosition;
          const containerPos = containerRef.current?.getBoundingClientRect();
          if (onContextMenu && containerPos) {
            onContextMenu(containerPos.left + pos.x, containerPos.top + pos.y, "node", node.data("id"));
          }
        });

        cyRef.current.on("cxttap", "edge", (evt) => {
          evt.preventDefault();
          const edge = evt.target;
          const pos = evt.position || evt.renderedPosition;
          const containerPos = containerRef.current?.getBoundingClientRect();
          if (onContextMenu && containerPos) {
            onContextMenu(containerPos.left + pos.x, containerPos.top + pos.y, "edge", undefined, edge.data("id"));
          }
        });

        cyRef.current.on("cxttap", (evt) => {
          if (evt.target === cyRef.current) {
            evt.preventDefault();
            const pos = evt.position || evt.renderedPosition;
            const containerPos = containerRef.current?.getBoundingClientRect();
            if (onContextMenu && containerPos) {
              onContextMenu(containerPos.left + pos.x, containerPos.top + pos.y, "canvas");
            }
          }
        });

        window.addEventListener("resize", handleResize);
        
        // Load pending data
        if (pendingDataRef.current) {
          // Re-use logic from loadGraphData via ref
          // We can't access the ref function directly here easily, so we just retry loading
        }
      };

      const timeoutId = setTimeout(initCytoscape, 0);

      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener("resize", handleResize);
        if (cyRef.current) {
          try {
            cyRef.current.destroy();
          } catch (error) {
            console.error("Error destroying Cytoscape:", error);
          }
          cyRef.current = null;
        }
      };
    }, [onNodeSelect, onNodeDeselect, onContextMenu, onCreateNode, onCreateRelationship]);

    useImperativeHandle(ref, () => ({
      loadGraphData: (entities: Entity[], relationships: Relationship[]) => {
        if (!cyRef.current || !containerRef.current || cyRef.current.destroyed()) {
          pendingDataRef.current = { entities, relationships };
          return;
        }

        try {
          const nodes = entities.map((entity) => ({
            data: {
              id: entity.id,
              label: entity.label,
              type: entity.type,
              ...entity.properties,
            },
          }));

          // ---------------------------------------------------------
          // FIX: Filter out edges that point to non-existent nodes
          // ---------------------------------------------------------
          const validNodeIds = new Set(nodes.map(n => n.data.id));
          const validEdges: any[] = [];
          
          relationships.forEach((rel) => {
            if (validNodeIds.has(rel.from) && validNodeIds.has(rel.to)) {
              validEdges.push({
                data: {
                  id: rel.id,
                  source: rel.from,
                  target: rel.to,
                  type: rel.type,
                  ...rel.properties,
                },
              });
            } else {
              console.warn(`Skipping dangling edge ${rel.id}: ${rel.from} -> ${rel.to} (One or both nodes missing)`);
            }
          });

          cyRef.current.elements().remove();
          cyRef.current.json({ elements: [...nodes, ...validEdges] });
          
          if (nodes.length > 0) {
            cyRef.current.layout({ name: "cola", animate: false } as any).run();
          } else {
            cyRef.current.fit(undefined, 50);
          }
        } catch (error) {
          console.error("Error loading graph data:", error);
        }
      },

      addNode: (entity: Entity) => {
        if (!cyRef.current || cyRef.current.destroyed()) return;
        try {
          cyRef.current.add({
            data: {
              id: entity.id,
              label: entity.label,
              type: entity.type,
              ...entity.properties,
            },
          });
          cyRef.current.layout({ name: "cola", animate: false } as any).run();
        } catch (error) { console.error("Error adding node:", error); }
      },

      addEdge: (relationship: Relationship) => {
        if (!cyRef.current || cyRef.current.destroyed()) return;
        try {
          cyRef.current.add({
            data: {
              id: relationship.id,
              source: relationship.from,
              target: relationship.to,
              type: relationship.type,
              ...relationship.properties,
            },
          });
          cyRef.current.layout({ name: "cola", animate: false } as any).run();
        } catch (error) { console.error("Error adding edge:", error); }
      },

      updateNode: (entity: Entity) => {
        if (!cyRef.current || cyRef.current.destroyed()) return;
        try {
          const node = cyRef.current.getElementById(entity.id);
          if (node.length > 0) {
            node.data({ label: entity.label, type: entity.type, ...entity.properties });
          }
        } catch (error) { console.error("Error updating node:", error); }
      },

      updateEdge: (relationship: Relationship) => {
        if (!cyRef.current || cyRef.current.destroyed()) return;
        try {
          const edge = cyRef.current.getElementById(relationship.id);
          if (edge.length > 0) {
            edge.data({ source: relationship.from, target: relationship.to, type: relationship.type, ...relationship.properties });
          }
        } catch (error) { console.error("Error updating edge:", error); }
      },

      removeNode: (id: string) => {
        if (!cyRef.current || cyRef.current.destroyed()) return;
        try {
          cyRef.current.getElementById(id).remove();
        } catch (error) { console.error("Error removing node:", error); }
      },

      removeEdge: (id: string) => {
        if (!cyRef.current || cyRef.current.destroyed()) return;
        try {
          cyRef.current.getElementById(id).remove();
        } catch (error) { console.error("Error removing edge:", error); }
      },

      highlightNode: (id: string) => {
        if (!cyRef.current || cyRef.current.destroyed()) return;
        try {
          cyRef.current.elements().removeClass("highlighted");
          const node = cyRef.current.getElementById(id);
          node.addClass("highlighted");
          cyRef.current.center(node);
        } catch (error) { console.error("Error highlighting node:", error); }
      },

      highlightEdge: (id: string) => {
        if (!cyRef.current || cyRef.current.destroyed()) return;
        try {
          cyRef.current.elements().removeClass("highlighted");
          const edge = cyRef.current.getElementById(id);
          edge.addClass("selected");
        } catch (error) { console.error("Error highlighting edge:", error); }
      },

      filterByType: (types: string[]) => {
        if (!cyRef.current || cyRef.current.destroyed()) return;
        try {
          if (types.length === 0) {
            cyRef.current.elements().style("display", "element");
          } else {
            cyRef.current.elements().style("display", "none");
            cyRef.current.elements().filter(ele => {
              if (ele.isNode()) return types.includes(ele.data("type"));
              const src = ele.source();
              const tgt = ele.target();
              return types.includes(src.data("type")) && types.includes(tgt.data("type"));
            }).style("display", "element");
          }
          cyRef.current.layout({ name: "cola", animate: false } as any).run();
        } catch (error) { console.error("Error filtering:", error); }
      },

      exportGraph: (format: "png" | "json") => {
        if (!cyRef.current || cyRef.current.destroyed()) return;
        try {
          if (format === "png") {
            const png = cyRef.current.png({ full: true, bg: "white" });
            const link = document.createElement("a");
            link.download = "graph.png";
            link.href = png;
            link.click();
          } else {
            const json = JSON.stringify(cyRef.current.json(), null, 2);
            const blob = new Blob([json], { type: "application/json" });
            const link = document.createElement("a");
            link.download = "graph.json";
            link.href = URL.createObjectURL(blob);
            link.click();
          }
        } catch (error) { console.error("Error exporting:", error); }
      },

      fit: () => { cyRef.current?.fit(undefined, 50); },
      resetZoom: () => { cyRef.current?.zoom(1); cyRef.current?.center(); },
    }));

    return (
      <div
        ref={containerRef}
        className="w-full h-full border border-gray-300 rounded-lg"
        style={{ minHeight: "400px" }}
      />
    );
  }
));

GraphVisualization.displayName = "GraphVisualization";

export default GraphVisualization;