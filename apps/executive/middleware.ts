import { NextResponse, type NextRequest } from 'next/server';
import { cookieNames } from '@gip/api/server';
import { app, HOME } from '@/lib/app';

/** ไม่มี session → ไปหน้า login (ตรวจ token จริงอีกชั้นใน protected layout) */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = req.cookies.has(cookieNames(app).token);

  if (pathname === '/login') {
    if (hasSession && !req.nextUrl.searchParams.has('reason')) {
      return NextResponse.redirect(new URL(HOME, req.url));
    }
    return NextResponse.next();
  }
  if (!hasSession) {
    const url = new URL('/login', req.url);
    if (pathname !== '/' && pathname !== HOME) url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/|_next/|brand/|favicon.ico|icon|apple-icon).*)'],
};
