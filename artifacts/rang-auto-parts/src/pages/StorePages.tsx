import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { ArrowRight, BadgeCheck, Check, ChevronLeft, ChevronRight, CircleDollarSign, Gauge, Mail, Minus, Phone, Plus, SlidersHorizontal, Truck, Wrench, X } from 'lucide-react';
import { getGetAccountQueryKey, getGetAuthSessionQueryKey, getGetCartQueryKey, useChangePassword, useCreateSupportMessage, useGetAccount, useGetCart, useGetCustomerOrder, useGetProduct, useGetStorefront, useListCategories, useListCustomerOrders, useListProducts, useLogoutAccount, useRemoveCartItem, useSubmitOrder, useUpdateAccount, useUpdateCartItem } from '@workspace/api-client-react';
import type { CheckoutInput, CheckoutResult, ListProductsParams } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { AddCartButton, ApiNotice, EmptyPanel, InlineError, LoadingState, money, PageFrame, ProductCardView, ProductVisual, TrustStrip } from '@/components/store';

export function HomePage() {
  const {data:store,isLoading,isError,error,refetch}=useGetStorefront();
  const products = store?.featured ?? [];
  const [heroFailed,setHeroFailed]=useState(false);
  useEffect(()=>setHeroFailed(false),[store?.settings.heroImageUrl]);
  const settings=store?.settings;
  const heroImage=heroFailed?'/rang-hero.jpg':settings?.heroImageUrl||'/rang-hero.jpg';
  return <PageFrame>
    <section className="hero"><div className="shell hero-grid"><div className="hero-copy">
      <div className="eyebrow" style={{color:'#c6d0c7'}}>RANG AUTO PARTS &nbsp; / &nbsp; BUILT TO FIT YOUR DAY</div>
      <h1><span>{settings?.heroTitle||'Keep your'}</span><br/><span>{settings?.heroHighlight||'machine moving.'}</span></h1><p>{settings?.heroDescription||'Reliable parts for ATVs, cars, motorcycles and utility vehicles. Find the right piece, know what you are getting, and get on with the repair.'}</p>
      <div style={{display:'flex',gap:10,marginTop:28,flexWrap:'wrap'}}><Link className="btn btn-accent" href="/catalog" data-testid="button-shop-parts">Shop parts <ArrowRight size={16}/></Link><Link className="btn btn-outline" href="/contact" style={{color:'#f8f5e9',borderColor:'#6f8178'}} data-testid="button-ask-help">Ask for help</Link></div>
    </div></div><img className="hero-photo" src={heroImage} alt="" aria-hidden="true" width="1024" height="1024" fetchPriority="high" onError={()=>setHeroFailed(true)}/></section>
    <TrustStrip/>
    <section className="shell section"><div className="section-heading"><div><div className="eyebrow">Shop by machine</div><h2>Start with your ride.</h2></div><Link href="/catalog" className="header-action" data-testid="link-all-categories">Browse all parts <ArrowRight size={15}/></Link></div>
      {isLoading?<div className="category-grid">{[1,2,3,4].map(i=><div key={i} className="skeleton" style={{height:150}}/>)}</div>:isError?<ApiNotice error={error} onRetry={()=>refetch()}/>:<div className="category-grid">{(store?.categories ?? []).map((cat,i)=><Link href={`/catalog?category=${encodeURIComponent(cat.slug)}`} className="category-tile" key={cat.id} data-testid={`link-category-${cat.id}`}><span>{cat.name}</span><span>{cat.productCount} {cat.productCount===1?'part':'parts'} <ArrowRight size={13}/></span>{cat.imageUrl?<img className="category-tile-photo" src={cat.imageUrl} alt="" aria-hidden="true" loading="lazy"/>:<Wrench size={46}/>}</Link>)}</div>}
    </section>
    <section className="shell section" style={{paddingTop:8}}><div className="section-heading"><div><div className="eyebrow">A good place to start</div><h2>Featured parts.</h2></div><Link href="/catalog" className="header-action" data-testid="link-featured-all">View catalog <ArrowRight size={15}/></Link></div>
      {isLoading?<LoadingState/>:isError?<ApiNotice error={error} onRetry={()=>refetch()}/>:products.length?<div className="product-grid">{products.slice(0,8).map(p=><ProductCardView product={p} key={p.id} currency={store?.settings.currency}/>)}</div>:<EmptyPanel title="The shelf is being stocked" body="Featured products will appear here once the catalog has been published." action="Browse catalog" href="/catalog"/>}
    </section>
    <section className="shell section" style={{paddingTop:0}}><div className="service-band"><div><div className="eyebrow">No guessing games</div><h2>{settings?.promotionalTitle||'Not sure it fits? Ask first.'}</h2><p style={{margin:0,color:'hsl(var(--muted-foreground))'}}>{settings?.promotionalBody||'Send us the make, model and year. We will help you narrow it down before you order.'}</p></div><Link href={settings?.promotionalUrl||'/contact'} className="btn" data-testid="button-contact-fitment">{settings?.promotionalActionLabel||'Talk to our parts desk'} <ArrowRight size={15}/></Link></div></section>
  </PageFrame>;
}

