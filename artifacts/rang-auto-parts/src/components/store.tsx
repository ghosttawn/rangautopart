import { Link, useLocation } from 'wouter';
import { ArrowRight, Check, ChevronRight, Menu, PackageCheck, Search, ShieldCheck, ShoppingBag, Wrench, X, Plus, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { getGetCartQueryKey, getListProductsQueryKey, useAddCartItem, useGetCart, useListProducts, useRemoveCartItem, useUpdateCartItem } from '@workspace/api-client-react';
import type { ProductCard } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { toApiUrl } from '@/lib/utils';

export function Brand() {
  return <Link href="/" className="brand" data-testid="link-brand"><span className="brand-mark"><Wrench size={18} /></span><span className="brand-name">RANG AUTO PARTS</span></Link>;
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: cart } = useGetCart();
  const cartCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const closeMenu = () => setMenuOpen(false);
  return <>
    <header className="header"><div className="shell header-inner">
      <Brand />
      <nav className="nav-links" aria-label="Main navigation">
        <Link href="/catalog" data-testid="link-parts-catalog">Parts catalog</Link><Link href="/about" data-testid="link-about">Our standard</Link><Link href="/contact" data-testid="link-contact">Contact</Link>
      </nav>
      <span className="spacer" />
      <QuickSearch/>
      <Link href="/cart" className="header-action cart-nav-link" aria-label={`Cart${cartCount ? `, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}` : ', empty'}`} data-testid="link-cart"><ShoppingBag size={18}/><span>Cart</span><span className="cart-count" aria-live="polite" data-testid="text-cart-count">{cartCount}</span></Link>
      <Link href="/account" className="header-action header-account" data-testid="link-account"><span>Account</span></Link>
      <button type="button" className="header-action mobile-menu" aria-label={menuOpen?'Close navigation menu':'Open navigation menu'} aria-expanded={menuOpen} aria-controls="mobile-main-nav" onClick={()=>setMenuOpen(value=>!value)} data-testid="button-mobile-menu">{menuOpen?<X size={20}/>:<Menu size={20}/>}</button>
    </div>
    {menuOpen&&<nav id="mobile-main-nav" className="mobile-nav shell" aria-label="Mobile navigation">
      <Link href="/catalog" onClick={closeMenu} data-testid="link-mobile-parts">Parts catalog</Link>
      <Link href="/about" onClick={closeMenu} data-testid="link-mobile-about">Our standard</Link>
      <Link href="/contact" onClick={closeMenu} data-testid="link-mobile-contact">Contact</Link>
      <Link href="/account" onClick={closeMenu} data-testid="link-mobile-account">My account</Link>
      <Link href="/orders" onClick={closeMenu} data-testid="link-mobile-orders">Order history</Link>
    </nav>}</header>
  </>;
}

function QuickSearch() {
  const [,setLocation]=useLocation();
  const [term,setTerm]=useState('');
  const [open,setOpen]=useState(false);
  const [active,setActive]=useState(-1);
  const searchParams={q:term.trim(),page:1,limit:5,availability:'all' as const};
  const query=useListProducts(searchParams,{query:{enabled:term.trim().length>1,queryKey:getListProductsQueryKey(searchParams)}});
  const items=query.data?.items??[];
  const choose=(slug:string)=>{setLocation(`/product/${encodeURIComponent(slug)}`);setOpen(false)};
  return <div className="quick-search">
    <form onSubmit={e=>{e.preventDefault();setLocation(`/catalog?q=${encodeURIComponent(term)}`);setOpen(false)}}>
      <label className="quick-search-input"><Search size={16}/><input aria-label="Find a part" placeholder="Find a part" value={term} onFocus={()=>setOpen(true)} onBlur={()=>window.setTimeout(()=>setOpen(false),120)} onChange={e=>{setTerm(e.target.value);setActive(-1);setOpen(true)}} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setActive(v=>Math.min(items.length-1,v+1))}if(e.key==='ArrowUp'){e.preventDefault();setActive(v=>Math.max(-1,v-1))}if(e.key==='Enter'&&active>=0&&items[active]){e.preventDefault();choose(items[active].slug)}if(e.key==='Escape')setOpen(false)}} aria-expanded={open&&term.length>1} aria-controls="quick-search-results" autoComplete="off" data-testid="input-quick-search"/></label>
    </form>
    {open&&term.trim().length>1&&<div className="search-suggest" id="quick-search-results" role="listbox" aria-label="Product suggestions">{query.isLoading?<div className="suggest-loading" role="status">Searching the catalog…</div>:query.isError?<div className="suggest-loading" role="status">Suggestions are unavailable. Search the catalog instead.</div>:items.length?items.map((p,i)=><Link href={`/product/${p.slug}`} role="option" aria-selected={active===i} key={p.id} onMouseDown={()=>setOpen(false)} data-testid={`suggestion-product-${p.id}`}>{p.imageUrl?<img src={toApiUrl(p.imageUrl) ?? p.imageUrl} alt="" loading="lazy" decoding="async"/>:<span className="suggest-icon"><Wrench size={18}/></span>}<span className="suggest-copy"><strong>{p.name}</strong><small>{p.brand||p.category||'Part'} · SKU {p.sku}</small></span><ChevronRight size={15}/></Link>):<div className="suggest-loading">No matching parts yet.</div>}</div>}
  </div>;
}

