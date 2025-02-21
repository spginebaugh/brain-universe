# Deep Research Service

This service integrates the Open Deep Research tool from LangChain AI to provide advanced research-based roadmap generation.

## Requirements

- Python 3.11 or higher
- Node.js 18 or higher

## Environment Variables

Create a `.env` file in this directory with the following variables:

```bash
# API Keys
TAVILY_API_KEY=your_tavily_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key

# Server Configuration
PORT=3001
HOST=0.0.0.0
```

Make sure to add `.env` to your `.gitignore` file to prevent committing sensitive information.

## Setup

1. Create and activate virtual environment:
```bash
# From this directory
python -m venv .venv

# Activate on Unix/macOS
source .venv/bin/activate
# OR on Windows
.venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

## Running the Servers

You can run either the FastAPI server for the Next.js integration, or the LangGraph Studio UI for visualization, or both:

### FastAPI Server (for Next.js integration)

```bash
python deep_research_server.py
```

The server will start on port 3001.

### LangGraph Studio UI (for visualization)

```bash
python langgraph_server.py
```

This will start the LangGraph server and open these URLs:
- 🚀 API: http://127.0.0.1:2024
- 🎨 Studio UI: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
- 📚 API Docs: http://127.0.0.1:2024/docs

## API Endpoints

### POST /generate-roadmap

Generates a new roadmap based on a topic.

Request body:
```json
{
  "topic": "string",
  "search_api": "tavily",
  "planner_provider": "openai",
  "max_search_depth": 1,
  "planner_model": "o3-mini"
}
```

### POST /provide-feedback

Provides feedback on a roadmap plan.

Request body:
```json
{
  "thread_id": "string",
  "feedback": "string | boolean"
}
```

## Development

- Format code: `black .`
- Sort imports: `isort .`
- Lint: `ruff .`
- Type check: `mypy .`
- Run tests: `pytest` 