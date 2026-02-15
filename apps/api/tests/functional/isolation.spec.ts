import { test } from "@japa/runner";

test.group("Multi-User Isolation", () => {
  test("users can only see their own companies", async ({ client }) => {
    // User A creates a company
    const responseA = await client
      .post("/api/companies")
      .header("x-user-id", "user-a")
      .json({
        url: "https://example.com/a",
        name: "Company A",
        status: "visited",
      });

    responseA.assertStatus(201);
    responseA.assertBodyContains({ url: "https://example.com/a" });

    // User B should NOT see User A's company
    const listB = await client
      .get("/api/companies")
      .header("x-user-id", "user-b");

    listB.assertStatus(200);
    // Should be empty array or at least not contain Company A
    // But since we are running on a possibly non-empty DB, we check for absence of Company A
    const companiesB = listB.body();
    const foundA = companiesB.find(
      (c: any) => c.url === "https://example.com/a",
    );
    if (foundA) {
      throw new Error("User B can see User A company");
    }

    // User A SHOULD see User A's company
    const listA = await client
      .get("/api/companies")
      .header("x-user-id", "user-a");

    listA.assertStatus(200);
    const companiesA = listA.body();
    const foundA_again = companiesA.find(
      (c: any) => c.url === "https://example.com/a",
    );
    if (!foundA_again) {
      throw new Error("User A cannot see their own company");
    }
  });

  test("users can create companies with same URL independently", async ({
    client,
  }) => {
    // User B creates the SAME company as User A (from previous test)
    const responseB = await client
      .post("/api/companies")
      .header("x-user-id", "user-b")
      .json({
        url: "https://example.com/a", // Same URL as User A
        name: "Company A for User B",
        status: "visited",
      });

    responseB.assertStatus(201);

    // Verify both exist
    const listA = await client
      .get("/api/companies")
      .header("x-user-id", "user-a");
    const listB = await client
      .get("/api/companies")
      .header("x-user-id", "user-b");

    const companyA = listA
      .body()
      .find((c: any) => c.url === "https://example.com/a");
    const companyB = listB
      .body()
      .find((c: any) => c.url === "https://example.com/a");

    if (!companyA || !companyB) {
      throw new Error("Companies missing");
    }

    if (companyA.id === companyB.id) {
      throw new Error("Companies have same ID, isolation failed");
    }
  });
});
