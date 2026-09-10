import { parseQuestionAnalysis } from './question-analysis';
import { demandInput, initialDemand } from './demand-selection';
/** Valid synthetic request fixture for transport checks, never a malformed-output adapter. */
export const planTestInput = (question = 'Explain a synthetic conceptual distinction.') => ({ original_question: question, question_analysis: demandInput(initialDemand(parseQuestionAnalysis({operation:'explain',parts:[{id:'q1',start_token:0,kind:'request',requirements:[{kind:'definition',subject:'accounting_methods'}],ambiguity_context_ids:[]}]},question)),question) });
