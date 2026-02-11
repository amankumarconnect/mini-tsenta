import { Ollama } from 'ollama'

const ollama = new Ollama()
const MODEL_GENERATION = 'gemma3:4b'
const MODEL_EMBEDDING = 'qwen3-embedding:0.6b'

// Simple in-memory cache for job titles to save inference time
const MAX_CACHE_SIZE = 100
const jobTitleCache = new Map<string, { relevant: boolean; score: number }>()

// Configurable thresholds for similarity
// 0.4 is a common baseline for semantic similarity, but tune as needed.
const TITLE_THRESHOLD = 0.45

/**
 * Calculates the cosine similarity between two vectors.
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0)
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0))
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0))
  if (magnitudeA === 0 || magnitudeB === 0) return 0
  return dotProduct / (magnitudeA * magnitudeB)
}

/**
 * Generates an embedding for the given text using the embedding model.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  try {
    const response = await ollama.embed({
      model: MODEL_EMBEDDING,
      input: text
    })
    // response.embeddings is an array of arrays (one for each input string)
    // since we only pass one string, we take the first element.
    return response.embeddings[0]
  } catch (error) {
    console.error('Ollama embedding error:', error)
    return []
  }
}

/**
 * Quick check: is the job title relevant to what the user is looking for?
 * This avoids navigating to job pages that are clearly not a fit.
 * Uses embedding similarity.
 */
export async function isJobTitleRelevant(
  jobTitle: string,
  userProfileEmbedding: number[]
): Promise<{ relevant: boolean; score: number }> {
  // Check cache first
  const cacheKey = `${jobTitle.trim()}|${userProfileEmbedding.length}` // approximate key
  if (jobTitleCache.has(cacheKey)) {
    return jobTitleCache.get(cacheKey)!
  }

  try {
    const titleEmbedding = await getEmbedding(jobTitle)

    if (titleEmbedding.length === 0 || userProfileEmbedding.length === 0) {
      console.warn('[AI Title Check] Failed to get embeddings, defaulting to TRUE')
      return { relevant: true, score: -1 }
    }

    const similarity = cosineSimilarity(titleEmbedding, userProfileEmbedding)
    const isRelevant = similarity >= TITLE_THRESHOLD

    console.log(
      `[AI Title Check] "${jobTitle}" vs Profile -> Similarity: ${similarity.toFixed(4)} -> ${
        isRelevant ? 'RELEVANT' : 'SKIP'
      }`
    )

    const result = { relevant: isRelevant, score: Math.round(similarity * 100) }

    // Update cache
    if (jobTitleCache.size >= MAX_CACHE_SIZE) {
      const firstKey = jobTitleCache.keys().next().value
      if (firstKey) jobTitleCache.delete(firstKey)
    }
    jobTitleCache.set(cacheKey, result)

    return result
  } catch (error) {
    console.error('Ollama isJobTitleRelevant error:', error)
    // On error, default to checking the job — don't skip it
    return { relevant: true, score: -1 }
  }
}

// Slightly lower threshold for full descriptions as they contain more noise
const DESCRIPTION_THRESHOLD = 0.45

/**
 * Determines if a job is relevant based on the full job description and user's stated preferences.
 * Uses embedding similarity.
 */
export async function isJobRelevant(
  jobDescription: string,
  userProfileEmbedding: number[]
): Promise<{ relevant: boolean; score: number }> {
  try {
    const descriptionEmbedding = await getEmbedding(jobDescription)

    if (descriptionEmbedding.length === 0 || userProfileEmbedding.length === 0) {
      console.warn('[AI Job Check] Failed to get embeddings, defaulting to TRUE')
      return { relevant: true, score: -1 }
    }

    const similarity = cosineSimilarity(descriptionEmbedding, userProfileEmbedding)
    const isRelevant = similarity >= DESCRIPTION_THRESHOLD

    console.log(
      `[AI Job Check] Similarity: ${similarity.toFixed(4)} -> ${isRelevant ? 'GOOD FIT' : 'NOT A FIT'}`
    )

    return { relevant: isRelevant, score: Math.round(similarity * 100) }
  } catch (error) {
    console.error('Ollama isJobRelevant error:', error)
    // On error, default to checking the job — don't skip it
    return { relevant: true, score: -1 }
  }
}

/**
 * Generates a personalized application/cover letter based on job and user profile
 */
export async function generateApplication(
  jobDescription: string,
  userProfile: string
): Promise<string> {
  const prompt = `You are a job applicant writing a cover letter. Write a professional, personalized, and concise application based on the job description and user profile below. Do not include any headers, greetings, or sign-offs — just the body text.

USER PROFILE:
${userProfile}

JOB DESCRIPTION:
${jobDescription}

Write the application now:`

  try {
    const response = await ollama.chat({
      model: MODEL_GENERATION,
      messages: [{ role: 'user', content: prompt }],
      options: { temperature: 0.7 }
    })
    return (
      response.message.content.trim() ||
      'Hi! I am interested in this role and believe my skills would be a great fit for your team.'
    )
  } catch (error) {
    console.error('Ollama generateApplication error:', error)
    return `Hi! I'm interested in this role. Based on my experience and skills, I believe I would be a great fit for your team.`
  }
}

/**
 * Generates a "Target Job Persona" from the resume text using an LLM.
 * This persona is used to generate a better embedding for job matching.
 */
export async function generateJobPersona(resumeText: string): Promise<string> {
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
${resumeText}`

  try {
    const response = await ollama.chat({
      model: MODEL_GENERATION,
      messages: [{ role: 'user', content: prompt }],
      options: { temperature: 0.3 }
    })
    return response.message.content.trim()
  } catch (error) {
    console.error('Ollama generateJobPersona error:', error)
    return resumeText // Fallback to original text
  }
}