export function Footer() {
  return <footer className="footer"><div className="shell footer-grid">
    <div><Brand/><p style={{maxWidth:330,color:'#c6d0c7',fontSize:13,lineHeight:1.8}}>Parts for the machines that keep you moving. Clear details, sensible service, and no guesswork about what you are buying.</p></div>
    <div><span className="eyebrow" style={{color:'#aab9b1'}}>Shop</span><Link href="/catalog" data-testid="footer-catalog">All parts</Link><Link href="/cart" data-testid="footer-cart">Your cart</Link><Link href="/orders" data-testid="footer-orders">Order history</Link></div>
    <div><span className="eyebrow" style={{color:'#aab9b1'}}>RANG</span><Link href="/about" data-testid="footer-about">About us</Link><Link href="/contact" data-testid="footer-contact">Contact</Link><Link href="/privacy" data-testid="footer-privacy">Privacy</Link><Link href="/terms" data-testid="footer-terms">Terms</Link></div>
  </div></footer>;
}

export function PageFrame({children}: {children: ReactNode}) {
  return <><Header/><CartPreview/>{children}<Footer/></>;
}

export function ProductVisual({product, className=''}:{product:ProductCard;className?:string}) {
  return <div className={`product-image ${className}`}>{product.imageUrl ? <img src={toApiUrl(product.imageUrl) ?? product.imageUrl} alt={product.name} loading="lazy" decoding="async"/> : <div className="image-fallback" aria-label="No product image available"><Wrench size={44} strokeWidth={1}/></div>}</div>;
}

export function ProductCardView({product,currency}:{product:ProductCard;currency?:string|null}) {
  const price = product.salePriceMinor ?? product.priceMinor;
  return <article className="product-card" data-testid={`card-product-${product.id}`}>
    <Link href={`/product/${product.slug}`} className="product-card-link" data-testid={`link-product-${product.id}`}>
      <ProductVisual product={product}/>
      <div className="product-details"><div className="eyebrow">{product.category || 'Parts'}{product.brand ? ` / ${product.brand}` : ''}</div>
        <h3>{product.name}</h3><div className="product-price">{money(price, currency)} {product.salePriceMinor != null && <span className="old-price">{money(product.priceMinor,currency)}</span>}</div>
        <div style={{marginTop:12,display:'flex',justifyContent:'space-between',alignItems:'center',gap:7}}><span className="status-pill">{product.stock > 0 ? `${product.stock} in stock` : 'Check availability'}</span><span className="fitment-status" title={product.compatibilityStatus==='verified'?'Fitment information verified':'Fitment has not been verified'}>{product.compatibilityStatus==='verified'?<><Check size={13}/>Fitment verified</>:<>Fitment unknown</>}</span></div>
      </div>
    </Link>
    <div style={{padding:'0 15px 15px'}}><AddCartButton product={product} testId={`button-add-to-cart-${product.id}`} fullWidth/></div>
  </article>;
}

