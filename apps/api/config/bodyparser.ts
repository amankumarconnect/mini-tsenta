import { defineConfig } from "@adonisjs/core/bodyparser";

// Configuration for the BodyParser middleware, which handles request payloads.
const bodyParserConfig = defineConfig({
  /**
   * The bodyparser middleware will parse the request body
   * for the following HTTP methods.
   */
  allowedMethods: ["POST", "PUT", "PATCH", "DELETE"], // Methods to specifically parse.

  /**
   * Config for the "application/x-www-form-urlencoded"
   * content-type parser
   */
  form: {
    convertEmptyStringsToNull: true, // Convert "" to null in form data.
    types: ["application/x-www-form-urlencoded"], // Media types to handle.
  },

  /**
   * Config for the JSON parser
   */
  json: {
    convertEmptyStringsToNull: true,
    types: [
      "application/json",
      "application/json-patch+json",
      "application/vnd.api+json",
      "application/csp-report",
    ],
  },

  /**
   * Config for the "multipart/form-data" content-type parser.
   * File uploads are handled by the multipart parser.
   */
  multipart: {
    /**
     * Enabling auto process allows bodyparser middleware to
     * move all uploaded files inside the tmp folder of your
     * operating system
     */
    autoProcess: true, // Automatically process file uploads.
    convertEmptyStringsToNull: true,
    processManually: [], // List of routes to skip auto-processing (empty here).

    /**
     * Maximum limit of data to parse including all files
     * and fields
     */
    limit: "20mb", // Max request size.
    types: ["multipart/form-data"],
  },
});

export default bodyParserConfig;
