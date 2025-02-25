import { ConsoleCallbackHandler } from "@langchain/core/tracers/console";
import { AgentAction, AgentFinish } from "@langchain/core/agents";
import { ChainValues } from "@langchain/core/utils/types";
import { LLMResult } from "@langchain/core/outputs";
import { Serialized } from "@langchain/core/load/serializable";
import { Run } from "@langchain/core/tracers/base";
import chalk from 'chalk';
import util from 'util';

type KVMap = Record<string, unknown>;

export class ResearchLogger extends ConsoleCallbackHandler {
  private researchId: string;
  
  constructor(researchId: string) {
    super();
    this.researchId = researchId;
    this.logSection("Research Session Started", `ID: ${researchId}`);
  }

  private formatJSON(obj: unknown): string {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  }

  private logSection(title: string, content?: string) {
    console.log(chalk.blue.bold(`\n=== ${title} ===`));
    if (content) {
      console.log(content);
    }
  }

  private logStep(step: string, content?: string | object | unknown) {
    console.log(chalk.yellow(`\n→ ${step}`));
    if (content) {
      if (typeof content === 'string') {
        try {
          // Try to parse the content as JSON
          const jsonContent = JSON.parse(content);
          console.log(util.inspect(jsonContent, { colors: true, depth: 4, compact: false }));
        } catch {
          // If parsing fails, just log the content as is
          console.log(content);
        }
      } else {
        // If content is already an object
        console.log(util.inspect(content, { colors: true, depth: 4, compact: false }));
      }
    }
  }

  private formatErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    
    if (typeof error === 'object' && error !== null) {
      // Handle axios error response
      const errorObj = error as Record<string, unknown>;
      if ('response' in errorObj) {
        const response = errorObj.response as Record<string, unknown>;
        if (response && typeof response === 'object') {
          // Extract error details from response
          const status = response.status;
          const data = response.data;
          const message = typeof data === 'object' && data 
            ? (data as Record<string, unknown>).message || JSON.stringify(data)
            : String(data);
          return `HTTP ${status}: ${message}`;
        }
      }
      
      // Handle error object with message
      if ('message' in errorObj) {
        return String(errorObj.message);
      }
      
      // Fallback to stringifying the error object
      try {
        return JSON.stringify(errorObj);
      } catch {
        return String(errorObj);
      }
    }
    
    return String(error);
  }

  private logError(error: unknown) {
    const errorMessage = this.formatErrorMessage(error);
    console.error(chalk.red(`\n❌ Error: ${errorMessage}`));
    
    // Log stack trace if available
    if (error instanceof Error && error.stack) {
      console.error(chalk.red(error.stack));
    }
    
    // Log additional error details if available
    if (typeof error === 'object' && error !== null) {
      const errorObj = error as Record<string, unknown>;
      if ('response' in errorObj && errorObj.response) {
        const response = errorObj.response as Record<string, unknown>;
        if (response.data) {
          console.error(chalk.red('\nError Details:'));
          console.log(util.inspect(response.data, { colors: true, depth: 4, compact: false }));
        }
      }
    }
  }

  private createRun(runId: string): Run {
    return {
      id: runId,
      name: "research_logger",
      start_time: Date.now(),
      end_time: Date.now(),
      execution_order: 1,
      serialized: { name: "research_logger" },
      events: [],
      child_runs: [],
      child_execution_order: 1,
      extra: {},
      inputs: {},
      outputs: {},
      error: undefined,
      run_type: "chain"
    };
  }

  async handleChainStart(
    chain: Serialized,
    inputs: ChainValues,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: KVMap,
    runType?: string,
    name?: string
  ): Promise<Run> {
    this.logSection("Chain Started", `Chain: ${chain.name || name} (${runId})`);
    this.logStep("Inputs", inputs);
    if (tags?.length) this.logStep("Tags", tags);
    if (metadata) this.logStep("Metadata", metadata);
    return this.createRun(runId);
  }

  async handleChainEnd(
    outputs: ChainValues,
    runId: string,
    _parentRunId?: string,
    _tags?: string[],
    kwargs?: { inputs?: Record<string, unknown> }
  ): Promise<Run> {
    this.logSection("Chain Completed", `RunID: ${runId}`);
    this.logStep("Outputs", outputs);
    if (kwargs?.inputs) this.logStep("Original Inputs", kwargs.inputs);
    return this.createRun(runId);
  }

  async handleChainError(
    error: unknown,
    runId: string,
    _parentRunId?: string,
    _tags?: string[],
    kwargs?: { inputs?: Record<string, unknown> }
  ): Promise<Run> {
    this.logSection("Chain Error", `RunID: ${runId}`);
    this.logError(error);
    if (kwargs?.inputs) this.logStep("Original Inputs", kwargs.inputs);
    return this.createRun(runId);
  }

  async handleLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string,
    parentRunId?: string,
    extraParams?: KVMap,
    tags?: string[],
    metadata?: KVMap,
    name?: string
  ): Promise<Run> {
    this.logSection("LLM Started", `Model: ${llm.name || name} (${runId})`);
    this.logStep("Prompts", prompts);
    if (tags?.length) this.logStep("Tags", tags);
    if (metadata) this.logStep("Metadata", metadata);
    if (extraParams) this.logStep("Extra Params", extraParams);
    return this.createRun(runId);
  }

  async handleLLMEnd(
    output: LLMResult,
    runId: string,
    _parentRunId?: string,
    _tags?: string[],
    extraParams?: Record<string, unknown>
  ): Promise<Run> {
    this.logSection("LLM Completed", `RunID: ${runId}`);
    this.logStep("Response", output);
    if (extraParams) this.logStep("Extra Params", extraParams);
    return this.createRun(runId);
  }

  async handleLLMError(
    error: unknown,
    runId: string,
    _parentRunId?: string,
    _tags?: string[],
    extraParams?: Record<string, unknown>
  ): Promise<Run> {
    this.logSection("LLM Error", `RunID: ${runId}`);
    this.logError(error);
    if (extraParams) this.logStep("Extra Params", extraParams);
    return this.createRun(runId);
  }

  async handleToolStart(
    tool: Serialized,
    input: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: KVMap,
    name?: string
  ): Promise<Run> {
    this.logSection("Tool Started", `Tool: ${tool.name || name} (${runId})`);
    this.logStep("Input", input);
    if (tags?.length) this.logStep("Tags", tags);
    if (metadata) this.logStep("Metadata", metadata);
    return this.createRun(runId);
  }

  async handleToolEnd(output: unknown, runId: string): Promise<Run> {
    this.logSection("Tool Completed", `RunID: ${runId}`);
    this.logStep("Output", output);
    return this.createRun(runId);
  }

  async handleToolError(error: unknown, runId: string): Promise<Run> {
    this.logSection("Tool Error", `RunID: ${runId}`);
    this.logError(error);
    return this.createRun(runId);
  }

  async handleAgentAction(action: AgentAction, runId: string): Promise<void> {
    this.logSection("Agent Action", `RunID: ${runId}`);
    this.logStep("Action", {
      tool: action.tool,
      toolInput: action.toolInput,
      log: action.log
    });
  }

  async handleAgentEnd(action: AgentFinish, runId: string): Promise<void> {
    this.logSection("Agent Finished", `RunID: ${runId}`);
    this.logStep("Return Values", action.returnValues);
    if (action.log) {
      this.logStep("Log", action.log);
    }
  }
} 