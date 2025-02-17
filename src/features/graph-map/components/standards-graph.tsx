'use client';

import { useEffect, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  NodeProps,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
  OnNodesChange,
  useViewport,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { transformToGraphData } from '../services/standards-service';
import { useGraphStore } from '@/shared/stores/graph-store';
import { useStandardsData } from '@/shared/hooks/use-standards-data';
import { getAllChildNodes } from '../utils/graph-utils';

// Constants for zoom thresholds
const TEXT_VISIBILITY_THRESHOLD = 0.5;
const BOUNDARY_TEXT_VISIBILITY_THRESHOLD = 0.3;

// Define node component outside to prevent recreation
const CustomNode = ({ data }: NodeProps) => {
  const viewport = useViewport();
  const showText = viewport.zoom >= TEXT_VISIBILITY_THRESHOLD;

  return (
    <div className={`bg-white border-2 border-gray-200 rounded-lg p-4 shadow-lg max-w-md transition-opacity duration-200 ${showText ? 'opacity-100' : 'opacity-0'}`}>
      <Handle type="target" position={Position.Top} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
      <p className="text-sm text-gray-800">{data.label}</p>
      <Handle type="source" position={Position.Bottom} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
    </div>
  );
};

// Define nodeTypes at module level
const nodeTypes = {
  default: CustomNode,
} as const;

const flowStyles = {
  width: '100%',
  height: '100vh',
} as const;

const StandardsGraphInner = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { screenToFlowPosition, getViewport } = useReactFlow();
  const viewport = useViewport();
  const { 
    visibleNodes, 
    placementMode,
    addRootNode,
    exitPlacementMode,
    nodePositions,
    boundaryCircles,
    isNodeWithinBoundary,
    setZoomLevel
  } = useGraphStore();
  const { data: standardsData, isLoading } = useStandardsData();
  const zoom = viewport.zoom || 1;
  const isRegionDragMode = zoom <= BOUNDARY_TEXT_VISIBILITY_THRESHOLD;

  // Update zoom level in store when viewport changes
  useEffect(() => {
    const viewport = getViewport();
    setZoomLevel(viewport.zoom);
  }, [getViewport, setZoomLevel]);

  // Handle node changes with boundary constraints
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      changes.forEach(change => {
        if (change.type === 'position' && change.position && change.id) {
          if (isRegionDragMode) {
            // Find which region this node belongs to
            const region = Array.from(boundaryCircles.values()).find(
              circle => circle.nodeIds.includes(change.id)
            );
            
            if (region) {
              // Calculate the movement delta
              const oldPosition = nodePositions.get(change.id);
              if (oldPosition) {
                const deltaX = change.position.x - oldPosition.x;
                const deltaY = change.position.y - oldPosition.y;
                
                // Update boundary circle position
                region.centerX += deltaX;
                region.centerY += deltaY;
                
                // Move all nodes in this region
                region.nodeIds.forEach(nodeId => {
                  const nodePos = nodePositions.get(nodeId);
                  if (nodePos) {
                    nodePositions.set(nodeId, {
                      x: nodePos.x + deltaX,
                      y: nodePos.y + deltaY
                    });
                  }
                });
                
                // Update all nodes with their new positions
                setNodes(nodes.map(node => ({
                  ...node,
                  position: nodePositions.get(node.id) || node.position
                })));
              }
            }
          } else {
            // In normal mode, handle individual node changes with boundary constraints
            if (!isNodeWithinBoundary(change.id, change.position)) {
              change.position = nodePositions.get(change.id);
            } else {
              nodePositions.set(change.id, change.position);
            }
          }
        }
      });
      
      onNodesChange(changes);
    },
    [isRegionDragMode, boundaryCircles, nodePositions, nodes, setNodes, isNodeWithinBoundary, onNodesChange]
  );

  // Update graph when visibleNodes or standardsData changes
  useEffect(() => {
    if (standardsData && visibleNodes.size > 0) {
      const graphData = transformToGraphData(standardsData, visibleNodes, nodePositions);
      setNodes(graphData.nodes as Node[]);
      setEdges(graphData.edges as Edge[]);
    }
  }, [standardsData, visibleNodes, setNodes, setEdges, nodePositions]);

  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (placementMode.active && placementMode.nodeId && standardsData) {
        // Convert screen coordinates to flow coordinates
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        // Get child nodes
        const childNodes = getAllChildNodes(placementMode.nodeId, standardsData);
        
        // Add the node at the clicked position
        addRootNode(
          placementMode.nodeId, 
          childNodes, 
          position,
          standardsData.data.standards
        );
        
        // Exit placement mode
        exitPlacementMode();
      }
    },
    [placementMode, standardsData, addRootNode, exitPlacementMode, screenToFlowPosition]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div 
      style={flowStyles} 
      className={`bg-gray-50 ${placementMode.active ? 'cursor-crosshair' : ''}`}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-right"
        nodesDraggable={true}
      >
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
          {Array.from(boundaryCircles.values()).map((circle) => (
            <circle
              key={circle.id}
              cx={circle.centerX}
              cy={circle.centerY}
              r={circle.radius}
              fill="rgba(226, 232, 240, 0.1)"
              stroke="#94a3b8"
              strokeWidth={2 / zoom}
              strokeDasharray={`${5 / zoom},${5 / zoom}`}
              className={`${isRegionDragMode ? 'cursor-move' : ''} pointer-events-${isRegionDragMode ? 'auto' : 'none'}`}
              style={{
                transform: `translate(${viewport.x || 0}px, ${viewport.y || 0}px) scale(${zoom})`,
                transformOrigin: '0 0',
              }}
            />
          ))}
        </svg>
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
          {Array.from(boundaryCircles.values()).map((circle) => {
            const showText = isRegionDragMode;
            return showText && (
              <text
                key={`text-${circle.id}`}
                x={circle.centerX}
                y={circle.centerY}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#475569"
                fontSize={`${24 / zoom}px`}
                className="pointer-events-none select-none"
                style={{
                  transform: `translate(${viewport.x || 0}px, ${viewport.y || 0}px) scale(${zoom})`,
                  transformOrigin: '0 0',
                }}
              >
                {standardsData?.data.standards[circle.id]?.description || ''}
              </text>
            );
          })}
        </svg>
        <Controls />
        <MiniMap />
        <Background />
      </ReactFlow>
    </div>
  );
};

export const StandardsGraph = () => {
  return (
    <ReactFlowProvider>
      <StandardsGraphInner />
    </ReactFlowProvider>
  );
};

export default StandardsGraph; 