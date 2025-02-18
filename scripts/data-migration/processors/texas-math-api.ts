import { BaseStandard, ProcessorConfig } from '../types';
import { TexasApiResponse } from '../services/api';

const defaultConfig: ProcessorConfig = {
  removeDepthZero: true
};

function processDepthTwoNode(description: string): { title: string; description: string } {
  const studentIndex = description.indexOf('The student');
  if (studentIndex === -1) {
    return { title: description, description: '' };
  }

  const title = description.slice(0, studentIndex).trim();
  let desc = description.slice(studentIndex);
  
  // Remove "The student is expected to:"
  desc = desc.replace('The student is expected to:', '').trim();
  
  return { title, description: desc };
}

export function processTexasApiStandards(
  apiResponse: TexasApiResponse,
  config: ProcessorConfig = defaultConfig
): BaseStandard[] {
  const standards = Object.entries(apiResponse.data.standards).map(([id, standard]) => {
    if (standard.depth === 2) {
      const processed = processDepthTwoNode(standard.description);
      return {
        id,
        nodeTitle: processed.title,
        nodeDescription: processed.description,
        metadata: {
          source: 'Texas TEKS' as const,
          subjectName: 'Math',
          standardNotation: standard.statementNotation || '',
          depth: standard.depth
        },
        relationships: {
          parentIds: standard.ancestorIds
        },
      };
    }

    return {
      id,
      nodeTitle: standard.description,
      nodeDescription: '',
      metadata: {
        source: 'Texas TEKS' as const,
        subjectName: 'Math',
        standardNotation: standard.statementNotation || '',
        depth: standard.depth
      },
      relationships: {
        parentIds: standard.ancestorIds
      },
    };
  });

  return config.removeDepthZero 
    ? standards.filter(standard => standard.metadata.depth !== 0)
    : standards;
} 