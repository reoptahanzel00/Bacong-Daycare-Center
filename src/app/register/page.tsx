import { redirect } from 'next/navigation';

/** Registration now lives on the unified auth page (/login → Create Account tab). */
export default function RegisterPage() {
  redirect('/login#create');
}
