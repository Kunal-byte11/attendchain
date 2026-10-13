import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Screen 1: Landing Page (T-004)", () => {
  test("renders hero, evidentiary notice, feature cards, and navigation links on desktop and mobile with 0 axe violations", async ({
    page,
  }) => {
    // Desktop viewport check (1280px)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: /Tamper-Evident Classroom Attendance on Ethereum Sepolia/i,
      })
    ).toBeVisible();

    await expect(
      page.getByRole("note", { name: /Cryptographic provenance notice/i })
    ).toBeVisible();

    await expect(
      page.getByRole("heading", {
        name: /Zero On-Chain PII via Salted Hashes/i,
      })
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: /Verify a Transaction/i })
    ).toHaveAttribute("href", "/verify");

    await expect(
      page.getByRole("link", { name: /Connect & Sign In/i })
    ).toHaveAttribute("href", "/auth");

    // Automated WCAG 2.2 AA Accessibility Scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);

    // Mobile viewport check (375px)
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(
      page.getByRole("heading", {
        name: /Tamper-Evident Classroom Attendance on Ethereum Sepolia/i,
      })
    ).toBeVisible();
  });

  test("displays visible 2px #4F46E5 focus ring on keyboard Tab navigation", async ({
    page,
  }) => {
    await page.goto("/");
    await page.keyboard.press("Tab"); // Skip link
    await page.keyboard.press("Tab"); // First nav link ("Verify a Transaction")

    const verifyLink = page.getByRole("link", {
      name: /Verify a Transaction/i,
    });
    await expect(verifyLink).toBeFocused();

    const outlineStyle = await verifyLink.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        outlineWidth: style.outlineWidth,
        outlineColor: style.outlineColor,
      };
    });

    expect(outlineStyle.outlineWidth).toBe("2px");
    // #4f46e5 is rgb(79, 70, 229)
    expect(outlineStyle.outlineColor).toBe("rgb(79, 70, 229)");
  });
});
