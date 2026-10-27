import { handleLogout } from '@gip/api/server';
import { app } from '@/lib/app';

export const POST = (req: Request) => handleLogout(req, app);
export const GET = (req: Request) => handleLogout(req, app);