export function CatalogPage() {
  const initial = new URLSearchParams(window.location.search);
  const [term,setTerm]=useState(initial.get('q')||'');
  const [q,setQ]=useState(initial.get('q')||'');
  const [category,setCategory]=useState(initial.get('category')||'');
  const [brand,setBrand]=useState('');
  const [vehicleMake,setVehicleMake]=useState(initial.get('compatibilityMake')||'');
  const [vehicleModel,setVehicleModel]=useState(initial.get('compatibilityModel')||'');
  const [vehicleYear,setVehicleYear]=useState(initial.get('compatibilityYear')||'');
  const [availability,setAvailability]=useState<ListProductsParams['availability']>('all');
  const [sort,setSort]=useState<ListProductsParams['sort']>('relevance');
  const [min,setMin]=useState('');
  const [max,setMax]=useState('');
  const [page,setPage]=useState(1);
  const [filtersOpen,setFiltersOpen]=useState(false);
  const filterPanelRef=useRef<HTMLElement>(null);
  const filterCloseRef=useRef<HTMLButtonElement>(null);
  const filterToggleRef=useRef<HTMLButtonElement>(null);
  const {data:store}=useGetStorefront();
  const {data:categories}=useListCategories();
  const activeFilterCount=[category,brand.trim(),vehicleMake.trim(),vehicleModel.trim(),vehicleYear,min,max,availability!=='all'].filter(Boolean).length;
  const clearFilters=()=>{setCategory('');setBrand('');setVehicleMake('');setVehicleModel('');setVehicleYear('');setAvailability('all');setMin('');setMax('');setPage(1)};
  useEffect(()=>{
    if(!filtersOpen)return;
    const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    filterCloseRef.current?.focus();
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();setFiltersOpen(false);return}
      if(event.key==='Tab'){
        const focusable=filterPanelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]');
        if(!focusable?.length)return;
        const first=focusable[0],last=focusable[focusable.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
      }
    };
    document.addEventListener('keydown',onKeyDown);
    return()=>{document.removeEventListener('keydown',onKeyDown);document.body.style.overflow=previousOverflow;if(previousFocus?.isConnected)previousFocus.focus()};
  },[filtersOpen]);
  const params:ListProductsParams={q:q||undefined,category:category||undefined,brand:brand||undefined,availability,sort,page,limit:24,minPrice:min?Math.round(Number(min)*100):undefined,maxPrice:max?Math.round(Number(max)*100):undefined,compatibilityMake:vehicleMake.trim()||undefined,compatibilityModel:vehicleModel.trim()||undefined,compatibilityYear:vehicleYear?Number(vehicleYear):undefined};
  const {data:results,isLoading,isError,error,refetch}=useListProducts(params);
  const count=results?.total ?? 0;
  return <PageFrame><div className="shell"><div className="page-title"><div className="eyebrow">Catalog / real stock and product details</div><h1>Find your part.</h1><p style={{color:'hsl(var(--muted-foreground))',margin:0}}>Search by part name, brand or SKU. Use the filters to narrow your search.</p></div>
    <button ref={filterToggleRef} type="button" className="btn btn-outline filter-toggle" aria-expanded={filtersOpen} aria-controls="catalog-filter-panel" onClick={()=>setFiltersOpen(value=>!value)} data-testid="button-toggle-catalog-filters"><SlidersHorizontal size={16}/>{filtersOpen?'Hide filters':`Filter parts${activeFilterCount?` · ${activeFilterCount} active`:''}`}</button>
    <div className="catalog-layout">{filtersOpen&&<button type="button" className="filter-sheet-backdrop" aria-label="Close filters" onClick={()=>setFiltersOpen(false)} data-testid="button-close-filter-backdrop"/>}<aside ref={filterPanelRef} id="catalog-filter-panel" className={`filter-panel${filtersOpen?' filters-open':''}`} aria-label="Catalog filters" role={filtersOpen?'dialog':undefined} aria-modal={filtersOpen?true:undefined} aria-labelledby={filtersOpen?'catalog-filter-title':undefined}>
      <div className="filter-panel-header"><div><h2 id="catalog-filter-title">Filters</h2><span className="eyebrow">{activeFilterCount?`${activeFilterCount} active`:'No filters active'}</span></div><div className="filter-panel-actions"><button type="button" className="filter-clear" onClick={clearFilters} data-testid="button-clear-catalog-filters">Clear all</button><button ref={filterCloseRef} type="button" className="filter-close" onClick={()=>setFiltersOpen(false)} aria-label="Close filters" data-testid="button-close-catalog-filters"><X size={19}/></button></div></div>
      <div className="filter-group"><h3>Category</h3><label className="filter-option"><input type="radio" name="category" checked={!category} onChange={()=>{setCategory('');setPage(1)}}/> All categories</label>{(categories??[]).map(c=><label className="filter-option" key={c.id}><input type="radio" name="category" checked={category===c.slug} onChange={()=>{setCategory(c.slug);setPage(1)}}/> {c.name}</label>)}</div>
      <div className="filter-group"><h3>Availability</h3><label className="filter-option"><input type="radio" name="availability" checked={availability==='all'} onChange={()=>{setAvailability('all');setPage(1)}}/> Any availability</label><label className="filter-option"><input type="radio" name="availability" checked={availability==='in_stock'} onChange={()=>{setAvailability('in_stock');setPage(1)}}/> In stock</label></div>
      <div className="filter-group"><h3>Brand</h3><label className="label">Brand<input className="field" value={brand} onChange={e=>{setBrand(e.target.value);setPage(1)}} placeholder="Filter by brand" data-testid="input-brand-filter"/></label></div>
      <div className="filter-group"><h3>Vehicle fitment</h3><div className="vehicle-filter"><label className="label">Make<input className="field" value={vehicleMake} onChange={e=>{setVehicleMake(e.target.value);setPage(1)}} placeholder="e.g. Honda" aria-label="Vehicle make" data-testid="input-fitment-make"/></label><label className="label">Model<input className="field" value={vehicleModel} onChange={e=>{setVehicleModel(e.target.value);setPage(1)}} placeholder="e.g. TRX420" aria-label="Vehicle model" data-testid="input-fitment-model"/></label><label className="label">Year<input className="field" type="number" min="1886" max="2100" value={vehicleYear} onChange={e=>{setVehicleYear(e.target.value);setPage(1)}} placeholder="Year" aria-label="Vehicle year" data-testid="input-fitment-year"/></label></div><p style={{fontSize:11,lineHeight:1.5,color:'hsl(var(--muted-foreground))',margin:0}}>Results use fitment data on file. Confirm exact fitment before ordering if status is unverified.</p></div>
      <div className="filter-group"><h3>Price range</h3><label className="label">From<input className="field" type="number" min="0" max={max||undefined} inputMode="decimal" placeholder="0" value={min} onChange={e=>{const next=e.target.value;setMin(next);if(next&&max&&Number(next)>Number(max))setMax('');setPage(1)}} data-testid="input-min-price"/></label><label className="label">To<input className="field" type="number" min={min||0} inputMode="decimal" placeholder="Any" value={max} onChange={e=>{setMax(e.target.value);setPage(1)}} data-testid="input-max-price"/></label></div>
      <div className="filter-panel-footer"><button type="button" className="btn btn-accent" onClick={()=>setFiltersOpen(false)} data-testid="button-apply-catalog-filters">Show {count} {count===1?'part':'parts'}</button></div>
    </aside><main>
      <form className="catalog-toolbar" onSubmit={e=>{e.preventDefault();setQ(term);setPage(1)}}><div style={{display:'flex',gap:8,flex:1}}><input className="field" value={term} onChange={e=>setTerm(e.target.value)} placeholder="Search name, brand or SKU" aria-label="Search products" data-testid="input-catalog-search"/><button className="btn" type="submit" data-testid="button-catalog-search">Search</button></div><label className="eyebrow" style={{display:'flex',alignItems:'center',gap:8}}>Sort <select className="field" style={{width:180}} value={sort} onChange={e=>{setSort(e.target.value as ListProductsParams['sort']);setPage(1)}} data-testid="select-sort"><option value="relevance">Recommended</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="newest">Newest</option></select></label></form>
      <p className="eyebrow" style={{margin:'0 0 16px'}} data-testid="text-results-count">{isLoading?'Searching…':`${count} ${count===1?'result':'results'}`}</p>
      {isLoading?<LoadingState/>:isError?<ApiNotice error={error} onRetry={()=>refetch()}/>:results?.items.length?<><div className="product-grid">{results.items.map(p=><ProductCardView key={p.id} product={p} currency={store?.settings.currency}/>)}</div><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'28px 0'}}><button className="btn btn-outline" disabled={page<=1} onClick={()=>setPage(page-1)} data-testid="button-prev-page"><ChevronLeft size={16}/> Previous</button><span className="eyebrow">Page {results.page}</span><button className="btn btn-outline" disabled={page*results.limit>=results.total} onClick={()=>setPage(page+1)} data-testid="button-next-page">Next <ChevronRight size={16}/></button></div></>:<EmptyPanel title="No parts found" body="Try a different part name, SKU or filter. If you still cannot find it, our parts desk can help." action="Contact the parts desk" href="/contact"/>}
    </main></div></div></PageFrame>;
}

