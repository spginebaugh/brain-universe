export interface EdgeExtensions {
  [key: string]: unknown;
}

export interface Edge {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  isDirected: boolean;
  relationshipType: string;
  extensions?: EdgeExtensions;
} 