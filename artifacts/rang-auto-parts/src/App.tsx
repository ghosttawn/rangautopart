import { type ReactNode, useEffect, useRef } from 'react';
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Redirect,
  Router as WouterRouter,
} from 'wouter';
import { AboutPage, AccountPage, CartPage, CatalogPage, CheckoutPage, ContactPage, HomePage, OrderPage, OrdersPage, PrivacyPage, ProductPage, TermsPage } from '@/pages/StorePages';
import { AdminCategoriesPage, AdminCustomersPage, AdminInventoryPage, AdminOrdersPage, AdminOverviewPage, AdminProductsPage, AdminSettingsPage } from '@/pages/AdminPages';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#28634f',
    colorForeground: '#26373b',
    colorMutedForeground: '#687875',
    colorDanger: '#a13b32',
    colorBackground: '#fbf9f1',
    colorInput: '#fffdf6',
    colorInputForeground: '#26373b',
    colorNeutral: '#26373b',
    fontFamily: 'Manrope, sans-serif',
    borderRadius: '6px',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbf9f1] rounded-xl w-[440px] max-w-full overflow-hidden border border-[#d9d4c7]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#26373b] font-bold',
    headerSubtitle: 'text-[#687875]',
    socialButtonsBlockButtonText: 'text-[#26373b] font-semibold',
    formFieldLabel: 'text-[#26373b] font-semibold',
    footerActionLink: 'text-[#28634f] font-bold',
    footerActionText: 'text-[#687875]',
    dividerText: 'text-[#687875]',
    identityPreviewEditButton: 'text-[#28634f]',
    formFieldSuccessText: 'text-[#28634f]',
    alertText: 'text-[#8b332c]',
    logoBox: 'mx-auto',
    logoImage: 'max-h-10',
    socialButtonsBlockButton: 'border border-[#d9d4c7] bg-[#fffdf6]',
    formButtonPrimary: 'bg-[#28634f] text-[#fbf9f1] font-bold',
    formFieldInput: 'bg-[#fffdf6] text-[#26373b] border-[#d9d4c7]',
    footerAction: 'text-[#687875]',
    dividerLine: 'bg-[#d9d4c7]',
    alert: 'bg-[#f6e8e3] border-[#d7a39b]',
    otpCodeFieldInput: 'bg-[#fffdf6] text-[#26373b]',
    formFieldRow: 'text-[#26373b]',
    main: 'text-[#26373b]',
  },
};

function SignInPage() {
  return <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-22 bg-background px-4 py-12">
    <div className="shell" style={{maxWidth:800,textAlign:'center',marginBottom:30}}><div className="eyebrow">RANG AUTO PARTS / YOUR ACCOUNT</div><h1 className="display" style={{fontSize:42,margin:'12px 0 6px'}}>Welcome back to the workshop.</h1><p style={{color:'hsl(var(--muted-foreground))'}}>Sign in to view your orders and manage your details.</p></div>
    <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
  </div>;
}

function SignUpPage() {
  return <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-4 py-12">
    <div className="shell" style={{maxWidth:800,textAlign:'center',marginBottom:30}}><div className="eyebrow">RANG AUTO PARTS / GET STARTED</div><h1 className="display" style={{fontSize:42,margin:'12px 0 6px'}}>Make the next repair simpler.</h1><p style={{color:'hsl(var(--muted-foreground))'}}>Create an account to keep your order details together.</p></div>
    <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
  </div>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({user}) => {
      const userId = user?.id ?? null;
      if (previousUserId.current !== undefined && previousUserId.current !== userId) client.clear();
      previousUserId.current = userId;
    });
    return unsubscribe;
  }, [addListener, client]);
  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{signIn:{start:{title:'Welcome back',subtitle:'Sign in to manage your RANG account'}},signUp:{start:{title:'Create your RANG account',subtitle:'Keep your orders and details together'}}}}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), {replace:true})}
  >
    <ClerkQueryClientCacheInvalidator />
    <Router />
  </ClerkProvider>;
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/"><Show when="signed-in"><Redirect to="/account" /></Show><Show when="signed-out"><HomePage /></Show></Route>
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
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
          <ClerkProviderWithRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
