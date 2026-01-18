import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Next.js 기본 설정 + TypeScript 설정
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  
  // Prettier 설정
  ...compat.extends("plugin:prettier/recommended"),

  // 커스텀 룰
  {
    rules: {
      "prettier/prettier": "error", // 스타일 틀리면 에러 표시
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-explicit-any": "warn",
      "react/display-name": "off",
    },
  },
];

export default eslintConfig;