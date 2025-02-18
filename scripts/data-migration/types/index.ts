export interface BaseStandard {
  id: string;
  nodeTitle: string;
  nodeDescription: string;
  metadata: {
    source: 'common_core' | 'Texas TEKS';
    subjectName: string;
    standardNotation: string;
    depth: number;
  };
  relationships: {
    parentIds: string[];
  };
}

export interface ProcessorConfig {
  removeDepthZero?: boolean;
} 