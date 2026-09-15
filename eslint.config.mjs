import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "node_modules/**"]),
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // `new Date().toISOString().split('T')[0]` renders the date in UTC. The
      // centre is in San Luis, Aurora (UTC+8), so between midnight and 08:00
      // local it returns YESTERDAY -- and the attendance register defaults to
      // today, during exactly the hour the morning register is taken. Fifteen
      // call sites did this before the 2026-09-05 audit. Use todayLocalISO()
      // or toLocalISODate() from '@/lib/dates' instead.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='split'][callee.object.callee.property.name='toISOString']",
          message:
            "toISOString() is UTC, so this is off by a day between midnight and 08:00 in the Philippines. Use todayLocalISO() / toLocalISODate() from '@/lib/dates'.",
        },
      ],
    },
  },
]);