export function ProductPage() {
  const params=useParams<{slug:string}>(); const slug=params.slug||'';
  const {data:product,isLoading,isError,error,refetch}=useGetProduct(slug);
  const {data:store}=useGetStorefront();
  const [qty,setQty]=useState(1);const [activeImage,setActiveImage]=useState(0);const [imageOpen,setImageOpen]=useState(false);
  const imageDialogRef=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=imageDialogRef.current;if(!dialog)return;if(imageOpen&&!dialog.open)dialog.showModal();else if(!imageOpen&&dialog.open)dialog.close()},[imageOpen]);
  if(isLoading)return <PageFrame><LoadingState label="Loading product"/></PageFrame>;
  if(isError||!product)return <PageFrame><div className="shell" style={{padding:'50px 0'}}><ApiNotice error={error} onRetry={()=>refetch()}/></div></PageFrame>;
  const price=product.salePriceMinor??product.priceMinor;
  const gallery=product.images.map(image=>image.url);
  const heroImage=gallery[activeImage]||product.imageUrl;
  return <PageFrame><div className="shell" style={{padding:'26px 0 64px'}}><div className="eyebrow" style={{marginBottom:24}}><Link href="/catalog">Catalog</Link> &nbsp;/&nbsp; {product.category||'Part'} &nbsp;/&nbsp; {product.sku}</div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'clamp(24px,5vw,70px)'}} className="product-detail-grid">
      <div><button type="button" className="product-image detail-visual image-zoom-trigger" onClick={()=>setImageOpen(true)} disabled={!heroImage} aria-label={`View full-size image of ${product.name}`} data-testid="button-open-full-image">{heroImage?<img src={heroImage} alt={product.images[activeImage]?.altText||product.name}/>:<Wrench size={58} color="#8e9b91" strokeWidth={1}/>}</button><dialog ref={imageDialogRef} className="product-image-lightbox" aria-label={`${product.name} full-size image`} onClose={()=>setImageOpen(false)} onClick={event=>{if(event.target===event.currentTarget)setImageOpen(false)}}>{heroImage&&<img src={heroImage} alt={product.images[activeImage]?.altText||product.name}/>}<button type="button" className="btn btn-accent lightbox-close" onClick={()=>setImageOpen(false)} data-testid="button-close-full-image">Close</button></dialog>{gallery.length>1&&<div style={{display:'flex',gap:9,marginTop:10,overflowX:'auto'}}>{gallery.map((url,index)=><button key={url} onClick={()=>setActiveImage(index)} aria-label={`View product image ${index+1}`} aria-pressed={activeImage===index} data-testid={`button-product-image-${index}`} style={{width:68,height:68,padding:0,border:activeImage===index?'2px solid hsl(var(--primary))':'1px solid hsl(var(--border))',background:'transparent',cursor:'pointer',flexShrink:0}}><img src={url} alt={product.images[index]?.altText||`${product.name} view ${index+1}`} style={{width:'100%',height:'100%',objectFit:'contain'}}/></button>)}</div>}<div className="eyebrow" style={{marginTop:12}}>SKU / {product.sku}</div></div>
      <div><div className="eyebrow">{product.brand||'RANG verified listing'}</div><h1 className="display" style={{fontSize:'clamp(35px,5vw,56px)',lineHeight:1,margin:'12px 0 17px'}}>{product.name}</h1><div className="product-price" style={{fontSize:27}}>{money(price,store?.settings.currency)} {product.salePriceMinor!=null&&<span className="old-price">{money(product.priceMinor,store?.settings.currency)}</span>}</div>
        <p style={{lineHeight:1.8,color:'hsl(var(--muted-foreground))',margin:'22px 0'}}>{product.description}</p>
        <div className="notice" style={{display:'flex',gap:12,alignItems:'flex-start',marginBottom:18}}><BadgeCheck size={19} color="hsl(var(--primary))"/><div><strong>{product.compatibilityStatus==='verified'?'Verified compatibility data':'Compatibility not verified'}</strong><div style={{fontSize:12,color:'hsl(var(--muted-foreground))'}}>{product.compatibilityStatus==='verified'?'Fitment details are listed below. Check your vehicle details before ordering.':'No verified fitment information is available for this listing. Please contact us to confirm before ordering.'}</div></div></div>
        <div style={{display:'flex',alignItems:'center',gap:10,margin:'20px 0'}}><label className="eyebrow" htmlFor="quantity">Quantity</label><button className="btn btn-outline" style={{minWidth:42,padding:0}} onClick={()=>setQty(Math.max(1,qty-1))} aria-label="Decrease quantity" data-testid="button-quantity-minus"><Minus size={15}/></button><input id="quantity" className="field" style={{width:66,textAlign:'center'}} type="number" min="1" max="50" value={qty} onChange={e=>setQty(Math.max(1,Math.min(50,Number(e.target.value)||1)))} data-testid="input-product-quantity"/><button className="btn btn-outline" style={{minWidth:42,padding:0}} onClick={()=>setQty(Math.min(50,qty+1))} aria-label="Increase quantity" data-testid="button-quantity-plus"><Plus size={15}/></button><span className="status-pill">{product.stock>0?`${product.stock} available`:'Availability on request'}</span></div>
    <AddCartButton product={product} quantity={qty} testId="button-add-to-cart" fullWidth/>
        <div style={{display:'flex',gap:20,marginTop:18,color:'hsl(var(--muted-foreground))',fontSize:11}}><span><Truck size={14} style={{verticalAlign:'middle'}}/> Delivery options at checkout</span><span><CircleDollarSign size={14} style={{verticalAlign:'middle'}}/> Cash on delivery</span></div>
      </div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:30,marginTop:56}} className="product-detail-grid"><section><div className="eyebrow">Specifications</div><h2 className="display" style={{fontSize:26}}>Part details</h2><dl>{Object.entries(product.specifications||{}).map(([key,value])=><div key={key} style={{display:'flex',justifyContent:'space-between',gap:20,padding:'12px 0',borderBottom:'1px solid hsl(var(--border))'}}><dt className="eyebrow">{key}</dt><dd style={{margin:0,fontSize:13}}>{String(value)}</dd></div>)}</dl></section><section><div className="eyebrow">Fitment information</div><h2 className="display" style={{fontSize:26}}>Compatibility</h2>{product.compatibility.length?product.compatibility.map((fit,i)=><div key={i} className="notice" style={{marginBottom:10}}><strong>{fit.make} {fit.model}</strong><div style={{fontSize:12,marginTop:5}}>{fit.yearFrom}–{fit.yearTo} · {fit.verified?'Verified':'Unverified'}</div></div>):<p className="notice">There is no compatibility data listed for this part. Please ask us to confirm fitment for your exact vehicle.</p>}</section></div>
    {product.related?.length? <section style={{marginTop:50}}><h2 className="display">Related parts</h2><div className="product-grid">{product.related.map(p=><ProductCardView key={p.id} product={p} currency={store?.settings.currency}/>)}</div></section>:null}
   </div><div className="mobile-purchase"><div><span className="eyebrow">Total per item</span><strong>{money(price,store?.settings.currency)}</strong></div><AddCartButton product={product} quantity={qty} testId="button-mobile-add-to-cart" fullWidth/></div></PageFrame>;
}

