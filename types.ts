
export type TestType = 'intelligence' | 'conscientiousness' | 'motivation' | 'sjt' | 'work_sample';

export interface Option {
  id: string;
  text: string;
  value: number; // Score value for this option
}

export interface Question {
  id: string;
  text: string;
  type: 'single-choice' | 'likert' | 'scenario' | 'text'; // Added scenario & text
  options?: Option[]; // Optional for likert (implied 1-5)
  imageUrl?: string; 
}

export interface TestSection {
  id: TestType;
  title: string;
  description: string;
  timeLimitMinutes?: number;
  displayMode: 'step' | 'scroll'; // 'step' for IQ, 'scroll' for personality
  scaleMax?: number; // Added for Motivation test (1-6 scale)
  questions: Question[];
}

export interface CustomTestConfig {
  jobId: string;
  jobTitle: string;
  sjtQuestions: Question[];
  workSampleQuestion: Question;
}

export interface UserAnswers {
  [questionId: string]: number | string; // Changed to support text answers
}

export interface HexacoScore {
  factor: string;     // e.g., 'Honesty-Humility'
  code: string;       // e.g., 'H'
  rawScore: number;
  questionCount: number;
  average: number;    // 1-5 scale
  percentage: number; // 0-100 scale
}

// --- Motivation Specific Types ---

export interface ValueScore {
  name: string;      // e.g. "Самостоятельность / мысли"
  code: string;      // e.g. "SELF_THOUGHT"
  score: number;
}

export interface BlockScore {
  name: string;      // e.g. "Открытость изменениям"
  score: number;
  description?: string;
}

export interface DriverScore {
  name: string;      // e.g. "Деньги"
  score: number;
  rank: number;
  recommendation?: string;
}

export interface MotivationProfile {
  values: ValueScore[];
  blocks: BlockScore[];
  drivers: DriverScore[];
  topDrivers: DriverScore[];
}

// --- Anti-Fake / Validity Types ---
export interface ValidityProfile {
  attentionPassed: boolean; // Did they follow the instruction "Select 1"?
  lieScore: number;         // Average of social desirability questions (1-5). High > 4 is suspicious.
  statusLabel: string;      // "Valid", "Attention Fail", "Social Desirability Risk"
}

export interface TestResult {
  sectionId: TestType;
  rawScore: number;
  maxScore: number;
  percentage: number;
  answers?: UserAnswers; 
  hexacoProfile?: HexacoScore[]; 
  motivationProfile?: MotivationProfile; 
  validityProfile?: ValidityProfile; // Added for Anti-Fake
  textAnswer?: string; // For Work Sample
}

export interface CandidateInfo {
  name: string;
  age: string;
  department: string;
  role: string;
}
