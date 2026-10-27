/** ชื่อป้อมทั้ง 5 จุด ใช้ร่วมกันทั้งเว็บผู้บริหารและเว็บหลังบ้าน (แก้ที่นี่ที่เดียว) */
export const CHECKPOINTS = [
  { n: 1, name: 'ป้อมจตุรทิศ' },
  { n: 2, name: 'ป้อมเพชรบุรี' },
  { n: 3, name: 'ป้อมทางออกศูนย์วิจัย' },
  { n: 4, name: 'ป้อม I-HOUSE (A,B,C)' },
  { n: 5, name: 'ป้อม I-HOUSE (D,E)' },
] as const;

/** ชื่อเต็มของจุด เช่น "จุดที่ 1 ป้อมจตุรทิศ" (ตรงกับ site.group) */
export const checkpointLabel = (n: number) => {
  const c = CHECKPOINTS.find((x) => x.n === n);
  return c ? `จุดที่ ${n} ${c.name}` : `จุดที่ ${n}`;
};
