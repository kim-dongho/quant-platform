import { QueryClient } from '@tanstack/react-query';

export const getQueryClient = () => 
  new QueryClient({
    defaultOptions: {
      queries: {
        // 퀀트 데이터 특성상 1분간은 신선하다고 가정 (staleTime)
        staleTime: 60 * 1000,
        gcTime: 100 * 60 * 1000, // 캐시 유지 시간
        retry: 1,
        refetchOnWindowFocus: false, // 탭 전환시마다 데이터 다시 가져오기 방지
      },
    },
  });