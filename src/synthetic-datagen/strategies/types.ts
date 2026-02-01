import type { Corpus } from "../../types/index.js";
import type { LLMClient } from "../base.js";

export interface GeneratedQuery {
  readonly query: string;
  readonly targetDocId: string;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface StrategyContext {
  readonly corpus: Corpus;
  readonly llmClient: LLMClient;
  readonly model: string;
}

export interface QuestionStrategy {
  readonly name: string;
  generate(context: StrategyContext): Promise<GeneratedQuery[]>;
}

export interface SimpleStrategyOptions {
  readonly queriesPerDoc: number;
}

export interface DimensionDrivenStrategyOptions {
  readonly dimensionsFilePath: string;
  readonly totalQuestions: number;
}

export interface Dimension {
  readonly name: string;
  readonly description: string;
  readonly values: readonly string[];
}

export type DimensionCombo = Readonly<Record<string, string>>;

export interface DocComboAssignment {
  readonly docId: string;
  readonly combo: DimensionCombo;
}

export interface RelevanceMatrix {
  readonly assignments: readonly DocComboAssignment[];
  readonly docSummaries: ReadonlyMap<string, string>;
}
