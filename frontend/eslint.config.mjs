import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    files: ["app/**/*.tsx", "features/**/*.tsx", "components/**/*.tsx"],
    ignores: ["components/ui/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.type='JSXIdentifier'][name.name=/^(button|input|select|textarea|label|option)$/]",
          message: "Use the shared shadcn component in @/components/ui or @/components/shared instead of styling a native control here.",
        },
        {
          selector: "Literal[value=/text-\\[[0-9]/]",
          message: "Use Typography variants or type-* utilities from the shared typography scale instead of an arbitrary font size.",
        },
        {
          selector: "Literal[value=/tracking-/]",
          message: "Letter spacing is defined centrally by the type-* typography roles for Thai and English.",
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