export function CartPage() {
  const {data:cart,isLoading,isError,error,refetch}=useGetCart();const update=useUpdateCartItem();const remove=useRemoveCartItem();const qc=useQueryClient();
  const mutate=(fn:()=>void)=>{fn();};
  return <PageFrame><div className="shell"><div className="page-title"><div className="eyebrow">Your order / 01</div><h1>Cart</h1></div>
    {isLoading?<LoadingState label="Loading cart"/>:isError?<ApiNotice error={error} onRetry={()=>refetch()}/>:!cart?.items.length?<EmptyPanel title="Your cart is ready when you are" body="Parts you add will appear here with current server pricing." action="Find a part" href="/catalog"/>:
      <div style={{display:'grid',gridTemplateColumns:'1.5fr .8fr',gap:30,paddingBottom:70}} className="checkout-grid">
        <div>{cart.items.map(item=><div className="cart-line" key={item.productId}><Link href={`/product/${item.product.slug}`}><ProductVisual product={item.product}/></Link><div><div className="eyebrow">{item.product.sku}</div><Link href={`/product/${item.product.slug}`} style={{color:'inherit',textDecoration:'none',fontWeight:800}}>{item.product.name}</Link><div style={{fontSize:12,marginTop:7}}>{money(item.unitPriceMinor,cart.currency)} each</div></div><div style={{display:'grid',gap:8,justifyItems:'end'}}><strong>{money(item.lineTotalMinor,cart.currency)}</strong><div style={{display:'flex',alignItems:'center',gap:5}}><button className="btn btn-outline" style={{minHeight:44,padding:'0 11px'}} aria-label="Decrease quantity" onClick={()=>mutate(()=>item.quantity<=1?remove.mutate({productId:item.productId},{onSuccess:()=>qc.invalidateQueries({queryKey:getGetCartQueryKey()})}):update.mutate({productId:item.productId,data:{quantity:item.quantity-1}},{onSuccess:()=>qc.invalidateQueries({queryKey:getGetCartQueryKey()})}))} data-testid={`button-cart-minus-${item.productId}`}><Minus size={13}/></button><span className="mono">{item.quantity}</span><button className="btn btn-outline" style={{minHeight:44,padding:'0 11px'}} aria-label="Increase quantity" onClick={()=>update.mutate({productId:item.productId,data:{quantity:Math.min(50,item.quantity+1)}},{onSuccess:()=>qc.invalidateQueries({queryKey:getGetCartQueryKey()})})} data-testid={`button-cart-plus-${item.productId}`}><Plus size={13}/></button><button className="header-action" style={{color:'#9c4938',minHeight:44,padding:'0 8px'}} onClick={()=>remove.mutate({productId:item.productId},{onSuccess:()=>qc.invalidateQueries({queryKey:getGetCartQueryKey()})})} data-testid={`button-remove-${item.productId}`}>Remove</button></div></div></div>)}</div>
        <aside className="notice" style={{height:'fit-content'}}><h2 className="display" style={{fontSize:23,marginTop:0}}>Order summary</h2><div style={{display:'flex',justifyContent:'space-between',padding:'10px 0'}}><span>Subtotal</span><span>{money(cart.subtotalMinor,cart.currency)}</span></div><div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid hsl(var(--border))'}}><span>Delivery</span><span>{money(cart.deliveryFeeMinor,cart.currency)}</span></div><div style={{display:'flex',justifyContent:'space-between',padding:'16px 0',fontWeight:800}}><span>Total</span><span>{money(cart.totalMinor,cart.currency)}</span></div><Link className="btn btn-accent" href="/checkout" style={{width:'100%'}} data-testid="button-proceed-checkout">Checkout <ArrowRight size={16}/></Link><p className="eyebrow" style={{textAlign:'center',marginBottom:0}}>Cash on delivery only</p></aside>
      </div>}
  </div></PageFrame>;
}

