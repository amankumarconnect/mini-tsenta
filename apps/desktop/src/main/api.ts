const API_BASE_URL = "http://localhost:3333/api"; // Define the base URL for the backend API server.

// Interface defining the structure of a Company object.
export interface Company {
  id: string; // Unique identifier for the company.
  url: string; // The URL of the company's page on Work at a Startup.
  name: string | null; // The name of the company (can be null if not parsed).
  status: string; // The processing status of the company (e.g., 'visited').
  visitedAt: string; // ISO timestamp of when the company was last visited by the automation.
}

// Interface defining the structure of a Job Application object.
export interface Application {
  id: string; // Unique identifier for the application.
  jobTitle: string; // The title of the job applied to/found.
  companyName: string; // The name of the company offering the job.
  jobUrl: string; // The URL of the specific job posting.
  coverLetter: string; // The generated cover letter or the reason for skipping.
  status: string; // Status of the application (e.g., 'applied', 'skipped', 'submitted').
  matchScore: number | null; // AI-generated relevance score for the job.
  appliedAt: string; // ISO timestamp of when the application was recorded.
}

// Variable to store the current user's ID (fetched from the automation session).
let currentUserId: string | null = null;

// Function to update the current user ID.
// This is called when the automation detects the logged-in user on the website.
export const setUserId = (id: string) => {
  currentUserId = id; // Update the module-level variable.
};

// Generic wrapper function for making HTTP requests to the API.
// Handles headers, error checking, and JSON parsing.
async function request<T>(
  endpoint: string, // The API endpoint path (e.g., '/companies').
  options: RequestInit = {}, // Standard fetch options (method, body, etc.).
): Promise<T> {
  // Returns a Promise that resolves to the expected type T.
  const url = `${API_BASE_URL}${endpoint}`; // Construct the full URL.

  // Default headers including Content-Type.
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers, // Merge any custom headers passed in options.
  };

  // If a user ID is set, include it in the headers for authentication/tracking.
  if (currentUserId) {
    (headers as any)["X-User-Id"] = currentUserId;
  }

  // Perform the fetch request.
  const response = await fetch(url, {
    ...options, // Spread the original options.
    headers, // Use the constructed headers.
  });

  // Check if the response was not successful (status code outside 200-299).
  if (!response.ok) {
    const errorBody = await response.text(); // Read the error response body.
    // Throw an error with the status and body content.
    throw new Error(
      `API request failed: ${response.status} ${response.statusText} - ${errorBody}`,
    );
  }

  // Parse and return the JSON response body cast to type T.
  return response.json() as Promise<T>;
}

// Exported object containing API methods for various operations.
export const api = {
  // Check if a company has already been visited/recorded.
  checkCompanyExists: async (url: string) => {
    try {
      const params = new URLSearchParams({ url }); // Create query parameters.
      // Request the backend to search for the company.
      await request<Company>(`/companies/search?${params.toString()}`);
      return true; // If request succeeds, company exists.
    } catch (e: any) {
      // If the API returns a 404, it means the company does not exist in DB.
      if (e.message && e.message.includes("404")) {
        return false;
      }
      throw e; // Re-throw other errors.
    }
  },

  // Create a new company record in the database.
  createCompany: async (data: {
    url: string; // Company URL.
    name: string; // Company Name.
    status: string; // Initial status.
  }) => {
    return request<Company>("/companies", {
      method: "POST", // HTTP POST method.
      body: JSON.stringify(data), // Send data as JSON body.
    });
  },

  // Check if a specific job application has already been processed.
  checkApplicationExists: async (jobUrl: string) => {
    try {
      const params = new URLSearchParams({ jobUrl }); // Create query params.
      // Search for existing application by job URL.
      await request<Application>(`/applications/search?${params.toString()}`);
      return true; // Exists.
    } catch (e: any) {
      if (e.message && e.message.includes("404")) {
        return false; // Does not exist.
      }
      throw e;
    }
  },

  // Record a new job application (or skipped job) in the database.
  createApplication: async (data: {
    jobTitle: string;
    companyName: string;
    jobUrl: string;
    coverLetter: string; // Or skip reason.
    status: string; // 'submitted', 'skipped', etc.
    matchScore?: number; // Optional match score.
  }) => {
    return request<Application>("/applications", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Retrieve a list of all recorded applications.
  getApplications: async () => {
    return request<Application[]>("/applications");
  },

  // AI: Generate a 'Job Persona' from a raw resume text.
  // This persona summarizes the user's skills and experience relevant to job hunting.
  aiGenerateJobPersona: async (resumeText: string) => {
    return request<{ persona: string }>("/ai/job-persona", {
      method: "POST",
      body: JSON.stringify({ resumeText }),
    });
  },

  // AI: Get the vector embedding for a given text (used for semantic search/matching).
  aiGetEmbedding: async (text: string) => {
    return request<{ embedding: number[] }>("/ai/embedding", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  },

  // AI: Check if a job is relevant based on the user's embedding and the job text.
  aiCheckJobRelevance: async (
    jobText: string, // Title or description of the job.
    userEmbedding: number[], // Use's persona embedding.
    type: "title" | "description", // Context of the check.
  ) => {
    return request<{ relevant: boolean; score: number }>("/ai/analyze-job", {
      method: "POST",
      body: JSON.stringify({ jobText, userEmbedding, type }),
    });
  },

  // AI: Generate a custom cover letter for a job.
  aiGenerateApplication: async (
    jobDescription: string, // Full job description.
    userProfile: string, // User's resume/profile text.
  ) => {
    return request<{ coverLetter: string }>("/ai/generate-application", {
      method: "POST",
      body: JSON.stringify({ jobDescription, userProfile }),
    });
  },
};
