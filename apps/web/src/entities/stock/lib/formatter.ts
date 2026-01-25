import { BacktestResponseDto } from "../model/stocks-dto";

export const transformToChartData = (res: BacktestResponseDto) => {
  return res.dates.map((date, index) => {
    const d = new Date(date);
    const formattedDate = d.toISOString().split('T')[0];
    
    return {
      time: formattedDate,
      value: res.values[index]
    };
  });
};