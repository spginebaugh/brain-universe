interface Standard {
  id: string;
  asnIdentifier: string;
  position: number;
  depth: number;
  statementNotation?: string;
  listId?: string;
  description: string;
  ancestorIds: string[];
}

interface StandardsData {
  data: {
    id: string;
    title: string;
    subject: string;
    normalizedSubject: string;
    educationLevels: string[];
    standards: Record<string, Standard>;
  };
}

export type { Standard, StandardsData }; 