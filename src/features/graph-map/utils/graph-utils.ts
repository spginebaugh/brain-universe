import { StandardsData } from '../types/standard';

export const getAllChildNodes = (nodeId: string, standardsData: StandardsData): string[] => {
  const standards = standardsData.data.standards;
  const childNodes: string[] = [];

  Object.values(standards).forEach((standard) => {
    if (standard.ancestorIds.includes(nodeId)) {
      childNodes.push(standard.id);
    }
  });

  return childNodes;
}; 