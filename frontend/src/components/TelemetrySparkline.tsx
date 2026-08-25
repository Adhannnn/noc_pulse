// frontend/src/components/TelemetrySparkline.tsx
'use client';

import React from 'react';
import { Cpu, Wifi, HardDrive } from 'lucide-react';

interface SingleSeries {
  title: string;
  type: 'cpu';
  currentValue: string;
  data: number[];
}

interface DualSeries {
  title: string;
  type: 'network' | 'disk';
  badgeLabel: string;
  legend1: { label: string; color: string };
  legend2: { label: string; color: string };
  data1: number[];
  data2: number[];
}

type SparklineProps = SingleSeries | DualSeries;

export default function TelemetrySparkline(props: SparklineProps) {
  const isSingle = props.type === 'cpu';

  const renderPath = (data: number[], color: string, height = 80, width = 300) => {
    if (!data || data.length === 0) return null;
    const max = Math.max(...data, 10);
    const step = width / (data.length - 1 || 1);

    const points = data.map((val, i) => {
      const x = i * step;
      const y = height - (val / max) * (height - 10);
      return `${x},${y}`;
    });

    const pathD = `M ${points.join(' L ')}`;
    return (
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  };

  return (
    <div className="bg-[#121829] border border-[#1E2640] rounded-2xl p-5 shadow-sm text-slate-100 flex flex-col justify-between h-full relative overflow-hidden">
      {/* Card Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-slate-400 text-xs font-mono uppercase tracking-wider font-bold">
          {props.type === 'cpu' ? (
            <Cpu className="w-4 h-4 text-sky-400" />
          ) : props.type === 'network' ? (
            <Wifi className="w-4 h-4 text-emerald-400" />
          ) : (
            <HardDrive className="w-4 h-4 text-amber-400" />
          )}
          <span>{props.title}</span>
        </div>

        {isSingle ? (
          <span className="text-xs font-mono font-bold text-sky-400">{props.currentValue}</span>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-300 font-semibold">
              {props.badgeLabel}
            </span>
            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: props.legend1.color }} />
                {props.legend1.label}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: props.legend2.color }} />
                {props.legend2.label}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Waveform Chart Canvas */}
      <div className="w-full h-24 pt-2">
        <svg className="w-full h-full overflow-visible" viewBox="0 0 300 80" preserveAspectRatio="none">
          {/* Subtle Horizontal Grid lines */}
          <line x1="0" y1="20" x2="300" y2="20" stroke="#1E2640" strokeDasharray="3 3" />
          <line x1="0" y1="50" x2="300" y2="50" stroke="#1E2640" strokeDasharray="3 3" />
          <line x1="0" y1="78" x2="300" y2="78" stroke="#1E2640" />

          {isSingle ? (
            renderPath(props.data, '#3B82F6')
          ) : (
            <>
              {renderPath(props.data1, props.legend1.color)}
              {renderPath(props.data2, props.legend2.color)}
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
