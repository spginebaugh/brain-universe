'use client';

import { useCallback } from 'react';
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
} from 'reactflow';
import { useQuery } from '@tanstack/react-query';
import { useDrop } from 'react-dnd';
import 'reactflow/dist/style.css';

import { fetchStandardsData, transformToGraphData } from '../services/standards-service';
import { useGraphStore } from '@/shared/stores/graph-store';
import { NodeMenuOverlay } from './node-menu-overlay';
import { getAllChildNodes } from '../utils/graph-utils';

// Define node component outside to prevent recreation
const CustomNode = ({ data }: NodeProps) => (
  <div className="bg-white border-2 border-gray-200 rounded-lg p-4 shadow-lg max-w-md">
    <Handle type="target" position={Position.Left} />
    <p className="text-sm text-gray-800">{data.label}</p>
    <Handle type="source" position={Position.Right} />
  </div>
);

// Define nodeTypes at module level
const nodeTypes = {
  default: CustomNode,
} as const;

const flowStyles = {
  width: '100%',
  height: '100vh',
} as const;

export const StandardsGraph = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { visibleNodes, addRootNode, toggleMenu } = useGraphStore();

  const { data: standardsData, isLoading } = useQuery({
    queryKey: ['standards'],
    queryFn: fetchStandardsData,
  });

  const [, drop] = useDrop(() => ({
    accept: 'NODE',
    drop: (item: { id: string }) => {
      if (standardsData) {
        const childNodes = getAllChildNodes(item.id, standardsData);
        addRootNode(item.id, childNodes);
        toggleMenu(false);
      }
    },
  }));

  const onInit = useCallback(() => {
    if (standardsData && visibleNodes.size > 0) {
      const graphData = transformToGraphData(standardsData, visibleNodes);
      setNodes(graphData.nodes as Node[]);
      setEdges(graphData.edges as Edge[]);
    }
  }, [standardsData, visibleNodes, setNodes, setEdges]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div 
      ref={(node: HTMLDivElement | null) => {
        if (typeof drop === 'function') {
          drop(node);
        }
      }}
      style={flowStyles} 
      className="bg-gray-50"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={onInit}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-right"
      >
        <Controls />
        <MiniMap />
        <Background />
      </ReactFlow>
      {standardsData && <NodeMenuOverlay nodes={Object.values(standardsData.data.standards)} />}
    </div>
  );
};

export default StandardsGraph; 