import type { HttpContext } from "@adonisjs/core/http";
import { AiService } from "#services/ai_service";

export default class AiController {
  private aiService: AiService;

  constructor() {
    this.aiService = new AiService(); // Initialize the AI service.
  }

  // Handle POST /ai/job-persona
  async generateJobPersona({ request, response }: HttpContext) {
    const { resumeText } = request.only(["resumeText"]);
    if (!resumeText) {
      return response.badRequest({ message: "Missing resumeText" });
    }

    // Delegate to AiService to generate persona from resume.
    const persona = await this.aiService.generateJobPersona(resumeText);
    return { persona };
  }

  // Handle POST /ai/embedding
  async getEmbedding({ request, response }: HttpContext) {
    const { text } = request.only(["text"]);
    if (!text) {
      return response.badRequest({ message: "Missing text" });
    }

    // Get vector embedding for the provided text.
    const embedding = await this.aiService.getEmbedding(text);
    return { embedding };
  }

  // Handle POST /ai/analyze-job
  async checkJobRelevance({ request, response }: HttpContext) {
    const { jobText, userEmbedding, type } = request.only([
      "jobText",
      "userEmbedding",
      "type",
    ]);

    if (!jobText || !userEmbedding || !type) {
      return response.badRequest({
        message: "Missing text, userEmbedding, or type (title|description)",
      });
    }

    // Determine check type: title or description.
    if (type === "title") {
      const result = await this.aiService.isJobTitleRelevant(
        jobText,
        userEmbedding,
      );
      return result;
    } else if (type === "description") {
      const result = await this.aiService.isJobRelevant(jobText, userEmbedding);
      return result;
    } else {
      return response.badRequest({
        message: 'Invalid type. Must be "title" or "description"',
      });
    }
  }

  // Handle POST /ai/generate-application
  async generateApplication({ request, response }: HttpContext) {
    const { jobDescription, userProfile } = request.only([
      "jobDescription",
      "userProfile",
    ]);

    if (!jobDescription || !userProfile) {
      return response.badRequest({
        message: "Missing jobDescription or userProfile",
      });
    }

    // Generate custom cover letter/application text.
    const coverLetter = await this.aiService.generateApplication(
      jobDescription,
      userProfile,
    );
    return { coverLetter };
  }
}
