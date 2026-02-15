const API_BASE_URL = "http://localhost:3333/api";

export interface Company {
  id: string;
  url: string;
  name: string | null;
  status: string;
  visitedAt: string;
}

export interface Application {
  id: string;
  jobTitle: string;
  companyName: string;
  jobUrl: string;
  coverLetter: string;
  status: string;
  matchScore: number | null;
  appliedAt: string;
}

let currentUserId: string | null = null;

export const setUserId = (id: string) => {
  currentUserId = id;
};

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (currentUserId) {
    (headers as any)["X-User-Id"] = currentUserId;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `API request failed: ${response.status} ${response.statusText} - ${errorBody}`,
    );
  }

  return response.json() as Promise<T>;
}

export const api = {
  checkCompanyExists: async (url: string) => {
    try {
      const params = new URLSearchParams({ url });
      await request<Company>(`/companies/search?${params.toString()}`);
      return true;
    } catch (e: any) {
      if (e.message && e.message.includes("404")) {
        return false;
      }
      throw e;
    }
  },

  createCompany: async (data: {
    url: string;
    name: string;
    status: string;
  }) => {
    return request<Company>("/companies", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  checkApplicationExists: async (jobUrl: string) => {
    try {
      const params = new URLSearchParams({ jobUrl });
      await request<Application>(`/applications/search?${params.toString()}`);
      return true;
    } catch (e: any) {
      if (e.message && e.message.includes("404")) {
        return false;
      }
      throw e;
    }
  },

  createApplication: async (data: {
    jobTitle: string;
    companyName: string;
    jobUrl: string;
    coverLetter: string;
    status: string;
    matchScore?: number;
  }) => {
    return request<Application>("/applications", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getApplications: async () => {
    return request<Application[]>("/applications");
  },

  aiGenerateJobPersona: async (resumeText: string) => {
    return request<{ persona: string }>("/ai/job-persona", {
      method: "POST",
      body: JSON.stringify({ resumeText }),
    });
  },

  aiGetEmbedding: async (text: string) => {
    return request<{ embedding: number[] }>("/ai/embedding", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  },

  aiCheckJobRelevance: async (
    jobText: string,
    userEmbedding: number[],
    type: "title" | "description",
  ) => {
    return request<{ relevant: boolean; score: number }>("/ai/analyze-job", {
      method: "POST",
      body: JSON.stringify({ jobText, userEmbedding, type }),
    });
  },

  aiGenerateApplication: async (
    jobDescription: string,
    userProfile: string,
  ) => {
    return request<{ coverLetter: string }>("/ai/generate-application", {
      method: "POST",
      body: JSON.stringify({ jobDescription, userProfile }),
    });
  },
};
