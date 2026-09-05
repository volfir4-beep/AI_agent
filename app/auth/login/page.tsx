import { Suspense } from 'react';
import LoginForm from '@/components/LoginForm';

function LoginContent() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
            <LoginForm />
        </main>
    );
}

export default function LoginPage() {
    return (
        <Suspense
            fallback={
                <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
                    <div className="text-sm text-muted-foreground">Loading...</div>
                </main>
            }
        >
            <LoginContent />
        </Suspense>
    );
}
