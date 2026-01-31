# CLAUDE.md

## Project Overview

TypeScript RAG (Retrieval-Augmented Generation) evaluation framework. Currently in the **design/planning phase** — no source code has been implemented yet. The two design documents (`brainstorm.md` and `implementation_plan.md`) contain the full architectural specification.

### Core Concept

Two evaluation paradigms:
- **Chunk-Level**: Evaluates whether correct chunks were retrieved (set-based metrics)
- **Token-Level**: Evaluates character-level precision via span overlap (chunker-independent ground truth)

## Repository Structure

```
├── brainstorm.md           # Architectural design, type definitions, workflows
├── implementation_plan.md  # Step-by-step implementation roadmap with code examples
└── CLAUDE.md               # This file
```

### Planned Source Layout

```
src/
├── types/          # Branded types (DocumentId, ChunkId, etc.), Zod schemas
├── chunkers/       # Chunker interface + implementations (recursive-character, fixed-token, semantic)
├── embedders/      # Embedder interface + OpenAI/Transformers implementations
├── vector-stores/  # VectorStore interface + Chroma implementation
├── rerankers/      # Reranker interface + Cohere implementation
├── synthetic-datagen/  # LLM-powered ground truth generation (chunk-level & token-level)
├── evaluation/     # Orchestrators + metrics (recall, precision, F1, IoU)
├── langsmith/      # LangSmith dataset upload/download
└── utils/          # Hashing, text processing, span utilities
```

## Technology Stack

- **Language**: TypeScript 5.4+ / Node.js >=18
- **Package manager**: pnpm
- **Build**: tsup (ESM + CJS)
- **Test**: Vitest
- **Lint**: ESLint 9.0 + Prettier 3.2
- **Typecheck**: `tsc --noEmit` (strict mode)
- **Validation**: Zod ^3.23

## Commands

```bash
pnpm build          # Build with tsup
pnpm dev            # Build in watch mode
pnpm test           # Run tests (vitest run)
pnpm test:watch     # Tests in watch mode
pnpm test:coverage  # Tests with v8 coverage
pnpm lint           # Lint src and tests
pnpm lint:fix       # Lint with autofix
pnpm format         # Format with Prettier
pnpm typecheck      # Type-check without emitting
```

## Key Design Conventions

- **Branded types** for nominal type safety (`DocumentId`, `ChunkId`, `QueryId`, etc.)
- **Zod schemas** for runtime validation at system boundaries
- **Immutability**: all types use `readonly` properties and `ReadonlyArray`
- **Async-first**: all I/O operations return `Promise<T>`
- **Adapter pattern**: `ChunkerPositionAdapter` wraps plain `Chunker` as `PositionAwareChunker`
- **Lazy-loaded optional deps**: `openai`, `cohere-ai`, `chromadb`, `langsmith` are peer dependencies

## Naming Conventions

- `PascalCase` — classes, interfaces, types
- `camelCase` — functions, variables
- `SCREAMING_SNAKE_CASE` — constants
- ID prefixes: `chunk_`, `pa_chunk_`, `q_`

## Architecture Notes

- Evaluation type (`chunk-level` | `token-level`) is a first-class concept that shapes the entire pipeline
- Token-level ground truth uses `CharacterSpan` (docId, start, end) — independent of chunking strategy
- Chunk-level ground truth uses `ChunkId` sets — tied to a specific chunker
- The implementation plan is organized in phases; follow it sequentially
