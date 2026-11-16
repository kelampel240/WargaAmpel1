import React, { useEffect, useRef } from 'react';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  DoughnutController,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { AdminDashboardStats } from '../shared/types';

Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  DoughnutController,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);

interface ChartBoxProps {
  title: string;
  subtitle: string;
  config: ChartConfiguration;
}

const ChartBox: React.FC<ChartBoxProps> = ({ title, subtitle, config }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (chartRef.current) {
      chartRef.current.destroy();
    }
    chartRef.current = new Chart(canvas, config);
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [config]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
      <div className="mb-3">
        <h3 className="font-display text-base font-bold text-[#0F2942]">{title}</h3>
        <p className="text-xs text-slate-600">{subtitle}</p>
      </div>
      <div className="relative h-60 w-full">
        <canvas ref={canvasRef} aria-label={title} />
      </div>
    </div>
  );
};

interface AdminChartsProps {
  stats: AdminDashboardStats;
}

export const AdminCharts: React.FC<AdminChartsProps> = ({ stats }) => {
  const monthlyConfig: ChartConfiguration = {
    type: 'bar',
    data: {
      labels: stats.monthlyIncoming.map((m) => m.label),
      datasets: [
        {
          label: 'Jumlah Laporan',
          data: stats.monthlyIncoming.map((m) => m.count),
          backgroundColor: '#0B6E4F',
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
      },
    },
  };

  const topCategoriesConfig: ChartConfiguration = {
    type: 'bar',
    data: {
      labels: stats.topCategories.map((c) => c.label),
      datasets: [
        {
          label: 'Total',
          data: stats.topCategories.map((c) => c.count),
          backgroundColor: '#0F2942',
          borderRadius: 6,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1 } },
      },
    },
  };

  const statusDistConfig: ChartConfiguration = {
    type: 'doughnut',
    data: {
      labels: stats.statusDistribution.map((s) => s.label),
      datasets: [
        {
          data: stats.statusDistribution.map((s) => s.count),
          backgroundColor: [
            '#64748B',
            '#0284C7',
            '#D97706',
            '#4F46E5',
            '#6366F1',
            '#0B6E4F',
            '#E11D48',
          ],
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 10, font: { size: 11 } },
        },
      },
    },
  };

  const comparisonConfig: ChartConfiguration = {
    type: 'bar',
    data: {
      labels: ['Selesai Ditangani', 'Belum Selesai'],
      datasets: [
        {
          label: 'Laporan',
          data: [stats.completedVsUnfinished.selesai, stats.completedVsUnfinished.belumSelesai],
          backgroundColor: ['#0B6E4F', '#D97706'],
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
      },
    },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <ChartBox
        title="Laporan Masuk per Bulan"
        subtitle="Tren penerimaan laporan dan permohonan warga"
        config={monthlyConfig}
      />
      <ChartBox
        title="Jenis Masalah Terbanyak"
        subtitle="Distribusi pengaduan & layanan berdasarkan topik"
        config={topCategoriesConfig}
      />
      <ChartBox
        title="Distribusi Status Penanganan"
        subtitle="Sebaran seluruh laporan aktif pada 7 tahap status"
        config={statusDistConfig}
      />
      <ChartBox
        title="Perbandingan Selesai dan Belum Selesai"
        subtitle="Kinerja penyelesaian laporan warga Desa Ampel"
        config={comparisonConfig}
      />
    </div>
  );
};
