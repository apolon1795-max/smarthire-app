
import { GoogleGenAI, Type } from "@google/genai";
import { TestResult, CandidateInfo, CustomTestConfig } from "./types.ts";

// ALWAYS initialize like this
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Актуальный URL вашего Google Script
export const SCRIPT_URL = 'https://script.google.com/macros/s/1lt16LNgMK_vU_CdXBR7AV3FZ0g8ZT6GFq84M5K0oGoQ/exec';

// Fix: Implement missing generateCandidateProfile for automated HR reporting
export async function generateCandidateProfile(results: TestResult[], info: CandidateInfo | null): Promise<string> {
  const prompt = `Generate a professional HR assessment report in Russian for candidate ${info?.name} who is applying for the role of ${info?.role} in the ${info?.department} department.
  
  Test Results Summary:
  ${results.map(r => `${r.title}: ${Math.round(r.percentage)}%`).join('\n')}
  
  Detailed Data:
  ${JSON.stringify(results, null, 2)}
  
  The report should include:
  1. Executive Summary
  2. Core Competencies analysis (soft skills, cognitive, motivation)
  3. Culture Fit assessment
  4. Potential Risks or Development Areas
  5. Final Hiring Recommendation
  
  Format the output as clean HTML without <html> or <body> tags. Use <h3>, <p>, <ul>, <li> tags for structure.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
  });

  return response.text || "Error generating report";
}

// Fix: Implement missing generateCustomQuestions for dynamic job-specific tests
export async function generateCustomQuestions(jobTitle: string, company: string): Promise<CustomTestConfig> {
  const schema = {
    type: Type.OBJECT,
    properties: {
      jobId: { type: Type.STRING },
      jobTitle: { type: Type.STRING },
      company: { type: Type.STRING },
      sjtQuestions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            text: { type: Type.STRING },
            type: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  text: { type: Type.STRING },
                  value: { type: Type.NUMBER }
                },
                required: ['id', 'text', 'value']
              }
            }
          },
          required: ['id', 'text', 'type', 'options']
        }
      },
      workSampleQuestion: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          text: { type: Type.STRING },
          type: { type: Type.STRING }
        },
        required: ['id', 'text', 'type']
      }
    },
    required: ['jobId', 'jobTitle', 'company', 'sjtQuestions', 'workSampleQuestion']
  };

  const prompt = `Create a customized assessment for a ${jobTitle} position at ${company}.
  Generate 3 Situational Judgement Test (SJT) questions specific to this role.
  Each SJT question should have 4 options with point values (0 to 2) based on how professional the response is.
  Also generate 1 Work Sample question (In-Basket exercise) that requires a text response.
  Return everything in Russian. jobId should be generated like JOB-XXXXXX.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  const text = response.text || "{}";
  return JSON.parse(text);
}
