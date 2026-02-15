/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from "@adonisjs/core/services/router";

const CompaniesController = () => import("#controllers/companies_controller");
const ApplicationsController = () =>
  import("#controllers/applications_controller");

router
  .group(() => {
    router.get("/companies", [CompaniesController, "index"]);
    router.post("/companies", [CompaniesController, "store"]);
    // router.get('/companies/:id', [CompaniesController, 'show']) // Optional for now
    router.get("/companies/search", [CompaniesController, "findByUrl"]);

    router.get("/applications", [ApplicationsController, "index"]);
    router.post("/applications", [ApplicationsController, "store"]);
    router.get("/applications/search", [
      ApplicationsController,
      "findByJobUrl",
    ]);
  })
  .prefix("api");

const AiController = () => import("#controllers/ai_controller");

router
  .group(() => {
    router.post("/ai/job-persona", [AiController, "generateJobPersona"]);
    router.post("/ai/embedding", [AiController, "getEmbedding"]);
    router.post("/ai/analyze-job", [AiController, "checkJobRelevance"]);
    router.post("/ai/generate-application", [
      AiController,
      "generateApplication",
    ]);
  })
  .prefix("api");
