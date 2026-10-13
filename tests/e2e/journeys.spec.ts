import { test, expect } from "@playwright/test";

test.describe("AttendChain E2E User Journeys (T-020, FR-001 - FR-022)", () => {
  test("Journey 1: Public Landing Page, SIWE Authentication & Web3 Navigation", async ({
    page,
  }) => {
    // 1. Visit landing page
    await page.goto("/");
    await expect(page).toHaveTitle(/AttendChain/i);

    // Verify key landing UI elements
    await expect(
      page.getByRole("heading", { name: /Tamper-Evident/i })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Launch App/i })).toBeVisible();

    // 2. Navigate to Auth
    await page.goto("/auth");
    await expect(
      page.getByRole("heading", { name: /Connect & Authenticate/i })
    ).toBeVisible();
    await expect(
      page.getByText(/Cryptographic SIWE Authentication/i)
    ).toBeVisible();
  });

  test("Journey 2: Admin Dashboard & Academic Management Workspace", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: /Administrator Overview/i })
    ).toBeVisible();

    // Verify sub-navigation links
    await page.goto("/admin/students");
    await expect(
      page.getByRole("heading", { name: /Student Directory & Hash Generator/i })
    ).toBeVisible();

    await page.goto("/admin/courses");
    await expect(
      page.getByRole("heading", {
        name: /Course Catalog & Faculty Assignments/i,
      })
    ).toBeVisible();

    await page.goto("/admin/roles");
    await expect(
      page.getByRole("heading", { name: /On-Chain Role Delegation/i })
    ).toBeVisible();
  });

  test("Journey 3: Teacher Workspace, Lecture Session Creation & Marking", async ({
    page,
  }) => {
    await page.goto("/teacher");
    await expect(
      page.getByRole("heading", {
        name: /Teacher Lecture & Attendance Workspace/i,
      })
    ).toBeVisible();

    await page.goto("/teacher/lectures/new");
    await expect(
      page.getByRole("heading", { name: /Open New Lecture Session/i })
    ).toBeVisible();
    await expect(page.getByLabel(/Course Code/i)).toBeVisible();
    await expect(page.getByLabel(/Lecture Topic/i)).toBeVisible();
  });

  test("Journey 4: Student Dashboard, Attendance History & Public Verification Portal", async ({
    page,
  }) => {
    // 1. Student Dashboard
    await page.goto("/student");
    await expect(
      page.getByRole("heading", { name: /Student Attendance Dashboard/i })
    ).toBeVisible();
    await expect(page.getByText(/Live Lecture Check-In/i)).toBeVisible();

    // 2. Student History
    await page.goto("/student/history");
    await expect(
      page.getByRole("heading", { name: /Student Attendance History/i })
    ).toBeVisible();

    // 3. Corrections & Dispute History
    await page.goto("/corrections");
    await expect(
      page.getByRole("heading", {
        name: /Attendance Corrections & Dispute History/i,
      })
    ).toBeVisible();

    // 4. Independent Public Verification Portal
    await page.goto("/verify");
    await expect(
      page.getByRole("heading", { name: /Trustless Attendance Verification/i })
    ).toBeVisible();
    await expect(
      page.getByLabel(/Verify by 32-Byte Transaction Hash/i)
    ).toBeVisible();
  });
});
