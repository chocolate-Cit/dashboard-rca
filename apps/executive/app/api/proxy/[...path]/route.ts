import { handleProxy } from '@gip/api/server';
import { app } from '@/lib/app';

type Ctx = { params: Promise<{ path: string[] }> };

async function handler(req: Request, { params }: Ctx) {
  return handleProxy(req, app, (await params).path);
}

export const dynamic = 'force-dynamic';
export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE };
