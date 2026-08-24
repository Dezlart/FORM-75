import { expect, type Page } from "@playwright/test";

export interface RuntimeDiagnostics {
  consoleErrors: string[];
  pageErrors: string[];
  requestFailures: string[];
  clientChunks: Array<{ status: number; url: string }>;
}

export function monitorRuntime(page: Page): RuntimeDiagnostics {
  const diagnostics: RuntimeDiagnostics = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    clientChunks: [],
  };

  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    diagnostics.requestFailures.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "failed"}`);
  });
  page.on("response", (response) => {
    if (response.request().resourceType() === "script" && response.url().includes("/_next/static/chunks/")) {
      diagnostics.clientChunks.push({ status: response.status(), url: response.url() });
    }
  });

  return diagnostics;
}

export function expectCleanRuntime(diagnostics: RuntimeDiagnostics): void {
  expect(diagnostics.pageErrors, "uncaught page errors").toEqual([]);
  expect(diagnostics.consoleErrors, "browser console errors").toEqual([]);
  expect(diagnostics.requestFailures, "failed browser requests").toEqual([]);
  expect(diagnostics.clientChunks.length, "Next.js client chunks loaded").toBeGreaterThan(0);
  expect(diagnostics.clientChunks.filter(({ status }) => status < 200 || status >= 400), "failed Next.js client chunks").toEqual([]);
}
