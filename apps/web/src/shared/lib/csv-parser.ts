export interface CandleData {
  time: number; // 1분봉은 반드시 초 단위 숫자(Unix Timestamp)여야 함
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export const parseCSV = (csvText: string): CandleData[] => {
  const lines = csvText.trim().split('\n');
  const data: CandleData[] = [];

  // 야후 파이낸스 CSV 헤더: Date, Open, High, Low, Close, Adj Close, Volume
  // 첫 줄(헤더) 건너뛰고 1부터 시작
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');

    // 날짜 파싱 (예: 2025-02-14 09:30:00-05:00)
    // new Date()는 브라우저가 알아서 타임존 처리를 해줍니다.
    const dateStr = parts[0];
    const timestamp = new Date(dateStr).getTime() / 1000; // 밀리초 -> 초 변환 (중요!)

    const open = parseFloat(parts[1]);
    const high = parseFloat(parts[2]);
    const low = parseFloat(parts[3]);
    const close = parseFloat(parts[4]);
    // index 5는 Adj Close라 건너뜀
    const volume = parseFloat(parts[6]);

    // 데이터가 깨진 경우(NaN) 걸러내기
    if (!isNaN(open) && !isNaN(close) && !isNaN(timestamp)) {
      data.push({
        time: timestamp,
        open,
        high,
        low,
        close,
        volume,
      });
    }
  }

  // 시간순 정렬 (혹시 섞여있을 경우 대비)
  return data.sort((a, b) => a.time - b.time);
};
