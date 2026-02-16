/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from "@adonisjs/core/services/router";

// Lazy load controllers to improve startup performance.
const CompaniesController = () => import("#controllers/companies_controller");
const ApplicationsController = () =>
  import("#controllers/applications_controller");

// Define routes for Company and Application resources under '/api'.
router
  .group(() => {
    // Companies endpoints
    router.get("/companies", [CompaniesController, "index"]); // List companies
    router.post("/companies", [CompaniesController, "store"]); // Create company
    // router.get('/companies/:id', [CompaniesController, 'show']) // Get single company (optional)
    router.get("/companies/search", [CompaniesController, "findByUrl"]); // Search company by URL

    // Applications endpoints
    router.get("/applications", [ApplicationsController, "index"]); // List applications
    router.post("/applications", [ApplicationsController, "store"]); // Create application
    router.get("/applications/search", [
      ApplicationsController,
      "findByJobUrl",
    ]); // Search application by Job URL
  })
  .prefix("api");

const AiController = () => import("#controllers/ai_controller");

// Define routes for AI-related operations under '/api'.
router
  .group(() => {
    router.post("/ai/job-persona", [AiController, "generateJobPersona"]); // Generate persona from resume
    router.post("/ai/embedding", [AiController, "getEmbedding"]); // Get text embedding
    router.post("/ai/analyze-job", [AiController, "checkJobRelevance"]); // Check job relevance against persona
    router.post("/ai/generate-application", [
      AiController,
      "generateApplication",
    ]); // Generate cover letter/application text
  })
  .prefix("api");
