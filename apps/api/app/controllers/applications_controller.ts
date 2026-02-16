import type { HttpContext } from "@adonisjs/core/http";
import prisma from "#services/prisma";

export default class ApplicationsController {
  /**
   * Return a list of all applications
   */
  // Handle GET /applications
  async index({ request }: HttpContext) {
    const userId = request.header("x-user-id");
    if (!userId) return [];

    // Fetch all applications for the user, ordered by date.
    return prisma.application.findMany({
      where: { userId },
      orderBy: { appliedAt: "desc" },
    });
  }

  /**
   * Create a new application
   */
  // Handle POST /applications
  async store({ request, response }: HttpContext) {
    const userId = request.header("x-user-id");
    if (!userId) {
      return response.unauthorized({ message: "Missing User ID header" });
    }

    // Extract data from request body.
    const data = request.only([
      "jobTitle",
      "companyName",
      "jobUrl",
      "coverLetter",
      "status",
      "matchScore",
    ]);

    // Check for existing application to prevent duplicates.
    const existing = await prisma.application.findUnique({
      where: {
        userId_jobUrl: {
          userId,
          jobUrl: data.jobUrl,
        },
      },
    });

    if (existing) {
      return response
        .status(409)
        .send({ message: "Application already exists", data: existing });
    }

    // Create new application record.
    const application = await prisma.application.create({
      data: {
        userId,
        jobTitle: data.jobTitle,
        companyName: data.companyName,
        jobUrl: data.jobUrl,
        coverLetter: data.coverLetter,
        status: data.status || "submitted",
        matchScore: data.matchScore,
      },
    });

    return response.status(201).send(application);
  }

  /**
   * Find application by Job URL
   */
  // Handle GET /applications/search?jobUrl=...
  async findByJobUrl({ request, response }: HttpContext) {
    const userId = request.header("x-user-id");
    if (!userId) {
      return response.unauthorized({ message: "Missing User ID header" });
    }

    const qs = request.qs();
    const jobUrl = qs.jobUrl as string;

    if (!jobUrl) {
      return response.badRequest({ message: "Missing jobUrl query parameter" });
    }

    // Search for application by unique compound key (userId + jobUrl).
    const application = await prisma.application.findUnique({
      where: {
        userId_jobUrl: {
          userId,
          jobUrl,
        },
      },
    });

    if (!application) {
      return response.notFound({ message: "Application not found" });
    }

    return application;
  }
}
