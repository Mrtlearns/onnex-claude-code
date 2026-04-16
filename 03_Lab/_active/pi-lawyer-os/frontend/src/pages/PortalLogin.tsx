import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Scale, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePortalLogin, usePortalSession } from '@/hooks/usePortalAuth';

const schema = z.object({
  firm_slug: z.string().min(1, 'Firm slug is required'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormValues = z.infer<typeof schema>;

export default function PortalLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = usePortalSession();
  const login = usePortalLogin();

  // Pre-fill firm slug from URL param e.g. /portal/login?firm=smithlaw
  const firmFromUrl = searchParams.get('firm') ?? '';

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/portal', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { firm_slug: firmFromUrl, email: '', password: '' },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await login.mutateAsync(values);
      navigate('/portal', { replace: true });
    } catch {
      // Error shown via login.error
    }
  };

  const apiError = login.error?.message ?? null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 shadow-md">
            <Scale className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Client Portal</h1>
          <p className="text-sm text-gray-500">Access your case status and documents</p>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Sign in</CardTitle>
            <CardDescription className="text-xs">
              Enter the firm identifier and your account credentials.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="firm_slug">Firm Identifier</Label>
                <Input
                  id="firm_slug"
                  type="text"
                  placeholder="e.g. smithlaw"
                  autoComplete="organization"
                  aria-invalid={!!errors.firm_slug}
                  {...register('firm_slug')}
                />
                {errors.firm_slug && (
                  <p className="text-xs text-red-600">{errors.firm_slug.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-invalid={!!errors.email}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={!!errors.password}
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-xs text-red-600">{errors.password.message}</p>
                )}
              </div>

              {apiError && (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-700">{apiError}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={isSubmitting || login.isPending}
              >
                {(isSubmitting || login.isPending) ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
