import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

export async function getAuthenticatedUser(): Promise<User | null> {
  // Used only by the local API contract test.
  // Never set this variable in production.
  if (process.env.API_CONTRACT_TEST === 'true') {
    const testUser: User = {
      id: 'test-user-4321',
      email: 'test@example.com',
      user_metadata: {
        full_name: 'Test User',
      },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    };

    return testUser;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function requireAuthenticatedUser(): Promise<User> {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new Error('Authentication required');
  }

  return user;
}