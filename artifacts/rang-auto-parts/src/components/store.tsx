import { Link } from 'wouter';
import { ArrowRight, Check, ChevronRight, PackageCheck, Search, ShieldCheck, ShoppingBag, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { getGetCartQueryKey, useAddCartItem } from '@workspace/api-client-react';
import type { ProductCard } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

export function Brand() {
  return <Link href="/" className="brand" data-testid="link-brand"><span className="brand-mark"><Wrench size={18} /></span><span className="brand-name">RANG</span></Link>;
}

export function Header() {
  return <>
    <div className="topline">THE RIGHT PART. THE FIRST TIME. &nbsp;·&nbsp; CASH ON DELIVERY AVAILABLE</div>
    <header className="header"><div className="shell header-inner">
      <Brand />
      <nav className="nav-links" aria-label="Main navigation">
        <Link href="/catalog" data-testid="link-parts-catalog">Parts catalog</Link><Link href="/about" data-testid="link-about">Our standard</Link><Link href="/contact" data-testid="link-contact">Contact</Link>
      </nav>
      <span className="spacer" />
      <Link href="/catalog" className="header-action" data-testid="link-search"><Search size={17}/><span className="desktop-label">Find a part</span></Link>
      <Link href="/cart" className="header-action" data-testid="link-cart"><ShoppingBag size={18}/><span>Cart</span></Link>
      <Link href="/account" className="header-action" data-testid="link-account"><span>Account</span></Link>
      <Link href="/catalog" className="header-action mobile-menu" aria-label="Open parts catalog" data-testid="link-mobile-catalog"><Search size={19}/></Link>
    </div></header>
  </>;
}

export function Footer() {
  return <footer className="footer"><div className="shell footer-grid">
    <div><Brand/><p style={{maxWidth:330,color:'#c6d0c7',fontSize:13,lineHeight:1.8}}>Parts for the machines that keep you moving. Clear details, sensible service, and no guesswork about what you are buying.</p></div>
    <div><span className="eyebrow" style={{color:'#aab9b1'}}>Shop</span><Link href="/catalog" data-testid="footer-catalog">All parts</Link><Link href="/cart" data-testid="footer-cart">Your cart</Link><Link href="/orders" data-testid="footer-orders">Order history</Link></div>
    <div><span className="eyebrow" style={{color:'#aab9b1'}}>RANG</span><Link href="/about" data-testid="footer-about">About us</Link><Link href="/contact" data-testid="footer-contact">Contact</Link><Link href="/privacy" data-testid="footer-privacy">Privacy</Link><Link href="/terms" data-testid="footer-terms">Terms</Link></div>
  </div></footer>;
}

export function PageFrame({children}: {children: ReactNode}) {
  return <><Header/>{children}<Footer/></>;
}

export function ProductVisual({product, className=''}:{product:ProductCard;className?:string}) {
  return <div className={`product-image ${className}`}>{product.imageUrl ? <img src={product.imageUrl} alt={product.name}/> : <div className="image-fallback" aria-label="No product image available"><Wrench size={44} strokeWidth={1}/></div>}</div>;
}

export function ProductCardView({product,currency}:{product:ProductCard;currency?:string|null}) {
  const price = product.salePriceMinor ?? product.priceMinor;
  return <article className="product-card" data-testid={`card-product-${product.id}`}>
    <Link href={`/product/${product.slug}`} className="product-card-link" data-testid={`link-product-${product.id}`}>
      <ProductVisual product={product}/>
      <div className="product-details"><div className="eyebrow">{product.category || 'Parts'}{product.brand ? ` / ${product.brand}` : ''}</div>
        <h3>{product.name}</h3><div className="product-price">{money(price, currency)} {product.salePriceMinor != null && <span className="old-price">{money(product.priceMinor,currency)}</span>}</div>
        <div style={{marginTop:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}><span className="status-pill">{product.stock > 0 ? 'In stock' : 'Check availability'}</span><ChevronRight size={16}/></div>
      </div>
    </Link>
    <div style={{padding:'0 15px 15px'}}><AddCartButton product={product} testId={`button-add-to-cart-${product.id}`} fullWidth/></div>
  </article>;
}

export function AddCartButton({product,quantity=1,testId,fullWidth=false}:{product:ProductCard;quantity?:number;testId?:string;fullWidth?:boolean}) {
  const mutation=useAddCartItem();
  const queryClient=useQueryClient();
  return <div>
    <button className="btn btn-accent" style={{width:fullWidth?'100%':undefined}} disabled={product.stock<=0||mutation.isPending} onClick={()=>mutation.mutate({data:{productId:product.id,quantity}},{onSuccess:cart=>{queryClient.setQueryData(getGetCartQueryKey(),cart);void queryClient.invalidateQueries({queryKey:getGetCartQueryKey()})}})} data-testid={testId||`button-add-to-cart-${product.id}`}>
      <ShoppingBag size={16}/>{product.stock<=0?'Out of stock':mutation.isPending?'Adding…':mutation.isSuccess?'Added to cart':'Add to cart'}
    </button>
    {mutation.isError&&<p className="notice error" role="alert" data-testid={`status-add-cart-error-${product.id}`} style={{fontSize:11,margin:'8px 0 0'}}>{mutation.error instanceof Error?mutation.error.message:'Unable to add this part to your cart.'}</p>}
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