export function AddCartButton({product,quantity=1,testId,fullWidth=false}:{product:ProductCard;quantity?:number;testId?:string;fullWidth?:boolean}) {
  const mutation=useAddCartItem();
  const queryClient=useQueryClient();
  return <div>
    <button className="btn btn-accent" style={{width:fullWidth?'100%':undefined}} disabled={product.stock<=0||mutation.isPending} onClick={()=>mutation.mutate({data:{productId:product.id,quantity}},{onSuccess:cart=>{queryClient.setQueryData(getGetCartQueryKey(),cart);window.dispatchEvent(new CustomEvent('rang-cart-preview',{detail:{productId:product.id}}))}})} data-testid={testId||`button-add-to-cart-${product.id}`}>
      <ShoppingBag size={16}/>{product.stock<=0?'Out of stock':mutation.isPending?'Adding…':mutation.isSuccess?'Added to cart':'Add to cart'}
    </button>
    {mutation.isError&&<p className="notice error" role="alert" data-testid={`status-add-cart-error-${product.id}`} style={{fontSize:11,margin:'8px 0 0'}}>{mutation.error instanceof Error?mutation.error.message:'Unable to add this part to your cart.'}</p>}
  </div>;
}

function CartPreview() {
  const { data: cart } = useGetCart();
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const cartLine = cart?.items.find(item => item.productId === productId) ?? cart?.items[0];
  useEffect(() => {
    const onOpen = (event: Event) => {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setProductId((event as CustomEvent<{productId:string}>).detail.productId);
      setOpen(true);
    };
    window.addEventListener('rang-cart-preview', onOpen);
    return () => window.removeEventListener('rang-cart-preview', onOpen);
  }, []);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
      if (event.key === 'Tab') {
        const items = document.querySelectorAll<HTMLElement>('[data-cart-drawer] button, [data-cart-drawer] a[href]');
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);
  useEffect(() => {
    if (open) return;
    if (returnFocus.current?.isConnected) returnFocus.current.focus();
  }, [open]);
  const refresh = (cartValue: unknown) => {
    queryClient.setQueryData(getGetCartQueryKey(), cartValue);
  };
  if (!open) return null;
  return <div className="cart-drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
    <section className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-preview-title" data-cart-drawer data-testid="cart-preview-drawer">
      <div className="cart-drawer-head"><div><div className="eyebrow">Added to your order</div><h2 className="display" id="cart-preview-title">Cart preview</h2></div><button ref={closeRef} type="button" className="cart-drawer-close" onClick={() => setOpen(false)} aria-label="Close cart preview" data-testid="button-close-cart-preview"><X size={19}/></button></div>
      {cartLine ? <div className="cart-preview-item">
        <Link href={`/product/${cartLine.product.slug}`} className="cart-preview-image" onClick={() => setOpen(false)} data-testid={`link-cart-preview-product-image-${cartLine.productId}`}>{cartLine.product.imageUrl ? <img src={toApiUrl(cartLine.product.imageUrl) ?? cartLine.product.imageUrl} alt={cartLine.product.name} loading="lazy" decoding="async"/> : <Wrench size={28}/>}</Link>
        <div className="cart-preview-copy"><div className="eyebrow">{cartLine.product.sku}</div><Link href={`/product/${cartLine.product.slug}`} onClick={() => setOpen(false)} data-testid={`link-cart-preview-product-${cartLine.productId}`}>{cartLine.product.name}</Link><div className="fitment-status">{cartLine.product.compatibilityStatus === 'verified' ? <><Check size={13}/> Fitment data verified</> : 'Fitment not verified — confirm before ordering'}</div>
          <div className="cart-preview-controls"><button className="btn btn-outline" type="button" disabled={update.isPending || remove.isPending} aria-label="Decrease item quantity" onClick={() => cartLine.quantity <= 1 ? remove.mutate({ productId: cartLine.productId }, { onSuccess: refresh }) : update.mutate({ productId: cartLine.productId, data: { quantity: cartLine.quantity - 1 } }, { onSuccess: refresh })} data-testid={`button-cart-preview-minus-${cartLine.productId}`}><Minus size={13}/></button><span aria-label={`Quantity ${cartLine.quantity}`} className="mono" data-testid={`text-cart-preview-quantity-${cartLine.productId}`}>{cartLine.quantity}</span><button className="btn btn-outline" type="button" disabled={update.isPending || remove.isPending || cartLine.quantity >= 50} aria-label="Increase item quantity" onClick={() => update.mutate({ productId: cartLine.productId, data: { quantity: Math.min(50, cartLine.quantity + 1) } }, { onSuccess: refresh })} data-testid={`button-cart-preview-plus-${cartLine.productId}`}><Plus size={13}/></button><button className="cart-remove" type="button" disabled={remove.isPending} onClick={() => remove.mutate({ productId: cartLine.productId }, { onSuccess: refresh })} data-testid={`button-cart-preview-remove-${cartLine.productId}`}>Remove</button></div>
        </div>
      </div> : <div className="notice">Your cart is empty.</div>}
      <div className="cart-preview-summary"><span>Subtotal</span><strong data-testid="text-cart-preview-subtotal">{money(cart?.subtotalMinor ?? 0, cart?.currency)}</strong></div>
      <p className="cart-preview-note">Delivery is calculated in your cart. Fitment details can vary by model year; check before placing your order.</p>
      {(update.isError || remove.isError) && <p className="notice error" role="alert">Cart could not be updated. Please try again.</p>}
       <div className="cart-drawer-actions"><Link href="/cart" className="btn btn-outline" onClick={() => setOpen(false)} data-testid="link-open-full-cart">View full cart <ArrowRight size={15}/></Link>{cart?.items.length?<Link href="/checkout" className="btn btn-accent" onClick={() => setOpen(false)} data-testid="link-cart-preview-checkout">Checkout <ArrowRight size={15}/></Link>:<button type="button" className="btn btn-accent" onClick={() => setOpen(false)} data-testid="button-continue-shopping">Continue shopping</button>}</div>
    </section>
  </div>;
}

