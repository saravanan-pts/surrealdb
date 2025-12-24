"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef, memo } from "react";
import cytoscape, { Core } from "cytoscape";
import cola from "cytoscape-cola";
import dagre from "cytoscape-dagre";
import type { Entity, Relationship } from "@/types";

if (typeof window !== "undefined") {
  cytoscape.use(cola);
  cytoscape.use(dagre);
}

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
          Person: "#3b82f6", Organization: "#10b981", Location: "#f59e0b",
          Concept: "#8b5cf6", Technology: "#06b6d4",
          // PROD: Event Colors
          Event: "#ef4444", Activity: "#ef4444", Transaction: "#f97316",
          Customer: "#3b82f6", Account: "#6366f1", Branch: "#10b981"
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
                  "label": (ele) => {
                    const lbl = ele.data("label");
                    const time = ele.data("timestamp");
                    // PROD: Show Timestamp
                    return time ? `${lbl}\n(${time.split('T')[1]?.substring(0,5)})` : lbl;
                  },
                  "width": 40, "height": 40, "text-wrap": "wrap", "text-max-width": "100px",
                  "font-size": "10px", "color": "#ffffff",
                  "text-valign": "center", "text-halign": "center"
                },
              },
              {
                selector: "edge",
                style: {
                  "width": 2, "line-color": "#9ca3af", "target-arrow-color": "#9ca3af",
                  "target-arrow-shape": "triangle", "curve-style": "bezier",
                  "label": "data(type)", "font-size": "8px", "text-rotation": "autorotate"
                },
              },
              // PROD: Highlight NEXT Sequence
              {
                selector: 'edge[type="NEXT"]',
                style: {
                  "width": 4, "line-color": "#ef4444", "target-arrow-color": "#ef4444",
                  "label": "NEXT", "font-weight": "bold"
                }
              },
              { selector: "node:selected", style: { "border-width": 4, "border-color": "#f59e0b" } },
            ],
            layout: { name: "cola", animate: false } as any,
            minZoom: 0.1, maxZoom: 2,
          });
        } catch (error) { console.error(error); }

        cyRef.current?.on("tap", "node", (evt) => onNodeSelect?.(evt.target.data("id")));
        cyRef.current?.on("tap", "edge", (evt) => onEdgeSelect?.(evt.target.data("id")));
        cyRef.current?.on("tap", (evt) => {
            if (evt.target === cyRef.current) { onNodeDeselect?.(); onEdgeDeselect?.(); }
        });

        window.addEventListener("resize", handleResize);
      };

      const timeoutId = setTimeout(initCytoscape, 0);
      return () => { clearTimeout(timeoutId); window.removeEventListener("resize", handleResize); cyRef.current?.destroy(); };
    }, []);

    useImperativeHandle(ref, () => ({
      loadGraphData: (entities: Entity[], relationships: Relationship[]) => {
        if (!cyRef.current || cyRef.current.destroyed()) {
            pendingDataRef.current = { entities, relationships };
            return;
        }
        try {
          const nodes = entities.map(e => ({
            data: { id: e.id, label: e.label, type: e.type, ...e.properties }
          }));
          
          // PROD: STRICT FILTERING (No Ghosts)
          const validIds = new Set(nodes.map(n => n.data.id));
          const edges = relationships
            .filter(r => validIds.has(r.from) && validIds.has(r.to))
            .map(r => ({ data: { id: r.id, source: r.from, target: r.to, type: r.type } }));

          cyRef.current.elements().remove();
          cyRef.current.json({ elements: [...nodes, ...edges] });
          cyRef.current.layout({ name: "cola", animate: false } as any).run();
        } catch (e) { console.error(e); }
      },
      addNode: () => {}, addEdge: () => {}, updateNode: () => {}, updateEdge: () => {},
      removeNode: () => {}, removeEdge: () => {}, highlightNode: () => {}, highlightEdge: () => {},
      filterByType: () => {}, exportGraph: () => {}, fit: () => cyRef.current?.fit(), resetZoom: () => {}
    }));

    return <div ref={containerRef} className="w-full h-full border border-gray-300 rounded-lg" style={{ minHeight: "400px" }} />;
  }
));

GraphVisualization.displayName = "GraphVisualization";
export default GraphVisualization;