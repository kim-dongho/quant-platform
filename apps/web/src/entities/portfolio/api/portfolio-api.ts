import { apiClient } from '@/shared/api/client';

import type {
  DiscoverJobStarted,
  DiscoverJobState,
  DiscoverRequest,
  DiscoverResult,
  DiscoverRunDetail,
  DiscoverRunSummary,
  ExitPolicy,
  PortfolioBacktestResult,
  RuleConfig,
  ScreenResult,
} from '../model/types';

export const screenPortfolio = async (config: RuleConfig): Promise<ScreenResult> => {
  const { data } = await apiClient.post<ScreenResult>('/portfolio/screen', config);
  return data;
};

export const backtestPortfolio = async (
  config: RuleConfig & {
    start_date?: string;
    end_date?: string;
    exit_policy?: ExitPolicy | null;
  },
): Promise<PortfolioBacktestResult> => {
  const { data } = await apiClient.post<PortfolioBacktestResult>('/portfolio/backtest', config);
  return data;
};

export const discoverStrategies = async (req: DiscoverRequest): Promise<DiscoverResult> => {
  // 2-clause 탐색은 수분 소요 — axios 타임아웃을 넉넉히 (10분)
  const { data } = await apiClient.post<DiscoverResult>('/portfolio/discover', req, {
    timeout: 10 * 60 * 1000,
  });
  return data;
};

// 비동기 — start로 시작하고 status로 progress polling
export const startDiscover = async (req: DiscoverRequest): Promise<DiscoverJobStarted> => {
  const { data } = await apiClient.post<DiscoverJobStarted>('/portfolio/discover/start', req);
  return data;
};

export const getDiscoverStatus = async (jobId: string): Promise<DiscoverJobState> => {
  const { data } = await apiClient.get<DiscoverJobState>(`/portfolio/discover/status/${jobId}`);
  return data;
};

export const cancelDiscover = async (jobId: string): Promise<DiscoverJobState> => {
  // backend 가 loop 가 멈출 때까지 짧게 대기 후 최종 status + 부분 결과를 반환.
  const { data } = await apiClient.post<DiscoverJobState>(`/portfolio/discover/cancel/${jobId}`);
  return data;
};

// ─────────────────────────────────────────────────────────────
// discover 영구 저장본 — 이력 조회·복원
// ─────────────────────────────────────────────────────────────
export const listDiscoverRuns = async (params?: {
  limit?: number;
  universe?: string;
}): Promise<DiscoverRunSummary[]> => {
  const { data } = await apiClient.get<DiscoverRunSummary[]>('/portfolio/discover/runs', {
    params,
  });
  return data;
};

export const getDiscoverRun = async (id: number): Promise<DiscoverRunDetail> => {
  const { data } = await apiClient.get<DiscoverRunDetail>(`/portfolio/discover/runs/${id}`);
  return data;
};

export const deleteDiscoverRun = async (id: number): Promise<{ deleted: number }> => {
  const { data } = await apiClient.delete<{ deleted: number }>(`/portfolio/discover/runs/${id}`);
  return data;
};
