// frontend/src/components/CircularGauge.tsx
'use client';

import React from 'react';
import { MemoryStick, HardDrive } from 'lucide-react';

interface CircularGaugeProps {
  title: string;
  percentage: number;
  usedLabel: string;
  type: 'memory' | 'storage';
  onClick?: () => void;
}

export default function CircularGauge({ title, percentage, usedLabel, type, onClick }: CircularGaugeProps) {
  const clampPct = Math.min(Math.max(percentage, 0), 100);
  const strokeWidth = 14;
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampPct / 100) * circumference;

  const isMemory = type === 'memory';
  const gradientId = isMemory ? 'memoryGradient' : 'storageGradient';

  return (
    <div
      onClick={onClick}
      className={`bg-[#121829] border border-[#1E2640] rounded-2xl p-5 shadow-sm text-slate-100 flex flex-col justify-between h-full relative overflow-hidden group transition-all duration-300 ${
        onClick ? 'cursor-pointer hover:border-purple-500/50 hover:shadow-purple-500/10' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-400 text-xs font-mono uppercase tracking-wider font-bold">
          {isMemory ? (
            <MemoryStick className="w-4 h-4 text-purple-400" />
          ) : (
            <HardDrive className="w-4 h-4 text-amber-400" />
          )}
          <span>{title}</span>
        </div>
        {onClick && isMemory && (
          <span className="text-[10px] font-mono text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity font-bold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
            Details →
          </span>
        )}
      </div>

      {/* Gauge Canvas */}
      <div className="flex flex-col items-center justify-center my-4 relative">
        <svg className="w-44 h-44 -rotate-90 transform" viewBox="0 0 160 160">
          <defs>
            <linearGradient id="memoryGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
            <linearGradient id="storageGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#EF4444" />
            </linearGradient>
          </defs>

          {/* Background Track */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="#1E2640"
            strokeWidth={strokeWidth}
            fill="transparent"
          />

          {/* Glowing Arc */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center Labels */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-2xl font-extrabold text-white font-mono tracking-tight">
            {clampPct}%
          </div>
          <div className="text-[11px] font-bold text-slate-400 font-sans">Used</div>
        </div>
      </div>

      {/* Subtitle Details */}
      <div className="text-center text-xs font-mono text-slate-400">
        {usedLabel}
      </div>
    </div>
  );
}
