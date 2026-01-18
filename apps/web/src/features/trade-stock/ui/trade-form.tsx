'use client';

import { OrderSide } from '@/entities/order/model/types';
import { useState } from 'react';
// import { createOrder } from '@/entities/order/api/order.api';
// import { OrderSide } from '@/entities/order/model/types';

interface Props {
  symbol: string;
  currentPrice: number;
  onOrderPlaced: () => void; // 주문 성공 시 부모에게 알림 (차트 갱신용)
}

export const TradeForm = ({ symbol, currentPrice, onOrderPlaced }: Props) => {
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTrade = async (side: OrderSide) => {
    if (quantity <= 0) return;
    setIsSubmitting(true);

    // try {
    //   await createOrder({
    //     symbol,
    //     side,
    //     price: currentPrice,
    //     quantity,
    //   });
    //   alert(`${side} 주문이 체결되었습니다!`);
    //   onOrderPlaced(); // 차트 새로고침 트리거
    // } catch (e) {
    //   console.error(e);
    //   alert('주문 실패! 백엔드가 켜져있는지 확인하세요.');
    // } finally {
    //   setIsSubmitting(false);
    // }
  };

  return (
    <div className="flex gap-4 items-center bg-[#222] p-4 rounded-lg border border-gray-700">
      {/* 현재가 표시 */}
      <div className="text-white font-bold text-xl w-32">
        {currentPrice > 0 ? `$${currentPrice.toFixed(2)}` : '---'}
      </div>
      
      {/* 수량 입력 */}
      <div className="flex items-center gap-2">
        <input 
          type="number" 
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="bg-[#333] text-white p-2 rounded w-20 text-right border border-gray-600 focus:border-blue-500 outline-none"
          min="1"
        />
        <span className="text-gray-400 text-sm">주</span>
      </div>

      {/* 매수 버튼 */}
      <button 
        onClick={() => handleTrade('BUY')}
        disabled={isSubmitting}
        className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-6 py-2 rounded font-bold transition-colors ml-auto"
      >
        {isSubmitting ? '...' : 'BUY'}
      </button>
      
      {/* 매도 버튼 */}
      <button 
        onClick={() => handleTrade('SELL')}
        disabled={isSubmitting}
        className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-6 py-2 rounded font-bold transition-colors"
      >
        {isSubmitting ? '...' : 'SELL'}
      </button>
    </div>
  );
};