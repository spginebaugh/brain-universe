import { SearchQuery, SearchResult } from "./research";

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
    results: SearchResult[];
  };
}

export interface SearchOutput {
  queries: SearchQuery[];
  results: SearchResult[];
}

export interface QueryResult {
  query: string;
  purpose: string;
  targetSubTopic?: string;
}
