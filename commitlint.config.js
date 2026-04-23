/**
 * 프로젝트 커밋 컨벤션 (.claude/CLAUDE.md 기준)
 * Format: <type>(<scope>): <한국어 설명>
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'style', 'docs', 'chore'],
    ],
    'scope-enum': [
      2,
      'always',
      ['web', 'server', 'engine', 'common'],
    ],
    'scope-empty': [2, 'never'],
    // 한국어 설명 허용 (케이스/단어 검사 비활성화)
    'subject-case': [0],
    'subject-full-stop': [2, 'never', '.'],
    'subject-empty': [2, 'never'],
    'header-max-length': [2, 'always', 100],
  },
};
