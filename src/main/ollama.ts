import { Ollama } from 'ollama'

const ollama = new Ollama()
const MODEL_GENERATION = 'qwen2.5:3b'
const MODEL_EMBEDDING = 'qwen3-embedding:0.6b'

// Simple in-memory cache for job titles to save inference time
const MAX_CACHE_SIZE = 100
const jobTitleCache = new Map<string, boolean>()

// Configurable thresholds for similarity
// 0.4 is a common baseline for semantic similarity, but tune as needed.
const TITLE_THRESHOLD = 0.4

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
async function getEmbedding(text: string): Promise<number[]> {
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
export async function isJobTitleRelevant(jobTitle: string, userProfile: string): Promise<boolean> {
  // Check cache first
  const cacheKey = `${jobTitle.trim()}|${userProfile}`
  if (jobTitleCache.has(cacheKey)) {
    return jobTitleCache.get(cacheKey)!
  }

  try {
    const [titleEmbedding, profileEmbedding] = await Promise.all([
      getEmbedding(jobTitle),
      getEmbedding(userProfile)
    ])

    if (titleEmbedding.length === 0 || profileEmbedding.length === 0) {
      console.warn('[AI Title Check] Failed to get embeddings, defaulting to TRUE')
      return true
    }

    const similarity = cosineSimilarity(titleEmbedding, profileEmbedding)
    const isRelevant = similarity >= TITLE_THRESHOLD

    console.log(
      `[AI Title Check] "${jobTitle}" vs Profile -> Similarity: ${similarity.toFixed(4)} -> ${
        isRelevant ? 'RELEVANT' : 'SKIP'
      }`
    )

    // Update cache
    if (jobTitleCache.size >= MAX_CACHE_SIZE) {
      const firstKey = jobTitleCache.keys().next().value
      if (firstKey) jobTitleCache.delete(firstKey)
    }
    jobTitleCache.set(cacheKey, isRelevant)

    return isRelevant
  } catch (error) {
    console.error('Ollama isJobTitleRelevant error:', error)
    // On error, default to checking the job — don't skip it
    return true
  }
}

// Slightly lower threshold for full descriptions as they contain more noise
const DESCRIPTION_THRESHOLD = 0.5

/**
 * Determines if a job is relevant based on the full job description and user's stated preferences.
 * Uses embedding similarity.
 */
export async function isJobRelevant(jobDescription: string, userProfile: string): Promise<boolean> {
  try {
    // Truncate job description if it's too long to avoid context limits (though embeddings handle large contexts well, 
    // performance might degrade or it might capture too much noise).
    // For embeddings, sending the first 2000-3000 chars is usually enough to capture the core of the job.

    const [descriptionEmbedding, profileEmbedding] = await Promise.all([
      getEmbedding(jobDescription),
      getEmbedding(userProfile)
    ])

    if (descriptionEmbedding.length === 0 || profileEmbedding.length === 0) {
      console.warn('[AI Job Check] Failed to get embeddings, defaulting to TRUE')
      return true
    }

    const similarity = cosineSimilarity(descriptionEmbedding, profileEmbedding)
    const isRelevant = similarity >= DESCRIPTION_THRESHOLD

    console.log(
      `[AI Job Check] Similarity: ${similarity.toFixed(4)} -> ${isRelevant ? 'GOOD FIT' : 'NOT A FIT'}`
    )

    return isRelevant
  } catch (error) {
    console.error('Ollama isJobRelevant error:', error)
    // On error, default to checking the job — don't skip it
    return true
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
