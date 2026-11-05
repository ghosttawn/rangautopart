import { type ReactNode, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import { AboutPage, AccountPage, CartPage, CatalogPage, CheckoutPage, ContactPage, HomePage, OrderPage, OrdersPage, PrivacyPage, ProductPage, TermsPage } from '@/pages/StorePages';
import { AdminCategoriesPage, AdminCustomersPage, AdminInventoryPage, AdminOrdersPage, AdminOverviewPage, AdminProductsPage, AdminSettingsPage } from '@/pages/AdminPages';
import { ForgotPasswordPage, ResetPasswordPage, SignInPage, SignUpPage } from '@/pages/AuthPages';
import { useGetAuthSession } from '@workspace/api-client-react';
import { SeoController } from '@/components/seo';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function Router() {
  const { data: session } = useGetAuthSession();
  const client = useQueryClient();
  const priorIdentity = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!session) return;
    const identity = session.user?.id ?? null;
    if (priorIdentity.current !== undefined && priorIdentity.current !== identity) {
      client.removeQueries({ predicate: query => ['/api/account', '/api/cart', '/api/customer', '/api/admin'].some(part => JSON.stringify(query.queryKey).includes(part)) });
    }
    priorIdentity.current = identity;
  }, [session?.user?.id, client]);
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/sign-in">{() => <SignInPage />}</Route>
        <Route path="/sign-up" component={SignUpPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/admin/login">{() => <SignInPage admin />}</Route>
        <Route path="/catalog" component={CatalogPage} />
        <Route path="/product/:slug" component={ProductPage} />
        <Route path="/cart" component={CartPage} />
        <Route path="/checkout" component={CheckoutPage} />
        <Route path="/order/:orderNumber" component={OrderPage} />
        <Route path="/account" component={AccountPage} />
        <Route path="/orders" component={OrdersPage} />
        <Route path="/contact" component={ContactPage} />
        <Route path="/about" component={AboutPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/terms" component={TermsPage} />
        <Route path="/admin" component={AdminOverviewPage} />
        <Route path="/admin/products" component={AdminProductsPage} />
        <Route path="/admin/inventory" component={AdminInventoryPage} />
        <Route path="/admin/categories" component={AdminCategoriesPage} />
        <Route path="/admin/orders" component={AdminOrdersPage} />
        <Route path="/admin/customers" component={AdminCustomersPage} />
        <Route path="/admin/settings" component={AdminSettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
          <WouterRouter base={basePath}>
          <SeoController />
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
