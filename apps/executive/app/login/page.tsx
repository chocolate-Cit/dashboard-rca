import { LoginPanel, LoginScreen } from '@gip/ui';
import { Activity, Layers3, Wallet } from 'lucide-react';
import type { Metadata } from 'next';
import { HOME } from '@/lib/app';

export const metadata: Metadata = { title: 'เข้าสู่ระบบ' };

type Props = { searchParams: Promise<{ reason?: string; next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { reason, next } = await searchParams;
  return (
    <LoginScreen
      appName="ภาพรวมลานจอด"
      tagline="สำหรับผู้บริหาร · รายได้ ปริมาณรถ และสถานะอุปกรณ์"
      home={HOME}
      reason={reason}
      next={next}
      logoTone="dark"
      panel={
        <LoginPanel
          appName="ภาพรวมลานจอด"
          headline={['เห็นรายได้และทุกป้อม', 'ในหน้าจอเดียว']}
          points={[
            { icon: <Wallet />, text: 'รายได้วันนี้ เทียบกับเมื่อวาน' },
            { icon: <Layers3 />, text: 'ผัง 3 มิติของลานจอดและสถานะไม้กั้น' },
            { icon: <Activity />, text: 'ปริมาณรถเข้า–ออกรายชั่วโมง' },
          ]}
        />
      }
    />
  );
}
