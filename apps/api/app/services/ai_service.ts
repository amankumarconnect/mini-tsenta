import { Ollama } from "ollama";
import prisma from "#services/prisma";
import { createHash } from "node:crypto";

// Service to handle AI operations using Ollama.
export class AiService {
  private ollama: Ollama;
  private modelGeneration: string;
  private modelEmbedding: string;
  private titleThreshold = 0.45; // Similarity threshold for job titles.
  private descriptionThreshold = 0.45; // Similarity threshold for job descriptions.

  constructor() {
    // Initialize Ollama client with host from env or default.
    this.ollama = new Ollama({
      host: process.env.OLLAMA_HOST || "http://127.0.0.1:11434",
    });
    this.modelGeneration = process.env.OLLAMA_MODEL_GENERATION || "gemma3:4b";
    this.modelEmbedding =
      process.env.OLLAMA_MODEL_EMBEDDING || "qwen3-embedding:0.6b";
  }

  // Calculate Cosine Similarity between two vectors.
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }

  // Normalize text for embedding (remove extra whitespace).
  private normalizeEmbeddingText(text: string): string {
    return text.trim().replace(/\s+/g, " ");
  }

  // Generate a SHA-256 hash of the normalized text for caching.
  private getEmbeddingHash(normalizedText: string): string {
    return createHash("sha256").update(normalizedText).digest("hex");
  }

  // Retrieve cached embedding or generate a new one if not found.
  async getOrCreateCachedEmbedding(text: string): Promise<number[]> {
    const normalizedText = this.normalizeEmbeddingText(text);
    if (!normalizedText) return [];

    const textHash = this.getEmbeddingHash(normalizedText);

    // check cache
    const cached = await prisma.jobTextEmbedding.findUnique({
      where: {
        model_textHash: {
          model: this.modelEmbedding,
          textHash,
        },
      },
      select: {
        embedding: true,
      },
    });

    if (cached && Array.isArray(cached.embedding)) {
      return cached.embedding as number[]; // Cast to number array.
    }

    // Generate new embedding if not in cache.
    const embedding = await this.getEmbedding(normalizedText);
    if (embedding.length === 0) {
      return [];
    }

    // Persist new embedding to cache.
    try {
      await prisma.jobTextEmbedding.upsert({
        where: {
          model_textHash: {
            model: this.modelEmbedding,
            textHash,
          },
        },
        create: {
          model: this.modelEmbedding,
          textHash,
          normalizedText,
          embedding,
        },
        update: {
          normalizedText,
          embedding,
        },
      });
    } catch (error) {
      console.error("Failed to persist job embedding cache:", error);
    }

    return embedding;
  }

  // Generate vector embedding for text using Ollama.
  async getEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.ollama.embed({
        model: this.modelEmbedding,
        input: text,
      });
      return response.embeddings[0]; // Return the first embedding.
    } catch (error) {
      console.error("Ollama embedding error:", error);
      return [];
    }
  }

  // Check if a job title matches the user's profile embedding.
  async isJobTitleRelevant(
    jobTitle: string,
    userProfileEmbedding: number[],
  ): Promise<{ relevant: boolean; score: number }> {
    try {
      const titleEmbedding = await this.getOrCreateCachedEmbedding(jobTitle);

      if (titleEmbedding.length === 0 || userProfileEmbedding.length === 0) {
        return { relevant: true, score: -1 }; // Indeterminate relevance.
      }

      const similarity = this.cosineSimilarity(
        titleEmbedding,
        userProfileEmbedding,
      );
      const isRelevant = similarity >= this.titleThreshold;

      return {
        relevant: isRelevant,
        score: Math.round(similarity * 100),
      };
    } catch (error) {
      console.error("Ollama isJobTitleRelevant error:", error);
      return { relevant: true, score: -1 };
    }
  }

  // Check if a job description matches the user's profile embedding.
  async isJobRelevant(
    jobDescription: string,
    userProfileEmbedding: number[],
  ): Promise<{ relevant: boolean; score: number }> {
    try {
      const descriptionEmbedding =
        await this.getOrCreateCachedEmbedding(jobDescription);

      if (
        descriptionEmbedding.length === 0 ||
        userProfileEmbedding.length === 0
      ) {
        return { relevant: true, score: -1 };
      }

      const similarity = this.cosineSimilarity(
        descriptionEmbedding,
        userProfileEmbedding,
      );
      const isRelevant = similarity >= this.descriptionThreshold;

      return { relevant: isRelevant, score: Math.round(similarity * 100) };
    } catch (error) {
      console.error("Ollama isJobRelevant error:", error);
      return { relevant: true, score: -1 };
    }
  }

  // Generate a customized cover letter/application message.
  async generateApplication(
    jobDescription: string,
    userProfile: string,
  ): Promise<string> {
    const prompt = `You are a job applicant writing a cover letter. Write a professional, personalized, and concise application based on the job description and user profile below. Do not include any headers, greetings, or sign-offs — just the body text.

USER PROFILE:
${userProfile}

JOB DESCRIPTION:
${jobDescription}

Write the application now:`;

    try {
      const response = await this.ollama.chat({
        model: this.modelGeneration,
        messages: [{ role: "user", content: prompt }],
        options: { temperature: 0.7 },
      });
      return (
        response.message.content.trim() ||
        "Hi! I am interested in this role and believe my skills would be a great fit for your team."
      );
    } catch (error) {
      console.error("Ollama generateApplication error:", error);
      return `Hi! I'm interested in this role. Based on my experience and skills, I believe I would be a great fit for your team.`;
    }
  }

  // Generate a "Job Persona" (ideal job description) from the user's resume.
  async generateJobPersona(resumeText: string): Promise<string> {
    const prompt = `### ROLE
You are an expert Career Coach and Technical Recruiter with 20+ years of experience in matching candidates to their ideal roles.

### TASK
I will provide you with a candidate's RESUME.
Your goal is to write a **Hypothetical Job Description** that represents the **perfect, realistic next step** for this specific candidate. This text will be vector-embedded to search for matching jobs.

### CRITICAL INSTRUCTIONS (Follow in Order)

1. **Analyze Seniority (The Filter):**
   - **Student/Fresher:** If Education ends in the future (e.g., 2026+) OR experience is < 1 year, the target role **MUST** be "Intern", "Trainee", or "Entry-Level".
   - **Junior/Mid:** If experience is 1-4 years, the target role is "Developer", "Associate", or "Engineer".
   - **Senior/Lead:** If experience is 5+ years, the target role is "Senior", "Lead", or "Manager".
   - **Pivot:** If the candidate's recent projects/degrees differ from their past work history, prioritize the **NEW** skills (e.g., a Sales Manager pivoting to Data Science).

2. **Extract the "Power Keywords":**
   - Identify the top 3-5 hard skills they *actually* used in projects/work (not just listed in a "Skills" section).
   - Identify their domain focus (e.g., "Fintech", "Healthtech", "E-commerce") if apparent.

3. **Draft the Target Job Description:**
   - Write it from the employer's perspective ("We are looking for...").
   - Use standard industry terminology.
   - **Crucial:** Include constraints that match the user's resume (e.g., "Remote", "India", "Visa Sponsorship" if mentioned, or specific certifications).

### OUTPUT FORMAT
Return **ONLY** the hypothetical Job Description paragraph. Do not output your thinking process or JSON. Just the text to be embedded.

---

### INPUT RESUME
${resumeText}`;

    try {
      const response = await this.ollama.chat({
        model: this.modelGeneration,
        messages: [{ role: "user", content: prompt }],
        options: { temperature: 0.3 },
      });
      return response.message.content.trim();
    } catch (error) {
      console.error("Ollama generateJobPersona error:", error);
      return resumeText;
    }
  }
}