export function CheckoutPage() {
  const {data:cart,isLoading,isError,error,refetch}=useGetCart();const submit=useSubmitOrder();const [,setLocation]=useLocation();
  const {data:storefront}=useGetStorefront();
  const [form,setForm]=useState({name:'',email:'',phone:'',address:'',city:'',region:'',country:'',deliveryNotes:''});
  const checkoutAttempt=useRef<{fingerprint:string;key:string}|null>(null);
  const [formError,setFormError]=useState('');
  const change=(key:keyof typeof form,value:string)=>setForm(v=>({...v,[key]:value}));
  const onSubmit=(e:FormEvent)=>{e.preventDefault();setFormError('');if(!cart?.items.length){setFormError('Your cart is empty. Add a part before checkout.');return;}
    const fingerprint=JSON.stringify({form,items:cart.items.map(item=>[item.productId,item.quantity])});
    if(checkoutAttempt.current?.fingerprint!==fingerprint)checkoutAttempt.current={fingerprint,key:crypto.randomUUID()};
    const data:CheckoutInput={...form,idempotencyKey:checkoutAttempt.current.key,deliveryNotes:form.deliveryNotes||undefined};
    submit.mutate({data},{onSuccess:result=>{checkoutAttempt.current=null;sessionStorage.setItem('rang-last-checkout',JSON.stringify(result));setLocation(`/order/${encodeURIComponent(result.orderNumber)}`)},onError:err=>setFormError(err instanceof Error?err.message:'Your order could not be submitted.')});
  };
  return <PageFrame><div className="shell"><div className="page-title"><div className="eyebrow">Your order / 02</div><h1>Delivery details</h1><p style={{color:'hsl(var(--muted-foreground))'}}>Pay when your order arrives. Online payment is not available.</p></div>
    {isLoading?<LoadingState label="Checking cart"/>:isError?<ApiNotice error={error} onRetry={()=>refetch()}/>:!cart?.items.length?<EmptyPanel title="Nothing to check out yet" body="Add a part to your cart first." action="Shop parts" href="/catalog"/>:<div style={{display:'grid',gridTemplateColumns:'1.25fr .75fr',gap:34,paddingBottom:70}} className="checkout-grid">
      <form onSubmit={onSubmit} className="inline-form" style={{margin:0}}><label className="label">Full name<input className="field" required minLength={2} maxLength={160} value={form.name} onChange={e=>change('name',e.target.value)} data-testid="input-checkout-name"/></label><label className="label">Email<input className="field" type="email" required maxLength={254} value={form.email} onChange={e=>change('email',e.target.value)} data-testid="input-checkout-email"/></label><label className="label">Phone<input className="field" type="tel" required minLength={5} maxLength={32} value={form.phone} onChange={e=>change('phone',e.target.value)} data-testid="input-checkout-phone"/></label><label className="label">Country<input className="field" required minLength={2} maxLength={100} autoComplete="country-name" placeholder="e.g. Cameroon" value={form.country} onChange={e=>change('country',e.target.value)} data-testid="input-checkout-country"/></label><label className="label">State / region<input className="field" required minLength={2} maxLength={100} autoComplete="address-level1" value={form.region} onChange={e=>change('region',e.target.value)} data-testid="input-checkout-region"/></label><label className="label wide">Delivery address<input className="field" required minLength={5} maxLength={300} autoComplete="street-address" value={form.address} onChange={e=>change('address',e.target.value)} data-testid="input-checkout-address"/></label><label className="label">City<input className="field" required minLength={2} maxLength={100} autoComplete="address-level2" value={form.city} onChange={e=>change('city',e.target.value)} data-testid="input-checkout-city"/></label><label className="label">Delivery notes <span style={{fontWeight:400,color:'hsl(var(--muted-foreground))'}}>Optional</span><textarea className="field" rows={2} maxLength={500} value={form.deliveryNotes} onChange={e=>change('deliveryNotes',e.target.value)} data-testid="input-checkout-notes"/></label>
        <div className="wide notice" style={{display:'flex',gap:11}}><CircleDollarSign size={20}/><div><strong>Cash on delivery</strong><div style={{fontSize:12}}>Pay the courier when your order is delivered. No online payment will be requested.</div></div></div>{storefront?.settings.cashOnDeliveryEnabled===false&&<div className="wide"><InlineError message="Cash on delivery is not currently enabled for this store."/></div>}{formError&&<div className="wide"><InlineError message={formError}/></div>}<button className="btn btn-accent wide" disabled={submit.isPending||storefront?.settings.cashOnDeliveryEnabled===false} data-testid="button-submit-order">{submit.isPending?'Submitting order…':'Place order'} <ArrowRight size={15}/></button>
      </form><aside className="notice" style={{height:'fit-content'}}><h2 className="display" style={{fontSize:23,marginTop:0}}>Order summary</h2>{cart.items.map(item=><div key={item.productId} style={{display:'flex',justifyContent:'space-between',gap:15,padding:'10px 0',borderBottom:'1px solid hsl(var(--border))'}}><span>{item.product.name} × {item.quantity}</span><span>{money(item.lineTotalMinor,cart.currency)}</span></div>)}<div style={{display:'flex',justifyContent:'space-between',padding:'14px 0'}}><span>Delivery</span><span>{money(cart.deliveryFeeMinor,cart.currency)}</span></div><strong style={{display:'flex',justifyContent:'space-between',fontSize:17}}>Total <span>{money(cart.totalMinor,cart.currency)}</span></strong></aside>
    </div>}
  </div></PageFrame>;
}

