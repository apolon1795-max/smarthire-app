
export type TestType = 'intelligence' | 'conscientiousness' | 'motivation' | 'sjt' | 'work_sample';

export interface Option {
  id: string;
  text: string;
  value: number;
}

export interface Question {
  id: string;
  text: string;
  type: 'single-choice' | 'likert' | 'scenario' | 'text';
  options?: Option[];
  imageUrl?: string; 
}

export interface TestSection {
  id: TestType;
  title: string;
  description: string;
  timeLimitMinutes?: number;
  displayMode: 'step' | 'scroll';
  scaleMax?: number;
  questions: Question[];
}

export interface BenchmarkData {
  iq: number;
  hexaco: Record<string, number>; // Factor code -> average (1-5)
  drivers: string[]; // Names of top 3 drivers
}

export interface CustomTestConfig {
  jobId: string;
  jobTitle: string;
  company: string; // Added for multi-tenancy
  sjtQuestions: Question[];
  workSampleQuestion: Question;
  benchmark?: BenchmarkData; 
}

export interface UserAnswers {
  [questionId: string]: number | string;
}

export interface HexacoScore {
  factor: string;
  code: string;
  rawScore: number;
  questionCount: number;
  average: number;
  percentage: number;
}

export interface ValueScore {
  name: string;
  code: string;
  score: number;
}

export interface BlockScore {
  name: string;
  score: number;
  description?: string;
}

export interface DriverScore {
  name: string;
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

export interface ValidityProfile {
  attentionPassed: boolean;
  lieScore: number;
  statusLabel: string;
}

export interface TestResult {
  sectionId: TestType;
  title: string;
  rawScore: number;
  maxScore: number;
  percentage: number;
  answers?: UserAnswers; 
  hexacoProfile?: HexacoScore[]; 
  motivationProfile?: MotivationProfile; 
  validityProfile?: ValidityProfile;
  textAnswer?: string;
}

export interface CandidateInfo {
  name: string;
  age: string;
  department: string;
  role: string;
}

export interface JobListing {
  jobId: string;
  jobTitle: string;
  company: string; // Added for filtering
  dateCreated: string;
  hasBenchmark: boolean;
}
