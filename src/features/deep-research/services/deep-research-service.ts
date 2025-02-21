import { DeepResearchInput, DeepResearchResponse, ResearchEvent } from '../types/deep-research-types';

const LANGGRAPH_SERVER_URL = process.env.NEXT_PUBLIC_LANGGRAPH_SERVER_URL || 'http://localhost:2024';

export class DeepResearchService {
  private static currentSessionId: string | null = null;

  private static async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' = 'POST',
    body?: unknown,
    onEvent?: (event: ResearchEvent) => void
  ): Promise<void> {
    let abortController: AbortController | null = null;
    
    try {
      console.log(`Making request to ${endpoint}`, { method, body });
      abortController = new AbortController();
      const response = await fetch(`${LANGGRAPH_SERVER_URL}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('HTTP error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let retryCount = 0;
      const MAX_RETRIES = 3;

      while (true) {
        try {
          const { value, done } = await reader.read();
          
          if (done) {
            console.log('Stream completed naturally');
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          console.log('Received chunk:', chunk);
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            console.log('Processing line:', line);
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                console.log('Stream completed with [DONE] message');
                return;
              }
              try {
                console.log('Parsing event data:', data);
                const event = JSON.parse(data);
                console.log('Parsed event:', event);
                
                // Ensure event has required properties
                if (!event.type) {
                  console.warn('Event missing type:', event);
                  event.type = 'progress';
                }

                // Handle different event types
                switch (event.type) {
                  case 'interrupt':
                    console.log('Processing interrupt event');
                    if (!event.requires_feedback) {
                      event.requires_feedback = true;
                    }
                    break;
                  case 'progress':
                    console.log('Processing progress event');
                    // Ensure progress events have minimum required fields
                    if (!event.content && !event.thought && !event.source) {
                      console.warn('Progress event missing content:', event);
                    }
                    break;
                  case 'error':
                    console.error('Error event received:', event);
                    break;
                  default:
                    console.warn('Unknown event type:', event.type);
                }

                console.log('Calling onEvent handler with:', event);
                onEvent?.(event);
                retryCount = 0; // Reset retry count on successful event
              } catch (e) {
                console.error('Failed to parse event:', e, 'Raw data:', data);
                retryCount++;
                if (retryCount >= MAX_RETRIES) {
                  throw new Error('Max retry attempts reached for parsing events');
                }
              }
            }
          }
        } catch (error) {
          console.error('Error in stream processing:', error);
          if (error instanceof Error && error.name === 'AbortError') {
            console.log('Stream aborted');
            break;
          }
          throw error;
        }
      }
    } catch (error) {
      console.error('Stream error:', error);
      // Send error event to client
      onEvent?.({
        type: 'error',
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    } finally {
      if (abortController) {
        abortController.abort();
      }
    }
  }

  public static async research(
    input: DeepResearchInput,
    onEvent?: (event: ResearchEvent) => void
  ): Promise<DeepResearchResponse> {
    try {
      // Reset session ID for new research
      this.currentSessionId = null;
      await this.makeRequest('/api/research', 'POST', input, (event) => {
        // Track session ID from events
        if ('session_id' in event && typeof event.session_id === 'string') {
          this.currentSessionId = event.session_id;
        }
        onEvent?.(event);
      });
      return { success: true };
    } catch (error) {
      console.error('Failed to perform research:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      };
    }
  }

  public static async provideFeedback(
    feedback: boolean | string,
    onEvent?: (event: ResearchEvent) => void
  ): Promise<DeepResearchResponse> {
    try {
      if (!this.currentSessionId) {
        throw new Error('No active session found. Please start a new research query.');
      }
      console.log('Providing feedback:', feedback);
      await this.makeRequest(
        '/api/research/feedback',
        'POST',
        { feedback, sessionId: this.currentSessionId },
        onEvent
      );
      return { success: true };
    } catch (error) {
      console.error('Failed to provide feedback:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      };
    }
  }
} 