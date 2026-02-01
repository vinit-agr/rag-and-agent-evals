import { NextRequest } from "next/server";
import {
  corpusFromFolder,
  createCorpus,
  createDocument,
  RecursiveCharacterChunker,
  openAIClientAdapter,
  SimpleStrategy,
  generate,
  generateChunkId,
} from "rag-evaluation-system";
import type { ChunkLevelGroundTruth, TokenLevelGroundTruth } from "rag-evaluation-system";

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "OPENAI_API_KEY environment variable is required",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let config;
  try {
    config = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const {
    folderPath,
    mode,
    questionsPerDoc = 10,
    chunkSize = 1000,
    chunkOverlap = 200,
  } = config;

  if (!folderPath || !mode) {
    return new Response(
      JSON.stringify({ error: "folderPath and mode are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      }

      try {
        const { default: OpenAI } = await import("openai");
        const openai = new OpenAI();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const llm = openAIClientAdapter(openai as any);

        const corpus = await corpusFromFolder(folderPath, "**/*.md");
        if (corpus.documents.length === 0) {
          send({ type: "error", error: "No markdown files found" });
          controller.close();
          return;
        }

        const strategy = new SimpleStrategy({ queriesPerDoc: questionsPerDoc });
        let totalQuestions = 0;

        if (mode === "chunk") {
          const chunker = new RecursiveCharacterChunker({
            chunkSize,
            chunkOverlap,
          });

          // Process per document for streaming
          for (const doc of corpus.documents) {
            const singleCorpus = createCorpus([
              createDocument({ id: String(doc.id), content: doc.content }),
            ]);

            const groundTruth = (await generate({
              strategy,
              evaluationType: "chunk-level",
              corpus: singleCorpus,
              llmClient: llm,
              model: "gpt-4o-mini",
              chunker,
              uploadToLangsmith: false,
            })) as ChunkLevelGroundTruth[];

            const chunks = chunker.chunk(doc.content);
            const chunkMap = new Map<string, string>();
            for (const text of chunks) {
              chunkMap.set(String(generateChunkId(text)), text);
            }

            for (const gt of groundTruth) {
              const chunkData = gt.relevantChunkIds.map((id) => ({
                id: String(id),
                content: chunkMap.get(String(id)) ?? "",
              }));

              send({
                type: "question",
                docId: String(doc.id),
                query: String(gt.query.text),
                relevantChunkIds: gt.relevantChunkIds.map(String),
                chunks: chunkData,
              });
              totalQuestions++;
            }
          }
        } else {
          // Token-level
          for (const doc of corpus.documents) {
            const singleCorpus = createCorpus([
              createDocument({ id: String(doc.id), content: doc.content }),
            ]);

            const groundTruth = (await generate({
              strategy,
              evaluationType: "token-level",
              corpus: singleCorpus,
              llmClient: llm,
              model: "gpt-4o-mini",
              uploadToLangsmith: false,
            })) as TokenLevelGroundTruth[];

            for (const gt of groundTruth) {
              send({
                type: "question",
                docId: String(doc.id),
                query: String(gt.query.text),
                relevantSpans: gt.relevantSpans.map((s) => ({
                  docId: String(s.docId),
                  start: s.start,
                  end: s.end,
                  text: s.text,
                })),
              });
              totalQuestions++;
            }
          }
        }

        send({ type: "done", totalQuestions });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Generation failed";
        send({ type: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
