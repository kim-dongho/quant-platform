import { useMutation } from '@tanstack/react-query';

import { backtestPortfolio, screenPortfolio } from './portfolio-api';

export const useScreenPortfolio = () =>
  useMutation({
    mutationFn: screenPortfolio,
  });

export const useBacktestPortfolio = () =>
  useMutation({
    mutationFn: backtestPortfolio,
  });
