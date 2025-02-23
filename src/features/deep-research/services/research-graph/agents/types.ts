import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { ResearchState, ResearchStep } from '../../../types/research';

export interface AgentInput {
  state: ResearchState;
  model: ChatOpenAI;
}

export interface AgentOutput {
  state: Partial<ResearchState>;
  steps: ResearchStep[];
}

export interface SearchQuery {
  query: string;
  purpose: string;
  target_subsection?: string;
}

export const SearchQuerySchema = z.object({
  queries: z.array(z.object({
    query: z.string().describe("The search query to be executed"),
    purpose: z.string().describe("The purpose of this query in the research process"),
    target_subsection: z.string().optional().describe("The specific subsection this query targets")
  }))
}).describe("A set of search queries with their purposes and target subsections");

export type SearchQueryResponse = z.infer<typeof SearchQuerySchema>;

export interface SectionPlan {
  number: number;
  name: string;
  description: string;
  subsection_titles: string[];
}

export const SourceSchema = z.object({
  title: z.string().describe("The title of the source"),
  url: z.string().url().describe("The URL of the source")
}).describe("A reference source");

export const SubsectionSchema = z.object({
  title: z.string().describe("The title of the subsection"),
  description: z.string().describe("A brief description of the topics covered"),
  content: z.string().describe("The detailed content of the subsection"),
  sources: z.array(SourceSchema).describe("List of sources referenced in this subsection")
}).describe("A subsection of the content");

export const SectionContentSchema = z.object({
  overview: z.string().describe("A 100-150 word overview of the section"),
  subsections: z.record(SubsectionSchema).describe("Map of subsection titles to their content")
}).describe("The complete content of a section");

export const SectionPlanSchema = z.object({
  sections: z.array(z.object({
    number: z.number().describe("The section number"),
    name: z.string().describe("The section name"),
    description: z.string().describe("The section description"),
    subsection_titles: z.array(z.string()).describe("List of subsection titles")
  }))
}).describe("The complete plan for all sections");

export type SectionContent = z.infer<typeof SectionContentSchema>;
export type SectionPlanResponse = z.infer<typeof SectionPlanSchema>;

export type Agent = (input: AgentInput) => Promise<AgentOutput>; 