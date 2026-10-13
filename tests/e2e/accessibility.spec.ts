import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const publicRoutes = ["/", "/auth", "/verify"];

test.describe("WCAG 2.2 AA Accessibility Audit Suite (T-019, NFR-006)", () => {
  for (const route of publicRoutes) {
    test(`scans ${route} for zero critical or serious WCAG 2.2 AA violations`, async ({
      page,
    }) => {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();

      const seriousOrCritical = accessibilityScanResults.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical"
      );

      expect(seriousOrCritical).toEqual([]);
    });
  }
});
