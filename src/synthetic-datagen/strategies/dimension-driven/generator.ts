import type {
  QuestionStrategy,
  StrategyContext,
  GeneratedQuery,
  DimensionDrivenStrategyOptions,
} from "../types.js";
import { loadDimensions } from "./dimensions.js";
import { filterCombinations } from "./filtering.js";
import { buildRelevanceMatrix } from "./relevance.js";
import { stratifiedSample } from "./sampling.js";

const GENERATION_PROMPT = `You are generating a synthetic user question for evaluating a RAG system.
Generate exactly ONE question that matches the user profile described below and is answerable from the provided document content.

The question should be natural-sounding — something a real user with this profile would actually type or ask.

Do NOT copy-paste or trivially rephrase the document text.

Output JSON format:
{
  "question": "..."
}`;

export class DimensionDrivenStrategy implements QuestionStrategy {
  readonly name = "dimension-driven";
  private _options: DimensionDrivenStrategyOptions;

  constructor(options: DimensionDrivenStrategyOptions) {
    this._options = options;
  }

  async generate(context: StrategyContext): Promise<GeneratedQuery[]> {
    const dimensions = await loadDimensions(this._options.dimensionsFilePath);

    const validCombos = await filterCombinations(
      dimensions,
      context.llmClient,
      context.model,
    );

    const matrix = await buildRelevanceMatrix(
      context.corpus,
      validCombos,
      context.llmClient,
      context.model,
    );

    const sampled = stratifiedSample(
      matrix.assignments,
      this._options.totalQuestions,
    );

    const results: GeneratedQuery[] = [];

    for (const assignment of sampled) {
      const doc = context.corpus.documents.find(
        (d) => String(d.id) === assignment.docId,
      );
      if (!doc) continue;

      const profileDesc = Object.entries(assignment.combo)
        .map(([dim, val]) => `- ${dim}: ${val}`)
        .join("\n");

      const prompt = `User profile:\n${profileDesc}\n\nDocument content:\n${doc.content.substring(0, 6000)}\n\nGenerate one question matching this profile.`;

      const response = await context.llmClient.complete({
        model: context.model,
        messages: [
          { role: "system", content: GENERATION_PROMPT },
          { role: "user", content: prompt },
        ],
        responseFormat: "json",
      });

      const data = JSON.parse(response);
      const question: string = data.question ?? "";
      if (!question) continue;

      const metadata: Record<string, string> = {
        strategy: "dimension-driven",
        ...Object.fromEntries(
          Object.entries(assignment.combo).map(([k, v]) => [k, String(v)]),
        ),
      };

      results.push({
        query: question,
        targetDocId: assignment.docId,
        metadata,
      });
    }

    return results;
  }
}
