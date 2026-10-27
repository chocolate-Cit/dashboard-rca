import { buildHeatmap } from '@gip/api/calc';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Heatmap } from '../charts/heatmap';
import { DateRangePicker } from './date-range-picker';
import { StatCard } from './stat-card';

describe('StatCard', () => {
  it('แสดงค่าและ % เพิ่มขึ้นเป็นสีดีพร้อมข้อความสำหรับ screen reader', () => {
    render(
      <StatCard
        label="รายได้"
        value="฿1,200"
        current={1200}
        previous={1000}
        compareLabel="เทียบเมื่อวาน"
      />,
    );
    const card = screen.getByRole('region', { name: 'รายได้' });
    expect(within(card).getByText('฿1,200')).toBeInTheDocument();
    const change = within(card).getByText('+20.0%');
    expect(change.closest('span')).toHaveClass('text-success-fg');
    expect(within(card).getByText('เพิ่มขึ้น')).toHaveClass('sr-only');
  });

  it('ค่าที่ลดลงเป็นเรื่องดีเมื่อ lowerIsBetter', () => {
    render(<StatCard label="งานค้าง" value="8" current={8} previous={10} lowerIsBetter />);
    expect(screen.getByText('−20.0%').closest('span')).toHaveClass('text-success-fg');
  });

  it('ช่วงก่อนเป็น 0 ไม่แสดง Infinity', () => {
    render(<StatCard label="รถเข้า" value="50" current={50} previous={0} />);
    expect(screen.getByText('ไม่มีข้อมูลช่วงก่อน')).toBeInTheDocument();
    expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument();
  });

  it('สถานะกำลังโหลดไม่แสดงค่า', () => {
    render(<StatCard label="รายได้" value="฿1" loading />);
    expect(screen.queryByText('฿1')).not.toBeInTheDocument();
  });
});

describe('Heatmap', () => {
  const sites = [
    {
      id: 'a',
      code: 'IN-A',
      name: 'ทางเข้า A ถนนหลัก',
      direction: 'in' as const,
      group: null,
      active: true,
    },
    {
      id: 'b',
      code: 'OUT-A',
      name: 'ทางออก A ถนนหลัก',
      direction: 'out' as const,
      group: null,
      active: true,
    },
  ];
  const model = buildHeatmap(
    [
      { siteId: 'a', hour: 8, carsIn: 120, carsOut: 0 },
      { siteId: 'b', hour: 18, carsIn: 0, carsOut: 30 },
    ],
    sites,
    'all',
  );

  it('มีช่องครบ จุด × 24 ชม. และป้ายสำหรับ screen reader', () => {
    render(<Heatmap model={model} unit="คัน" label="ปริมาณรถ" />);
    expect(screen.getAllByRole('gridcell')).toHaveLength(48);
    expect(
      screen.getByRole('gridcell', { name: 'ทางเข้า A ถนนหลัก 08:00–09:00: 120 คัน' }),
    ).toBeInTheDocument();
  });

  it('สรุปช่วงที่หนาแน่นที่สุด และ hover แสดงค่าจริง', () => {
    render(<Heatmap model={model} unit="คัน" label="ปริมาณรถ" />);
    expect(
      screen.getAllByText(/ช่วงที่หนาแน่นที่สุดคือ ทางเข้า A ถนนหลัก เวลา 08:00–09:00/).length,
    ).toBeGreaterThan(0);
    fireEvent.mouseEnter(screen.getByRole('gridcell', { name: /ทางออก A ถนนหลัก 18:00–19:00/ }));
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('legend มี 5 ระดับ', () => {
    render(<Heatmap model={model} unit="คัน" label="ปริมาณรถ" />);
    expect(screen.getAllByText(/^ระดับ \d/)).toHaveLength(5);
  });

  it('ลูกศรเลื่อนโฟกัสระหว่างช่อง', async () => {
    render(<Heatmap model={model} unit="คัน" label="ปริมาณรถ" />);
    const start = screen.getByRole('gridcell', { name: /ทางเข้า A ถนนหลัก 08:00/ });
    act(() => start.focus());
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('gridcell', { name: /ทางเข้า A ถนนหลัก 09:00/ })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('gridcell', { name: /ทางออก A ถนนหลัก 09:00/ })).toHaveFocus();
  });
});

describe('DateRangePicker', () => {
  it('เลือก preset แล้วส่งช่วงวันที่ออกไป และแสดงตัวที่เลือกอยู่', async () => {
    const onChange = vi.fn();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
    render(<DateRangePicker value={{ from: today, to: today }} onChange={onChange} />);
    const group = screen.getByRole('radiogroup', { name: 'ช่วงเวลา' });
    expect(within(group).getByRole('radio', { name: 'วันนี้' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await userEvent.click(within(group).getByRole('radio', { name: '7 วัน' }));
    const range = onChange.mock.calls[0]![0] as { from: string; to: string };
    expect(range.to).toBe(today);
    expect((Date.parse(range.to) - Date.parse(range.from)) / 864e5).toBe(6);
  });

  it('ช่วงที่เลือกเองแสดงเป็นวันที่ภาษาไทย', () => {
    render(
      <DateRangePicker value={{ from: '2026-10-01', to: '2026-10-05' }} onChange={() => {}} />,
    );
    expect(screen.getAllByText('1–5 ต.ค. 2026').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /เลือกช่วงวันที่เอง/ })).toBeInTheDocument();
  });
});
