'use client';

import { useEffect, useCallback, useMemo } from 'react';
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
import { useCoordinateTransform } from '@/shared/hooks/use-coordinate-transform';
import { usePositionManager } from '@/shared/hooks/use-position-manager';
import { useBoundaryManager } from '@/shared/hooks/use-boundary-manager';

// Constants for zoom thresholds
const REGION_DRAG_THRESHOLD = 0.3;
const TEXT_VISIBILITY_THRESHOLD = 0.5;
const TEXT_SCALE_CONSTRAINTS = {
  min: 14, // Minimum font size in pixels
  max: 24, // Maximum font size in pixels
  base: 24, // Base font size (when zoom is 1)
} as const;

const BORDER_SCALE_CONSTRAINTS = {
  min: 1, // Minimum stroke width in pixels
  max: 3, // Maximum stroke width in pixels
  base: 2, // Base stroke width (when zoom is 1)
} as const;

const DASH_SCALE_CONSTRAINTS = {
  min: 3, // Minimum dash length in pixels
  max: 8, // Maximum dash length in pixels
  base: 5, // Base dash length (when zoom is 1)
} as const;

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
  const { getViewport } = useReactFlow();
  const viewport = useViewport();
  const transformService = useCoordinateTransform();
  const positionManager = usePositionManager();
  const boundaryManager = useBoundaryManager();
  const { 
    visibleNodes, 
    placementMode,
    addRootNode,
    exitPlacementMode,
    nodePositions,
    boundaryCircles,
    setZoomLevel
  } = useGraphStore();
  const { data: standardsData, isLoading } = useStandardsData();
  const zoom = viewport.zoom || 1;
  const isRegionDragMode = boundaryManager.isInRegionDragMode({ 
    zoom, 
    threshold: REGION_DRAG_THRESHOLD 
  });

  const transformContext = useMemo(() => ({
    zoom,
    viewport: {
      x: viewport.x || 0,
      y: viewport.y || 0,
    },
  }), [viewport.x, viewport.y, zoom]);

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
            const oldPosition = nodePositions.get(change.id);
            if (oldPosition) {
              // Update node positions within the region
              const updatedPositions = positionManager.updateRegionPositions({
                nodeId: change.id,
                position: change.position,
                oldPosition,
                boundaryCircles,
                nodePositions,
              });

              // Find the containing boundary
              const containingBoundary = boundaryManager.findContainingBoundary(
                change.id,
                boundaryCircles
              );

              if (containingBoundary) {
                // Calculate the movement delta
                const deltaX = change.position.x - oldPosition.x;
                const deltaY = change.position.y - oldPosition.y;

                // Update the boundary position
                const updatedBoundary = boundaryManager.updateBoundaryPosition(
                  containingBoundary,
                  deltaX,
                  deltaY
                );

                // Update all nodes with their new positions
                setNodes(nodes.map(node => ({
                  ...node,
                  position: updatedPositions.get(node.id) || node.position
                })));

                // Update the store with new positions
                Array.from(updatedPositions.entries()).forEach(([id, pos]) => {
                  nodePositions.set(id, pos);
                });

                // Update the store with new boundary position
                boundaryCircles.set(containingBoundary.id, updatedBoundary);
              }
            }
          } else {
            // In normal mode, handle individual node changes with boundary constraints
            const containingBoundary = boundaryManager.findContainingBoundary(
              change.id,
              boundaryCircles
            );

            if (containingBoundary) {
              const isWithinBoundary = boundaryManager.isPositionWithinBoundary(
                change.position,
                containingBoundary
              );

              if (!isWithinBoundary) {
                change.position = nodePositions.get(change.id);
              } else {
                nodePositions.set(change.id, change.position);
              }
            } else {
              nodePositions.set(change.id, change.position);
            }
          }
        }
      });
      
      onNodesChange(changes);
    },
    [isRegionDragMode, boundaryCircles, nodePositions, nodes, setNodes, positionManager, boundaryManager, onNodesChange]
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
        const flowPosition = transformService.screenToFlow(
          { x: event.clientX, y: event.clientY },
          transformContext
        );

        // Get child nodes
        const childNodes = getAllChildNodes(placementMode.nodeId, standardsData);
        
        // Add the node at the clicked position
        addRootNode(
          placementMode.nodeId, 
          childNodes, 
          flowPosition,
          standardsData.data.standards
        );
        
        // Exit placement mode
        exitPlacementMode();
      }
    },
    [placementMode, standardsData, addRootNode, exitPlacementMode, transformService, transformContext]
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
          {Array.from(boundaryCircles.values()).map((circle) => {
            const transformedPosition = transformService.applyViewportTransform(
              { x: circle.centerX, y: circle.centerY },
              transformContext
            );

            const strokeWidth = transformService.getInverseScaleWithConstraints(
              zoom,
              BORDER_SCALE_CONSTRAINTS
            );

            const dashLength = transformService.getInverseScaleWithConstraints(
              zoom,
              DASH_SCALE_CONSTRAINTS
            );

            return (
              <circle
                key={circle.id}
                cx={transformedPosition.x}
                cy={transformedPosition.y}
                r={circle.radius * zoom}
                fill="rgba(226, 232, 240, 0.1)"
                stroke="#94a3b8"
                strokeWidth={strokeWidth}
                strokeDasharray={`${dashLength},${dashLength}`}
                className={`${isRegionDragMode ? 'cursor-move' : ''} pointer-events-${isRegionDragMode ? 'auto' : 'none'}`}
              />
            );
          })}
        </svg>
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
          {Array.from(boundaryCircles.values()).map((circle) => {
            const showText = isRegionDragMode;
            if (!showText) return null;

            const transformedPosition = transformService.applyViewportTransform(
              { x: circle.centerX, y: circle.centerY },
              transformContext
            );

            const fontSize = transformService.getInverseScaleWithConstraints(
              zoom,
              TEXT_SCALE_CONSTRAINTS
            );

            return (
              <text
                key={`text-${circle.id}`}
                x={transformedPosition.x}
                y={transformedPosition.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#475569"
                fontSize={`${fontSize}px`}
                className="pointer-events-none select-none"
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