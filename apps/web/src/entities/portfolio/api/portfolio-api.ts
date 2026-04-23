import { apiClient } from '@/shared/api/client';

import type {
  IngestStatus,
  IngestUniverseResponse,
  PortfolioBacktestResult,
  RuleConfig,
  ScreenResult,
} from '../model/types';

export const screenPortfolio = async (config: RuleConfig): Promise<ScreenResult> => {
  const { data } = await apiClient.post<ScreenResult>('/portfolio/screen', config);
  return data;
};

export const backtestPortfolio = async (
  config: RuleConfig & { start_date?: string; end_date?: string },
): Promise<PortfolioBacktestResult> => {
  const { data } = await apiClient.post<PortfolioBacktestResult>('/portfolio/backtest', config);
  return data;
};

export const ingestUniverse = async (universe: string): Promise<IngestUniverseResponse> => {
  // 409(이미 진행 중)도 정상 응답으로 처리 — 배너 폴링이 기존 진행 상태를 이어받음
  const { data } = await apiClient.post<IngestUniverseResponse>(
    `/portfolio/ingest_universe?universe=${encodeURIComponent(universe)}`,
    undefined,
    { validateStatus: (s) => s === 202 || s === 409 },
  );
  return data;
};

export const getIngestStatus = async (universe: string): Promise<IngestStatus> => {
  const { data } = await apiClient.get<IngestStatus>(
    `/portfolio/ingest_status?universe=${encodeURIComponent(universe)}`,
  );
  return data;
};
