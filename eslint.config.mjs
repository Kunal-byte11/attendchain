import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const espree = require("espree");

/**
 * Custom TypeScript + JSX parser for ESLint 9 using the locked typescript@5.9.3
 * compiler and built-in espree, avoiding unapproved extra parser packages.
 */
const tsEspreeParser = {
  meta: {
    name: "attendchain-ts-espree-parser",
    version: "1.0.0",
  },
  parseForESLint(code, options = {}) {
    const isTsx = options.filePath?.endsWith(".tsx");
    const transpiled = ts.transpileModule(code, {
      fileName: options.filePath || (isTsx ? "file.tsx" : "file.ts"),
      compilerOptions: {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.Preserve,
        isolatedModules: true,
      },
    });

    const ast = espree.parse(transpiled.outputText, {
      ecmaVersion: "latest",
      sourceType: "module",
      ecmaFeatures: {
        jsx: true,
      },
      range: true,
      loc: true,
      tokens: true,
      comment: true,
    });

    return {
      ast,
      services: {
        rawSource: code,
        filePath: options.filePath || "",
      },
      scopeManager: null,
      visitorKeys: espree.VisitorKeys,
    };
  },
};

const attendChainPlugin = {
  rules: {
    "no-ts-ignore": {
      meta: {
        type: "problem",
        docs: {
          description: "Disallow @ts-ignore and @ts-nocheck comments per 07_RULES.md",
        },
        schema: [],
      },
      create(context) {
        return {
          Program(node) {
            const raw = context.sourceCode?.ParserServices?.rawSource ?? context.sourceCode.getText();
            if (/@ts-ignore|@ts-nocheck/.test(raw)) {
              context.report({
                node,
                message:
                  "Usage of @ts-ignore or @ts-nocheck is forbidden by 07_RULES.md Section 1.1.",
              });
            }
          },
        };
      },
    },
    "no-dangerously-set-inner-html": {
      meta: {
        type: "problem",
        docs: {
          description: "Disallow dangerouslySetInnerHTML per 05_SECURITY.md Section 8.2",
        },
        schema: [],
      },
      create(context) {
        return {
          Program(node) {
            const raw = context.sourceCode?.ParserServices?.rawSource ?? context.sourceCode.getText();
            if (raw.includes("dangerouslySetInnerHTML")) {
              context.report({
                node,
                message:
                  "dangerouslySetInnerHTML is strictly banned by 05_SECURITY.md Section 8.2.",
              });
            }
          },
        };
      },
    },
    "no-server-secrets-in-client": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Prevent client components and UI pages from referencing server-only secret env names",
        },
        schema: [],
      },
      create(context) {
        return {
          Program(node) {
            const filename = context.filename || "";
            const isClientSurface =
              filename.includes("/src/components/") ||
              filename.includes("/src/app/(public)/") ||
              filename.includes("/src/app/(dashboard)/");
            if (!isClientSurface) return;

            const raw = context.sourceCode?.ParserServices?.rawSource ?? context.sourceCode.getText();
            const forbiddenSecrets = [
              "SUPABASE_SERVICE_ROLE_KEY",
              "AUTH_JWT_SECRET",
              "INSTITUTION_HASH_SALT",
              "QR_TICKET_SIGNER_PRIVATE_KEY",
              "DEPLOYER_PRIVATE_KEY",
            ];
            for (const secretName of forbiddenSecrets) {
              if (raw.includes(secretName)) {
                context.report({
                  node,
                  message: `Client surface must never reference server-only secret ${secretName} (07_RULES.md Section 3.1).`,
                });
              }
            }
          },
        };
      },
    },
  },
};

export default [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "blockchain/artifacts/**",
      "blockchain/cache/**",
      "blockchain/typechain-types/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mjs"],
    languageOptions: {
      parser: tsEspreeParser,
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: {
      attendchain: attendChainPlugin,
    },
    rules: {
      "no-debugger": "error",
      "no-eval": "error",
      "no-var": "error",
      "prefer-const": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "attendchain/no-ts-ignore": "error",
      "attendchain/no-dangerously-set-inner-html": "error",
      "attendchain/no-server-secrets-in-client": "error",
    },
  },
];
