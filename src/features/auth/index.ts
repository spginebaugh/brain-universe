// Components
export { SignInForm } from './components/sign-in-form';
export { SignUpForm } from './components/sign-up-form';
export { AuthLayout } from './layouts/auth-layout';

// Hooks
export { useAuth } from './hooks/use-auth';

// Services
export { authService } from './services/auth-service';

// Store
export { useAuthStore } from './stores/auth-store';

// Types
export type { SignInFormData, SignUpFormData } from './schemas/auth.schema';

// Utils
export {
  protectedPaths,
  authPaths,
  handleProtectedRoute,
  handleAuthRoute,
} from './utils/middleware'; 