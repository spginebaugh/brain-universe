export interface PlanOutput {
  outline: {
    sections: Array<{
      title: string;
      description: string;
      subsectionTitles: string[];
    }>;
  };
  research: {
    queries: string[];
    results: Array<{
      title: string;
      content: string;
      url: string;
    }>;
  };
}

export interface SearchOutput {
  queries: string[];
  searchResults: Array<{
    title: string;
    content: string;
    url: string;
  }>;
}

export interface QueryResult {
  query: string;
  purpose: string;
} 