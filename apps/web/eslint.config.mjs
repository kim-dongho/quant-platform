import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

const eslintConfig = [
  // Next.js 16+ 는 eslint-config-next 가 플랫 컨피그를 직접 export 함.
  ...nextCoreWebVitals,
  ...nextTypescript,

  // Prettier 플랫 컨피그 (eslint-plugin-prettier 의 recommended).
  prettierRecommended,

  // 커스텀 룰
  {
    rules: {
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      'react/display-name': 'off',

      // React 19 strict 규칙 — 합법적인 server-state hydration 패턴, Date.now 기반
      // derived value 등 정당한 사용처까지 막아서 끔.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',

      // type-only import는 `import type {}` 으로 분리.
      // 런타임 import와 섞이지 않게 + 빌드 시 type import는 제거되어 트리쉐이킹 효율 ↑.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],

      // import 문 내 named specifier({ a, b, c }) 알파벳 정렬.
      // 선언문 자체의 정렬·그룹핑은 prettier-plugin-sort-imports 가 담당하므로 ignore.
      'sort-imports': [
        'error',
        {
          // prettier-plugin-sort-imports 는 ASCII 순(대문자가 소문자보다 먼저) 으로
          // 정렬하므로 ESLint 도 같은 기준(ignoreCase: false) 으로 맞춰 충돌 방지.
          ignoreCase: false,
          ignoreDeclarationSort: true,
          ignoreMemberSort: false,
        },
      ],
    },
  },
];

export default eslintConfig;
