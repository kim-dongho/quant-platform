'use client';

import { useEffect, useState } from 'react';

import type { StrategyParams } from '@/widgets/stock-dashboard/model/dashborad-store';

import { STRATEGY_PRESETS } from '../model/config';
import { StrategyInput } from './strategy-input';

interface Props {
  params: StrategyParams;
  onParamChange: (key: keyof StrategyParams, value: number | boolean) => void;
  onApply: () => void;
}

export const StrategyControls = ({ params, onParamChange, onApply }: Props) => {
  const [localParams, setLocalParams] = useState<StrategyParams>(params);

  useEffect(() => {
    setLocalParams(params);
  }, [params]);

  // 🚀 실행 전 검증 로직 추가
  const handleApply = () => {
    // 1. 활성화된 전략 중 빈 값(NaN)이 있는지 체크
    const errors: string[] = [];

    if (localParams.enable_sma) {
      if (Number.isNaN(localParams.sma_short)) errors.push('SMA Short');
      if (Number.isNaN(localParams.sma_long)) errors.push('SMA Long');
    }
    if (localParams.enable_rsi) {
      if (Number.isNaN(localParams.rsi_buy_k)) errors.push('RSI Buy Limit');
    }
    if (localParams.enable_macd) {
      if (Number.isNaN(localParams.macd_fast)) errors.push('MACD Fast');
      if (Number.isNaN(localParams.macd_slow)) errors.push('MACD Slow');
      if (Number.isNaN(localParams.macd_sig)) errors.push('MACD Signal');
    }
    if (localParams.enable_bb) {
      if (Number.isNaN(localParams.bb_window)) errors.push('B.Bands Window');
      if (Number.isNaN(localParams.bb_std)) errors.push('B.Bands Std');
    }

    // 2. 에러가 있으면 경고 띄우고 중단
    if (errors.length > 0) {
      alert(`다음 항목의 값을 입력해주세요:\n- ${errors.join('\n- ')}`);
      return;
    }

    // 3. 통과되면 값 적용 및 실행
    (Object.entries(localParams) as [keyof StrategyParams, number | boolean][]).forEach(
      ([key, value]) => {
        onParamChange(key, value);
      },
    );
    onApply();
  };

  const applyPreset = (config: Partial<StrategyParams>) => {
    setLocalParams((prev) => ({ ...prev, ...config }));
  };

  const updateParam = (key: keyof StrategyParams, val: number | boolean) => {
    setLocalParams((prev) => ({ ...prev, [key]: val }));
  };

  const getStrategyName = () => {
    const parts = [];
    if (localParams.enable_sma) parts.push('SMA');
    if (localParams.enable_rsi) parts.push('RSI');
    if (localParams.enable_macd) parts.push('MACD');
    if (localParams.enable_bb) parts.push('B.Bands');

    if (parts.length === 0) return 'No Strategy Selected';
    return parts.join(' + ') + ' Strategy';
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 상단 상태 표시줄 */}
      <div className="flex items-center justify-between rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-emerald-500 uppercase">Selected Logic</span>
          <span className="text-sm font-bold tracking-tight text-white">{getStrategyName()}</span>
        </div>
      </div>

      {/* 프리셋 버튼 */}
      <div className="grid grid-cols-3 gap-2">
        {STRATEGY_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => applyPreset(preset.config)}
            className="group flex flex-col items-center justify-center rounded-lg border border-slate-700 bg-slate-800/50 py-2 transition-all hover:border-emerald-500/50 hover:bg-slate-700 active:scale-95"
          >
            <span className="text-xs font-bold text-white group-hover:text-emerald-400">
              {preset.name}
            </span>
            <span className="text-[10px] font-medium text-slate-500">{preset.desc}</span>
          </button>
        ))}
      </div>

      <div className="h-px w-full bg-slate-800" />

      {/* 🎛️ 파라미터 설정 영역 */}
      <div className="flex flex-col gap-5">
        {/* SMA 섹션 */}
        <div
          className={`transition-opacity duration-200 ${localParams.enable_sma ? 'opacity-100' : 'opacity-40'}`}
        >
          <div className="mb-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={localParams.enable_sma}
              onChange={(e) => updateParam('enable_sma', e.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-xs font-bold text-slate-300">SMA Trend</span>
          </div>
          <div className="flex gap-3 pl-6">
            <StrategyInput
              label="Short"
              value={localParams.sma_short}
              disabled={!localParams.enable_sma}
              onChange={(val) => updateParam('sma_short', val)}
              onEnter={handleApply}
            />
            <StrategyInput
              label="Long"
              value={localParams.sma_long}
              disabled={!localParams.enable_sma}
              onChange={(val) => updateParam('sma_long', val)}
              onEnter={handleApply}
            />
          </div>
        </div>

        {/* RSI 섹션 */}
        <div
          className={`transition-opacity duration-200 ${localParams.enable_rsi ? 'opacity-100' : 'opacity-40'}`}
        >
          <div className="mb-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={localParams.enable_rsi}
              onChange={(e) => updateParam('enable_rsi', e.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-xs font-bold text-slate-300">RSI Filter</span>
          </div>
          <div className="flex gap-3 pl-6">
            <StrategyInput
              label="Buy Limit"
              value={localParams.rsi_buy_k}
              disabled={!localParams.enable_rsi}
              onChange={(val) => updateParam('rsi_buy_k', val)}
              onEnter={handleApply}
            />
          </div>
        </div>

        {/* MACD 섹션 */}
        <div
          className={`transition-opacity duration-200 ${localParams.enable_macd ? 'opacity-100' : 'opacity-40'}`}
        >
          <div className="mb-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={localParams.enable_macd}
              onChange={(e) => updateParam('enable_macd', e.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-xs font-bold text-slate-300">MACD Momentum</span>
          </div>
          <div className="flex gap-3 pl-6">
            <StrategyInput
              label="Fast"
              value={localParams.macd_fast}
              disabled={!localParams.enable_macd}
              onChange={(val) => updateParam('macd_fast', val)}
              onEnter={handleApply}
            />
            <StrategyInput
              label="Slow"
              value={localParams.macd_slow}
              disabled={!localParams.enable_macd}
              onChange={(val) => updateParam('macd_slow', val)}
              onEnter={handleApply}
            />
            <StrategyInput
              label="Sig"
              value={localParams.macd_sig}
              disabled={!localParams.enable_macd}
              onChange={(val) => updateParam('macd_sig', val)}
              onEnter={handleApply}
            />
          </div>
        </div>

        {/* Bollinger Bands 섹션 */}
        <div
          className={`transition-opacity duration-200 ${localParams.enable_bb ? 'opacity-100' : 'opacity-40'}`}
        >
          <div className="mb-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={localParams.enable_bb}
              onChange={(e) => updateParam('enable_bb', e.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-xs font-bold text-slate-300">Bollinger Bands</span>
          </div>
          <div className="flex gap-3 pl-6">
            <StrategyInput
              label="Win"
              value={localParams.bb_window}
              disabled={!localParams.enable_bb}
              onChange={(val) => updateParam('bb_window', val)}
              onEnter={handleApply}
            />
            <StrategyInput
              label="Std"
              value={localParams.bb_std}
              disabled={!localParams.enable_bb}
              onChange={(val) => updateParam('bb_std', val)}
              onEnter={handleApply}
            />
          </div>
        </div>

        {/* 4. 실행 버튼 */}
        <button
          onClick={handleApply}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-500 active:scale-95"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Run Backtest</span>
        </button>
      </div>
    </div>
  );
};
