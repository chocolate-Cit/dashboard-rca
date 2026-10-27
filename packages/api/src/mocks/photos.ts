/**
 * รูปตัวอย่างสำหรับ mock (SVG เป็น data URL)
 * ทุกรูปมีคำว่า "ภาพตัวอย่าง" กำกับ เพื่อไม่ให้เข้าใจผิดว่าเป็นรูปจริงจากหน้างาน
 */
const tones = [
  ['#334155', '#64748b'],
  ['#3f3f46', '#a1a1aa'],
  ['#1e3a5f', '#5b7fa6'],
  ['#44403c', '#a8a29e'],
] as const;

export function samplePhoto(label: string, seed: number): string {
  const [bg, fg] = tones[seed % tones.length]!;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
<rect width="640" height="480" fill="${bg}"/>
<g fill="none" stroke="${fg}" stroke-width="10" opacity="0.55">
<rect x="${120 + (seed % 5) * 12}" y="150" width="400" height="220" rx="18"/>
<path d="M150 330 L270 230 L350 300 L420 250 L500 330"/>
<circle cx="${430 - (seed % 4) * 20}" cy="200" r="26"/>
</g>
<text x="32" y="56" font-family="sans-serif" font-size="26" fill="#f8fafc" opacity="0.9">ภาพตัวอย่าง</text>
<text x="32" y="446" font-family="sans-serif" font-size="22" fill="#f8fafc" opacity="0.8">${escapeXml(label)}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