export function OrderPage() {
  const params=useParams<{orderNumber:string}>();const orderNumber=decodeURIComponent(params.orderNumber||'');
  const {data:order,isLoading,isError,error,refetch}=useGetCustomerOrder(orderNumber);
  const [checkoutResult]=useState<CheckoutResult|null>(()=>{try{const saved=sessionStorage.getItem('rang-last-checkout');return saved?JSON.parse(saved) as CheckoutResult:null}catch{return null}});
  const recentCheckout=checkoutResult?.orderNumber===orderNumber?checkoutResult:null;
  const orderResult=order||recentCheckout;
  return <PageFrame><div className="shell" style={{padding:'52px 0 80px',maxWidth:850}}>{isLoading&&!recentCheckout?<LoadingState label="Loading order"/>:isError&&!orderResult?<ApiNotice error={error} onRetry={()=>refetch()}/>:orderResult?<><div className="notice" style={{textAlign:'center',padding:36,marginBottom:28}}><div style={{color:'hsl(var(--primary))'}}><Check size={34} style={{margin:'auto'}}/></div><div className="eyebrow" style={{marginTop:12}}>Order submitted</div><h1 className="display" style={{fontSize:40,margin:'8px 0'}}>Thank you. We have it.</h1><p style={{color:'hsl(var(--muted-foreground))'}}>Your order number is <strong data-testid="text-order-number">{orderResult.orderNumber}</strong>. We will confirm the details before dispatch.</p><span className="status-pill">{orderResult.orderStatus}</span></div><div className="notice"><div className="eyebrow">Order progress</div><div style={{display:'flex',gap:12,margin:'18px 0'}}><span className="status-pill">{orderResult.orderStatus}</span><span className="status-pill">{orderResult.fulfillmentStatus}</span><span className="status-pill">{orderResult.paymentStatus}</span></div>{order&&order.items.map((item,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid hsl(var(--border))',padding:'12px 0'}}><span>{item.name} · {item.quantity}</span><span>{money(item.lineTotalMinor,order.currency)}</span></div>)}<strong style={{display:'flex',justifyContent:'space-between',paddingTop:12}}>Total <span>{money(orderResult.totalMinor,orderResult.currency)}</span></strong>{!order&&<p className="eyebrow" style={{marginBottom:0}}>Sign in to access full order tracking.</p>}</div><p style={{marginTop:20}}><Link href="/catalog" className="btn" data-testid="link-continue-shopping">Continue shopping <ArrowRight size={15}/></Link></p></>:null}</div></PageFrame>;
}

export function AccountPage() {
  const [,setLocation]=useLocation();
  const {data:user,isLoading,isError,error,refetch}=useGetAccount();const update=useUpdateAccount();const qc=useQueryClient();
  const logout=useLogoutAccount();const changePassword=useChangePassword();
  const [name,setName]=useState('');const [email,setEmail]=useState('');const [emailCurrentPassword,setEmailCurrentPassword]=useState('');const [phone,setPhone]=useState('');const [saved,setSaved]=useState(false);
  const [currentPassword,setCurrentPassword]=useState('');const [newPassword,setNewPassword]=useState('');const [passwordSaved,setPasswordSaved]=useState(false);
  useEffect(()=>{if(user){setName(user.name);setEmail(user.email);setPhone(user.phone||'')}},[user?.id]);
  if(isLoading)return <PageFrame><LoadingState label="Loading account"/></PageFrame>;
  if(isError||!user)return <PageFrame><div className="shell" style={{padding:'40px 0'}}><ApiNotice error={error||new Error('Sign in to view your account.')} onRetry={()=>refetch()}/><div style={{marginTop:16}}><Link href="/sign-in" className="btn" data-testid="link-sign-in-account">Sign in</Link></div></div></PageFrame>;
  return <PageFrame><div className="shell" style={{maxWidth:800,paddingBottom:60}}><div className="page-title"><div className="eyebrow">Your RANG account</div><h1>Account details</h1><p style={{color:'hsl(var(--muted-foreground))'}}>Your account details are loaded from RANG securely.</p></div>
     <form className="inline-form" onSubmit={e=>{e.preventDefault();const emailChanged=email.trim().toLowerCase()!==user.email.toLowerCase();update.mutate({data:{name,phone:phone||null,...(emailChanged?{email:email.trim(),currentPassword:emailCurrentPassword}:{})}},{onSuccess:()=>{setSaved(true);setEmailCurrentPassword('');void qc.invalidateQueries({queryKey:getGetAccountQueryKey()});if(emailChanged)void qc.invalidateQueries({queryKey:getGetAuthSessionQueryKey()})}})}}>
       <label className="label">Name<input className="field" required minLength={2} maxLength={160} value={name} onChange={e=>{setName(e.target.value);setSaved(false)}} data-testid="input-account-name"/></label><label className="label">Email<input className="field" type="email" required maxLength={254} value={email} onChange={e=>{setEmail(e.target.value);setSaved(false)}} data-testid="input-account-email"/></label>{email.trim().toLowerCase()!==user.email.toLowerCase()&&<label className="label">Current password to confirm email<input className="field" type="password" required autoComplete="current-password" value={emailCurrentPassword} onChange={e=>setEmailCurrentPassword(e.target.value)} data-testid="input-email-current-password"/></label>}<label className="label wide">Phone<input className="field" type="tel" maxLength={32} value={phone} onChange={e=>{setPhone(e.target.value);setSaved(false)}} data-testid="input-account-phone"/></label>
      {update.isError&&<InlineError message={update.error instanceof Error?update.error.message:'Could not update account.'}/>}<button className="btn wide" disabled={update.isPending} data-testid="button-save-account">{update.isPending?'Saving…':saved?'Saved':'Save details'}</button>
    </form>
    <section className="account-password"><div className="eyebrow">Security</div><h2 className="display">Change password</h2><form className="inline-form" onSubmit={e=>{e.preventDefault();setPasswordSaved(false);changePassword.mutate({data:{currentPassword,newPassword}},{onSuccess:()=>{setCurrentPassword('');setNewPassword('');setPasswordSaved(true);void qc.invalidateQueries({queryKey:getGetAuthSessionQueryKey()});void qc.invalidateQueries({queryKey:getGetAccountQueryKey()})}})}}>
      <label className="label">Current password<input className="field" type="password" required autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} data-testid="input-current-password"/></label><label className="label">New password<input className="field" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} data-testid="input-new-password"/><small className="auth-hint">Use at least 12 characters.</small></label>
      {changePassword.isError&&<div className="wide"><InlineError message={changePassword.error instanceof Error?changePassword.error.message:'Password could not be changed.'}/></div>}
      {passwordSaved&&<p className="notice wide" role="status" data-testid="status-password-updated">Your password has been changed.</p>}
      <button className="btn wide" disabled={changePassword.isPending} data-testid="button-change-password">{changePassword.isPending?'Updating password…':'Change password'}</button>
    </form></section>
    <div style={{marginTop:25,display:'flex',gap:10,flexWrap:'wrap'}}><Link href="/orders" className="btn btn-outline" data-testid="link-my-orders">View my orders <ArrowRight size={15}/></Link><button className="btn btn-outline" disabled={logout.isPending} onClick={()=>logout.mutate(undefined,{onSuccess:()=>{qc.removeQueries({predicate:q=>['/api/account','/api/cart','/api/customer','/api/admin'].some(part=>JSON.stringify(q.queryKey).includes(part))});void qc.invalidateQueries({queryKey:getGetAuthSessionQueryKey()});setLocation('/')}})} data-testid="button-sign-out">{logout.isPending?'Signing out…':'Sign out'}</button></div>
  </div></PageFrame>;
}

export function OrdersPage() {
  const {data:orders,isLoading,isError,error,refetch}=useListCustomerOrders();
  return <PageFrame><div className="shell"><div className="page-title"><div className="eyebrow">Your RANG account</div><h1>Order history</h1></div>{isLoading?<LoadingState label="Loading orders"/>:isError?<><ApiNotice error={error} onRetry={()=>refetch()}/><div style={{marginTop:14}}><Link href="/sign-in" className="btn" data-testid="link-sign-in-orders">Sign in</Link></div></>:orders?.length?<div style={{paddingBottom:60}} className="table-wrap"><table className="data-table"><thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Status</th><th>Total</th><th></th></tr></thead><tbody>{orders.map(order=><tr key={order.id} data-testid={`row-order-${order.id}`}><td>{order.orderNumber}</td><td>{new Date(order.createdAt).toLocaleDateString()}</td><td>{order.items.length}</td><td><span className="status-pill">{order.orderStatus}</span></td><td>{money(order.totalMinor,order.currency)}</td><td><Link href={`/order/${encodeURIComponent(order.orderNumber)}`} data-testid={`link-order-${order.id}`}>Details</Link></td></tr>)}</tbody></table></div>:<EmptyPanel title="No orders yet" body="Orders you place through RANG will show here." action="Explore parts" href="/catalog"/>}</div></PageFrame>;
}

export function ContactPage() {
  const {data:store,isLoading,isError,error,refetch}=useGetStorefront();
  const send=useCreateSupportMessage();
  const [form,setForm]=useState({name:'',email:'',phone:'',subject:'',message:''});
  const [sent,setSent]=useState(false);
  const updateField=(key:keyof typeof form,value:string)=>{setForm(current=>({...current,[key]:value}));setSent(false)};
  const submit=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    send.mutate({data:form},{
      onSuccess:()=>{setForm({name:'',email:'',phone:'',subject:'',message:''});setSent(true)},
    });
  };
  return <PageFrame>
    <div className="shell" style={{maxWidth:1000}}>
      <div className="page-title">
        <div className="eyebrow">Parts desk / here to help</div>
        <h1>Let's find the right part.</h1>
        <p>Send a message to the parts desk. For fitment questions, include the vehicle make, model and year, plus the part name or SKU if you have it.</p>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1.2fr .8fr',gap:30,paddingBottom:70}} className="checkout-grid">
        <section>
          <h2 className="display">Message the parts desk</h2>
          <p style={{lineHeight:1.8,color:'hsl(var(--muted-foreground))'}}>Messages are saved in RANG's staff inbox. There is no automatic email receipt.</p>
          <form className="inline-form" onSubmit={submit} data-testid="form-support-message">
            <label className="label">Your name<input className="field" required minLength={2} maxLength={160} autoComplete="name" value={form.name} onChange={event=>updateField('name',event.target.value)} data-testid="input-support-name"/></label>
            <label className="label">Email address<input className="field" required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={event=>updateField('email',event.target.value)} data-testid="input-support-email"/></label>
            <label className="label wide">Phone (optional)<input className="field" type="tel" maxLength={32} autoComplete="tel" value={form.phone} onChange={event=>updateField('phone',event.target.value)} data-testid="input-support-phone"/></label>
            <label className="label wide">Subject<input className="field" required minLength={3} maxLength={120} value={form.subject} onChange={event=>updateField('subject',event.target.value)} data-testid="input-support-subject"/></label>
            <label className="label wide">How can we help?<textarea className="field" required minLength={10} maxLength={3000} rows={6} value={form.message} onChange={event=>updateField('message',event.target.value)} data-testid="input-support-message"/></label>
            {send.isError&&<div className="wide"><InlineError message={send.error instanceof Error?send.error.message:'Your message could not be saved. Please try again.'}/></div>}
            {sent&&<p className="notice wide" role="status" data-testid="status-support-message-sent">Your message is saved in the RANG support inbox.</p>}
            <button className="btn wide" type="submit" disabled={send.isPending} data-testid="button-send-support-message">{send.isPending?'Saving message…':'Send message'}</button>
          </form>
          <p className="eyebrow" style={{marginTop:14}}>Your message and reply details will be visible to RANG staff so they can respond.</p>
        </section>
        <aside className="notice">
          <div className="eyebrow">Contact information</div>
          <h2 className="display">{store?.settings.storeName||'RANG Auto Parts'}</h2>
          {isLoading?<div className="skeleton" style={{height:50}} role="status" aria-label="Loading store contact details"/>:isError?<ApiNotice error={error} onRetry={()=>refetch()}/>:<div style={{display:'grid',gap:12,marginBottom:18}}>
            {store?.settings.supportEmail&&<a href={`mailto:${store.settings.supportEmail}`} data-testid="link-support-email" style={{display:'flex',gap:9,alignItems:'center',color:'hsl(var(--primary))'}}><Mail size={16}/>{store.settings.supportEmail}</a>}
            {store?.settings.contactPhone&&<a href={`tel:${store.settings.contactPhone}`} data-testid="link-support-phone" style={{display:'flex',gap:9,alignItems:'center',color:'hsl(var(--primary))'}}><Phone size={16}/>{store.settings.contactPhone}</a>}
            {!store?.settings.supportEmail&&!store?.settings.contactPhone&&<p style={{margin:0}}>No public email or phone is configured. Use the message form to reach the parts desk.</p>}
          </div>}
          <p className="notice"><strong>For order updates</strong><br/>Visit your order history or use the order number from your confirmation.</p>
          <Link href="/catalog" className="btn btn-outline" data-testid="link-contact-shop">Back to catalog</Link>
        </aside>
      </div>
    </div>
  </PageFrame>;
}

export function AboutPage() { return <PageFrame><div className="shell" style={{maxWidth:900}}><div className="page-title"><div className="eyebrow">About RANG</div><h1>Parts should be the easy part.</h1></div><div style={{display:'grid',gridTemplateColumns:'1.1fr .9fr',gap:44,paddingBottom:60}} className="checkout-grid"><div><p style={{fontSize:19,lineHeight:1.7}}>RANG Auto Parts exists for people who take care of the machines they depend on: the ATV that gets work done, the car that gets everyone there, the bike that makes the long way worth it.</p><p style={{lineHeight:1.9,color:'hsl(var(--muted-foreground))'}}>We believe buying a replacement part should feel clear, not risky. Product data and fitment details come from the catalog, and when something is not verified, we say so. No invented compatibility promises. No hidden online payment step.</p><p style={{lineHeight:1.9,color:'hsl(var(--muted-foreground))'}}>Find a part, review the details, and choose cash on delivery at checkout. If you are unsure, ask before you order.</p></div><div className="hero" style={{padding:32,minHeight:290,display:'grid',placeItems:'center'}}><Gauge size={96} strokeWidth={.8} color="#e88255"/><span className="eyebrow" style={{color:'#c6d0c7'}}>Straightforward parts. Practical service.</span></div></div></div></PageFrame>; }

function LegalPage({title,type}:{title:string;type:'privacy'|'terms'}) {
  return <PageFrame><div className="shell" style={{maxWidth:850,paddingBottom:60}}><div className="page-title"><div className="eyebrow">RANG / customer information</div><h1>{title}</h1><p>How we handle your information when you shop with RANG Auto Parts.</p></div><div className="notice" style={{lineHeight:1.9}}>{type==='privacy'?<><h2 className="display">Information and orders</h2><p>RANG uses the details you provide to process your order, coordinate delivery, and provide account and order services. Account information is protected by RANG's secure password and session system. The storefront uses the information needed to fulfil your requests.</p><h2 className="display">Support messages</h2><p>If you contact RANG through the site, your name, reply details, subject and message are stored in the staff inbox so staff can review and respond. Do not include payment credentials or other sensitive information in a support message.</p><h2 className="display">Contact and account controls</h2><p>You can view and update the profile details associated with your account. For privacy questions, contact the RANG parts desk using the support form.</p></>:<><h2 className="display">Product information</h2><p>Product descriptions, stock, pricing and verified fitment are shown from the RANG catalog. If fitment is marked unknown or unverified, please contact the parts desk before ordering.</p><h2 className="display">Orders and payment</h2><p>Checkout is cash on delivery only. Placing an order submits the delivery details to RANG for processing. Online payment is unavailable through this storefront.</p><h2 className="display">Delivery and availability</h2><p>Availability and delivery fees are based on current store configuration and may be confirmed by staff after order submission.</p></>}</div></div></PageFrame>;
}
export function PrivacyPage(){return <LegalPage title="Privacy notice" type="privacy"/>}
export function TermsPage(){return <LegalPage title="Terms of service" type="terms"/>}
