import { handleLogin } from '@gip/api/server';
import { app } from '@/lib/app';

export const POST = (req: Request) => handleLogin(req, app);