export function money(minor:number, currency:string|null|undefined) {
  if (!currency) return `${(minor/100).toFixed(2)}`;
  try { return new Intl.NumberFormat(undefined,{style:'currency',currency}).format(minor/100); }
  catch { return `${currency} ${(minor/100).toFixed(2)}`; }
}

export function LoadingState({label='Loading parts'}:{label?:string}) {
  return <div className="shell" role="status" aria-label={label} style={{padding:'36px 0'}}><div className="skeleton" style={{height:30,width:'42%',marginBottom:18}}/><div className="product-grid">{[1,2,3,4].map(n=><div className="product-card" key={n}><div className="skeleton" style={{height:190}}/><div style={{padding:15}}><div className="skeleton" style={{height:12,width:'45%',marginBottom:14}}/><div className="skeleton" style={{height:18,width:'80%'}}/></div></div>)}</div></div>;
}

export function ApiNotice({error,onRetry}:{error:unknown;onRetry?:()=>void}) {
  const message = error instanceof Error ? error.message : 'We could not reach the parts service. Please try again.';
  const status = (error as {status?:number}|undefined)?.status;
  const isDenied = status === 401 || status === 403;
  return <div className="notice error" role="alert" data-testid="status-api-error"><strong>{isDenied ? 'Access not available' : 'Something did not load'}</strong><div>{isDenied ? (status === 401 ? 'Sign in to view this information.' : 'Your account does not currently have permission to view this information.') : message}</div>{onRetry && <button className="btn btn-outline" style={{marginTop:12}} onClick={onRetry} data-testid="button-retry">Try again</button>}</div>;
}

export function TrustStrip() {
  return <div className="trust-strip shell"><div className="trust-item"><Check size={15}/> Product details from the source</div><div className="trust-item"><ShieldCheck size={15}/> Secure order handling</div><div className="trust-item"><PackageCheck size={15}/> Cash on delivery</div><div className="trust-item"><Wrench size={15}/> Built for real-world repairs</div></div>;
}

export function EmptyPanel({title,body,action,href}:{title:string;body:string;action?:string;href?:string}) {
  return <div className="notice" style={{padding:30,textAlign:'center'}}><PackageCheck size={26} style={{margin:'0 auto 14px',color:'hsl(var(--primary))'}}/><h2 className="display" style={{margin:'0 0 8px',fontSize:23}}>{title}</h2><p style={{margin:'0 auto 18px',maxWidth:430,color:'hsl(var(--muted-foreground))'}}>{body}</p>{action&&href&&<Link href={href} className="btn" data-testid="link-empty-action">{action}<ArrowRight size={15}/></Link>}</div>;
}

export function InlineError({message}:{message:string}) { return <p className="notice error" role="alert" data-testid="status-form-error">{message}</p>; }
