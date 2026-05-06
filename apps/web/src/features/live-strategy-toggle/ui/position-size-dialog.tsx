'use client';

import { useEffect, useState } from 'react';

import { useUpdateLiveStrategySize } from '@/entities/live-strategy/api/live-strategy-queries';
import type { LiveStrategy } from '@/entities/live-strategy/model/types';

import { NumberInput } from '@/shared/ui/number-input';

interface Props {
  strategy: LiveStrategy;
  onClose: () => void;
}

type SizeMode = 'fixed' | 'equal_weight';

const DEFAULT_FIXED = 1_000_000;

// 활성 전략의 종목당 배분 금액만 수정. 룰·청산은 그대로 두고 PATCH /live/strategy 로 같은 row 업데이트.
export const PositionSizeDialog = ({ strategy, onClose }: Props) => {
  const update = useUpdateLiveStrategySize();
  const [sizeMode, setSizeMode] = useState<SizeMode>(
    strategy.position_size_krw > 0 ? 'fixed' : 'equal_weight',
  );
  const [positionSize, setPositionSize] = useState<number>(
    strategy.position_size_krw > 0 ? strategy.position_size_krw : DEFAULT_FIXED,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = () => {
    setError(null);
    if (sizeMode === 'fixed' && positionSize < 10_000) {
      setError('종목당 배분 금액은 최소 10,000원 이상이어야 합니다');
      return;
    }
    update.mutate(sizeMode === 'fixed' ? positionSize : 0, {
      onSuccess: () => onClose(),
      onError: (e) => setError(e instanceof Error ? e.message : '저장 실패'),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-container-lowest w-full max-w-md overflow-hidden rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
      >
        <header className="border-outline-variant/30 flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">payments</span>
            <h2 className="text-on-surface text-[15px] font-semibold">종목당 배분 수정</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-on-surface-variant hover:bg-surface-container-low h-7 w-7 rounded-md"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </header>

        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="text-on-surface-variant text-[12px]">
            전략 <strong className="text-on-surface">&lsquo;{strategy.name}&rsquo;</strong> 의
            종목당 배분 금액만 변경합니다. 룰·청산 정책은 그대로 유지됩니다.
          </div>

          <div>
            <label className="text-on-surface-variant mb-1.5 block text-xs font-medium">
              자본 배분 방식
            </label>
            <div className="mb-2 flex gap-1">
              <button
                type="button"
                onClick={() => setSizeMode('fixed')}
                className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                  sizeMode === 'fixed'
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-outline-variant/60 bg-surface text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                고정 금액
              </button>
              <button
                type="button"
                onClick={() => setSizeMode('equal_weight')}
                className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                  sizeMode === 'equal_weight'
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-outline-variant/60 bg-surface text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                자본 균등 분배
              </button>
            </div>

            {sizeMode === 'fixed' ? (
              <>
                <NumberInput
                  min={10000}
                  step={100000}
                  value={positionSize}
                  onChange={setPositionSize}
                  className="border-outline-variant bg-surface text-on-surface focus:border-primary w-full rounded-lg border px-3 py-2 text-right font-mono text-sm tabular-nums outline-none"
                />
                <p className="text-on-surface-variant mt-1 text-[11px]">
                  종목당 ₩{positionSize.toLocaleString()} · 최대 ₩
                  {(positionSize * strategy.max_positions).toLocaleString()} 까지 사용
                </p>
              </>
            ) : (
              <p className="border-outline-variant/40 bg-surface-container-low/60 text-on-surface-variant rounded-lg border px-3 py-2 text-[11.5px] leading-relaxed">
                매 라운드 시작 시 <strong className="text-on-surface">잔고 ÷ 빈 슬롯</strong> 으로
                동적 계산. 자본이 적을 때도 빈 슬롯에 고르게 분배돼 1주씩 매수 가능.
              </p>
            )}
          </div>

          {error && (
            <div className="border-error/40 bg-error-container/40 text-error rounded-lg border px-3 py-2 text-xs">
              {error}
            </div>
          )}
        </div>

        <div className="border-outline-variant/30 bg-surface-container-low/60 flex justify-end gap-2 border-t px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={update.isPending}
            className="border-outline-variant/60 bg-surface text-on-surface hover:bg-surface-container-low rounded-lg border px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={update.isPending}
            className="bg-primary text-on-primary hover:bg-on-primary-fixed-variant rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {update.isPending ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
};
