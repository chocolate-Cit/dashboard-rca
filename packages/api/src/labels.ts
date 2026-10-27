import type { EquipmentType, IncidentStatus, PaymentChannel, Priority, Role } from './schemas';

/** ป้ายภาษาไทยของค่า enum ใช้ร่วมกันทั้งสองเว็บ */
export const roleLabel: Record<Role, string> = {
  executive: 'ผู้บริหาร',
  admin: 'ผู้ดูแลระบบ',
  operator: 'ช่างเทคนิค',
};

export const statusLabel: Record<IncidentStatus, string> = {
  open: 'เปิด',
  assigned: 'มอบหมายแล้ว',
  in_progress: 'กำลังดำเนินการ',
  waiting_parts: 'รออะไหล่',
  closed: 'ปิดงาน',
  cancelled: 'ยกเลิก',
};

export const priorityLabel: Record<Priority, string> = {
  low: 'ต่ำ',
  medium: 'ปานกลาง',
  high: 'สูง',
  critical: 'วิกฤต',
};

export const equipmentTypeLabel: Record<EquipmentType, string> = {
  esp: 'บอร์ดควบคุม ESP',
  controller: 'บอร์ดควบคุม',
  computer: 'คอมพิวเตอร์',
  barrier: 'ไม้กั้น',
  ticket: 'ตู้จ่ายสลิป (Kiosk Entrance)',
  payment: 'ตู้ชำระเงิน (Kiosk Exit)',
  kiosk: 'Kiosk Payment',
  lpr: 'กล้องอ่านป้ายทะเบียน',
  face: 'กล้องจับใบหน้า',
  qr: 'เครื่องอ่าน QR',
  notouch: 'เซ็นเซอร์ไม่สัมผัส',
  loop: 'Loop Sensor',
  radar: 'เรดาร์',
  intercom: 'Intercom',
};

export const channelLabel: Record<PaymentChannel, string> = {
  cash: 'เงินสด',
  credit: 'บัตรเครดิต',
  ewallet: 'e-Wallet',
  qr: 'QR พร้อมเพย์',
};

export const equipmentStatusLabel = { normal: 'ปกติ', stuck: 'ค้าง', down: 'เสีย' } as const;

export const directionLabel = { in: 'ทางเข้า', out: 'ทางออก' } as const;
