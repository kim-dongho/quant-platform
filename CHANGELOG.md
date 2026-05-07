# Changelog

이 프로젝트의 주요 변경사항을 기록.
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) 형식을 따르며,
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) 을 사용한다.

## [Unreleased]

## [0.2.0] — 2026-05-07

### Added — 라이브 매매
- 라이브 누적 실현손익 카드 + 청산 거래 상세 모달
- 라이브 signal_exit + hysteresis 청산 룰 자동 도출

### Added — 전략 자동 탐색
- 스크리너 risk-adjusted momentum (Jegadeesh-Titman 12-1) 랭킹 추가
- 자동 탐색 취소 기능 (cancel endpoint + 즉시 UI 반영)

### Added — 인프라
- VPS 자동 배포 워크플로 (GitHub Actions self-hosted runner + Tailscale)
- GitHub Actions CI (lint·type·build), Dependabot 의존성 자동 업데이트
- MIT 라이선스 + README 라이선스 섹션 + env 예시

### Changed
- 백테스트 차트 lightweight-charts v4 → v5 마이그레이션
- 백테스트 차트 컨테이너 패턴: conditional render → 항상 렌더 + overlay
  (mount/unmount 반복으로 첫 paint 가 누락되던 이슈 회피)
- 페이지 헤더를 공통 `PageHeader` 컴포넌트로 통일
- 모의계좌 응답·UI 에서 계좌번호 노출 제거
- `NumberInput` 공용 컴포넌트 + 손절 부호 자동 처리

### Fixed — 성능
- TimescaleDB hypertable chunks 3340 → 87 통합으로 plan time 12s → 100ms 미만
- 백테스트 데이터 로드 SQL 단순화 (DISTINCT ON 제거 + ANY array 바인딩)
- 백테스트 hot loop 최적화 — `factors_df` boolean filter 매 iter (200M ops)
  를 `groupby` dict 으로 교체, `closes.loc[day]` row 캐싱
- 자동탐색 시작 시 factor 별 SQL 4 회를 캐시 재사용으로 제거
- 데이터 로드 병렬화 (factors / market_data 두 SQL `ThreadPoolExecutor`)
- `pd.read_sql` → `connectorx` 로 fetch 5–10 배 가속
- 자동탐색 취소 즉시 반영 (cancel endpoint 가 loop 종료까지 대기 후 결과 반환)

### Fixed — 기타
- OS 다크모드 무시하고 라이트 테마 강제
- 백테스트 차트 첫 paint 누락
- SQLAlchemy named param 과 충돌하는 `::cast` → `CAST()` 함수 사용
- VPS deploy 시 engine 컨테이너 명시 재시작 (volume-mounted src 의 Python 모듈 reload)
- 라이브 매수 시가 갭 필터의 multiplier 부족으로 빈 슬롯이 남던 버그 수정

[Unreleased]: https://github.com/kim-dongho/quant-platform/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/kim-dongho/quant-platform/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/kim-dongho/quant-platform/releases/tag/v0.1.0
