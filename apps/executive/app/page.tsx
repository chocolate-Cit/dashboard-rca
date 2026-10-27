import { redirect } from 'next/navigation';
import { HOME } from '@/lib/app';

export default function Index() {
  redirect(HOME);
}
