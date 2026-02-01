# CLAUDE.md

## Project overview

RAG Evaluation System — a TypeScript library + Next.js frontend for evaluating RAG retrieval pipelines. Supports chunk-level (chunk ID matching) and token-level (character span matching) evaluation paradigms, with synthetic question generation and a visual inspection UI.

## Repository structure

```
src/                          # Core library (TypeScript, published as rag-evaluation-system)
  types/                      # Branded types, primitives, document/corpus interfaces
  chunkers/                   # Chunker interface + RecursiveCharacterChunker
  embedders/                  # Embedder interface (OpenAI implementation at embedders/openai)
  vector-stores/              # VectorStore interface (InMemory, Chroma at vector-stores/chroma)
  rerankers/                  # Reranker interface (Cohere at rerankers/cohere)
  metrics/                    # Evaluation metrics (chunk recall/precision/F1, span recall/precision/IoU)
  evaluation/                 # Orchestrators: ChunkLevelEvaluation, TokenLevelEvaluation
  synthetic-datagen/          # Synthetic question generation
    strategies/               # Question generation strategies
      simple/                 # SimpleStrategy — prompt-based, N questions per doc
      dimension-driven/       # DimensionDrivenStrategy — dimension discovery, filtering, relevance, sampling
    ground-truth/             # Ground truth assigners (chunk-level, token-level)
    chunk-level/              # Legacy generator (re-exported for backward compat)
    token-level/              # Legacy generator (re-exported for backward compat)
  langsmith/                  # LangSmith upload/load utilities

frontend/                     # Next.js 16 app (Tailwind CSS v4, dark theme)
  src/app/                    # App router pages and API routes
    api/generate/             # SSE streaming endpoint for question generation
    api/discover-dimensions/  # Dimension auto-discovery endpoint
    api/corpus/               # Corpus loading endpoint
    api/browse/               # Folder browser endpoint
  src/components/             # UI components
  src/lib/                    # Shared types

tests/                        # Vitest test suites
openspec/                     # OpenSpec change management artifacts
```

## Key commands

```bash
# Root (library)
npm run build          # Build library with tsup (outputs to dist/)
npm run test           # Run vitest tests
npm run typecheck      # TypeScript check

# Frontend
cd frontend
pnpm install           # Install deps (links to parent package via file:..)
pnpm dev               # Next.js dev server on localhost:3000
npx next build         # Production build (good for verifying TypeScript)
```

## Development workflow

After changing library code in `src/`:
1. `npm run build` at project root (rebuilds dist/)
2. `cd frontend && pnpm install` (re-links the package)
3. Restart the Next.js dev server (Turbopack caches resolved modules)

## Environment

- `OPENAI_API_KEY` required in `frontend/.env` for generation and dimension discovery
- Node >= 18, pnpm for package management
- TypeScript strict mode, ESM (`"type": "module"`)

## Architecture notes

### Synthetic data generation

Two strategies, selectable from the frontend:

- **SimpleStrategy**: Prompt-based. Generates N questions per document.
- **DimensionDrivenStrategy**: Structured diversity. Pipeline: load dimensions → pairwise filter combinations → summarize docs → build relevance matrix → stratified sample → batch generate per document. Accepts `onProgress` callback for streaming phase events.

Both strategies produce `GeneratedQuery[]`, which are then passed to a ground-truth assigner (chunk-level or token-level) to create labeled evaluation data.

LLM calls in the dimension-driven pipeline are parallelized with `Promise.all` (filtering, summarization, assignment batches).

### Frontend

- State managed in `page.tsx` via React hooks (no global state library)
- SSE streaming for real-time question generation with phase progress events
- Dimension config persisted to localStorage (`rag-eval:dimension-config`)
- Design system: dark theme, JetBrains Mono, custom color tokens (accent: `#6ee7b7`)

### Testing

- Unit tests in `tests/unit/` with vitest
- Mock LLM clients for testing strategies (return canned JSON responses)
- 22 tests covering strategies, ground-truth assigners, and legacy generators
