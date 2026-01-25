import { QueryClient } from '@tanstack/react-query';


export const getQueryClient = () => 
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 100 * 60 * 1000, // 캐시 유지 시간
        retry: 1,
        refetchOnWindowFocus: false, // 탭 전환시마다 데이터 다시 가져오기 방지
      },
    },
  });