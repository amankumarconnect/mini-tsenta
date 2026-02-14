import { init, getAuthToken } from '@heyputer/puter.js/src/init.cjs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let puter: any = null

export async function initPuter(): Promise<void> {
  if (puter) return

  try {
    console.log('[Puter] Authenticating...')
    // This triggers a browser-based login flow if no token is found
    const authToken = await getAuthToken()
    puter = init(authToken)
    console.log('[Puter] authenticated successfully!')
  } catch (error) {
    console.error('[Puter] Authentication failed:', error)
    // Fallback? Or just let it fail. The app needs this to work.
  }
}

// Reuse the cache logic from ollama.ts but for LLM responses
const MAX_CACHE_SIZE = 100
const jobTitleCache = new Map<string, { relevant: boolean; score: number }>()

interface RelevanceResult {
  relevant: boolean
  score: number
}

// Since we don't have embeddings, we ask the LLM directly.
// To save tokens/time, we cache results.
export async function isJobTitleRelevant(
  jobTitle: string,
  userProfileText: string // We use the text or persona, not embedding
): Promise<RelevanceResult> {
  if (!puter) await initPuter()

  const cacheKey = `${jobTitle.trim()}|${userProfileText.length}`
  if (jobTitleCache.has(cacheKey)) {
    return jobTitleCache.get(cacheKey)!
  }

  const prompt = `
  Role: Career Coach.
  Task: Evaluate if the Job Title matches the Candidate's Profile.
  
  Candidate Profile Summary:
  "${userProfileText.slice(0, 500)}..." (truncated for brevity)
  
  Job Title: "${jobTitle}"
  
  Output: JSON only. { "relevant": true/false, "score": 0-100 }
  "relevant" should be true if the job is a reasonable fit or a slight stretch.
  "score" is 0-100 confidence.
  `

  try {
    const response = await puter.ai.chat(prompt, { model: 'gpt-4o-mini' })
    const text = response?.message?.content?.trim() || ''

    // Parse JSON from the response (it might be wrapped in markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const jsonStr = jsonMatch ? jsonMatch[0] : text

    let result: RelevanceResult = { relevant: true, score: 50 } // Default to true if parse fails

    try {
      const parsed = JSON.parse(jsonStr)
      result = {
        relevant: !!parsed.relevant,
        score: typeof parsed.score === 'number' ? parsed.score : 50
      }
    } catch {
      console.warn('[Puter] Failed to parse JSON response for title check, defaulting to true.')
    }

    console.log(
      `[AI Title Check] "${jobTitle}" -> ${result.relevant ? 'Relevant' : 'Skip'} (${result.score})`
    )

    if (jobTitleCache.size >= MAX_CACHE_SIZE) {
      const firstKey = jobTitleCache.keys().next().value
      if (firstKey) jobTitleCache.delete(firstKey)
    }
    jobTitleCache.set(cacheKey, result)

    return result
  } catch (error) {
    console.error('[Puter] isJobTitleRelevant error:', error)
    return { relevant: true, score: -1 } // Default to allow if service fails
  }
}

export async function isJobRelevant(
  jobDescription: string,
  userProfileText: string
): Promise<RelevanceResult> {
  if (!puter) await initPuter()

  const prompt = `
    Role: Senior Tech Recruiter.
    Task: Assess if this Job Description is a good match for the Candidate.

    Candidate Profile:
    ${userProfileText}

    Job Description:
    ${jobDescription.slice(0, 2000)}

    Output: JSON only. { "relevant": true/false, "score": 0-100 }
    `

  try {
    const response = await puter.ai.chat(prompt, { model: 'gpt-4o-mini' })
    const text = response?.message?.content?.trim() || ''

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const jsonStr = jsonMatch ? jsonMatch[0] : text

    try {
      const parsed = JSON.parse(jsonStr)
      return {
        relevant: !!parsed.relevant,
        score: typeof parsed.score === 'number' ? parsed.score : 50
      }
    } catch {
      return { relevant: true, score: 50 }
    }
  } catch (error) {
    console.error('[Puter] isJobRelevant error:', error)
    return { relevant: true, score: -1 }
  }
}

export async function generateApplication(
  jobDescription: string,
  userProfile: string
): Promise<string> {
  if (!puter) await initPuter()

  const prompt = `You are a job applicant writing a cover letter. Write a professional, personalized, and concise application based on the job description and user profile below. Do not include any headers, greetings, or sign-offs — just the body text.

USER PROFILE:
${userProfile}

JOB DESCRIPTION:
${jobDescription}

Write the application now:`

  try {
    const response = await puter.ai.chat(prompt, { model: 'gpt-4o' })
    return (
      response?.message?.content?.trim() ||
      'Hi! I am interested in this role and believe my skills would be a great fit for your team.'
    )
  } catch (error) {
    console.error('[Puter] generateApplication error:', error)
    return 'Hi! I am interested in this role and believe my skills would be a great fit for your team.'
  }
}

export async function generateJobPersona(resumeText: string): Promise<string> {
  if (!puter) await initPuter()

  const prompt = `
   Role: Career Coach.
   Task: Summarize this resume into a "Candidate Persona" for job matching.
   Highlight key skills, experience level (Junior/Senior), and preferred roles.
   
   Resume:
   ${resumeText.slice(0, 3000)}
   
   Output: A concise paragraph describing the ideal role for this candidate.
   `

  try {
    const response = await puter.ai.chat(prompt, { model: 'gpt-4o-mini' })
    return response?.message?.content?.trim() || resumeText.slice(0, 500)
  } catch (error) {
    console.error('[Puter] generateJobPersona error:', error)
    return resumeText.slice(0, 500)
  }
}
