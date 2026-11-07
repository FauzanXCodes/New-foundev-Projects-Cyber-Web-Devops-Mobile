import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUpRight, Clock3, Coffee, Leaf, TicketCheck, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { api, imageFallback, money } from './api';

export default function Landing() {
  const [menu, setMenu] = useState([]);
  const [queue, setQueue] = useState(null);
  const [settings, setSettings] = useState(null);
  const [special, setSpecial] = useState(null);
  useEffect(() => {
    api('/menu?sort=popular').then(r => setMenu(r.items.slice(0, 3))).catch(() => {});
    api('/queue').then(setQueue).catch(() => {});
    api('/settings').then(r => setSettings(r.settings)).catch(() => {});
    api('/promotions').then(r => { const now = Date.now(); setSpecial(r.promotions.find(p => p.active && (!p.startsAt || new Date(p.startsAt).getTime() <= now) && (!p.endsAt || new Date(p.endsAt).getTime() >= now)) || null); }).catch(() => {});
  }, []);
  return <div className="landing-page">
    <header className="landing-nav"><Link to="/" className="brand"><span className="brand-mark">cb<span>·</span></span><span>campus<span className="brand-heavy">bite</span><small>Fresh made. Smartly picked up.</small></span></Link><nav><a href="#how">How it works</a><a href="#favorites">Campus favorites</a></nav><div className="nav-actions"><Link className="nav-login" to="/login">Sign in</Link><Link className="button primary nav-cta" to="/register">Order ahead <ArrowRight size={16} /></Link></div></header>

    <main>
      <section className="hero-section">
        <div className="hero-copy">
          <div className="hero-kicker"><span className="live-dot" /> Your campus canteen, reimagined</div>
          <h1>Skip the line.<br /><em>Keep the</em> flavor.</h1>
          <p className="hero-lede">Good food shouldn’t come with a long wait. Order ahead, follow your smart token, and collect your freshly made favorites between classes.</p>
          <div className="hero-buttons"><Link to="/register" className="button primary">Order now <ArrowRight size={17} /></Link><a href="#how" className="button subtle">See how it works <ArrowDown size={15} /></a></div>
          <div className="hero-proof"><span className="proof-token"><TicketCheck size={15} /></span><span><strong>Built for your campus.</strong><br />Your token keeps the break moving.</span></div>
        </div>
        <div className="hero-visual">
          <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
          <div className="hero-photo"><img src={menu[0]?.image || 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=1100&q=85'} alt="A freshly made dosa served with chutneys" onError={e => { e.currentTarget.src = imageFallback; }} /></div>
          <div className="hero-sticker"><span>✦</span><b>Fresh<br />to you</b></div>
          <div className="float-card pickup-float"><span className="float-icon"><TicketCheck size={17} /></span><span><small>NOW SERVING</small><b>{queue?.nowServing?.token || '—'}</b></span><span className="pulse-mini" /></div>
          <div className="float-card wait-float"><span className="wait-icon"><Clock3 size={16} /></span><span><small>EST. WAIT</small><b>{queue?.waitMinutes ?? '—'} min</b></span></div>
          <div className="hero-caption"><span>01 / 04</span><div /><span>Made for campus days</span></div>
        </div>
        <div className="hero-bottomline"><span>SCROLL TO EXPLORE</span><span>↓</span><span>{settings ? settings.isOpen ? 'OPEN FOR PRE-ORDERS' : 'CANTEEN CLOSED' : 'CANTEEN STATUS UNAVAILABLE'} <i className={settings?.isOpen ? 'live-dot' : 'closed-dot'} /></span></div>
      </section>

      <section className="ticker"><div><span>✳</span> Fresh food, right on time <span>·</span> Less queue, more you <span>✳</span> Made for campus life <span>·</span> Your break, back in your hands <span>✳</span> Fresh food, right on time <span>·</span> Less queue, more you <span>✳</span> Made for campus life</div></section>

      <section className="how-section" id="how">
        <div className="section-intro"><span className="eyebrow">A better kind of lunch break</span><h2>Order ahead.<br /><span>Get on with your day.</span></h2><p>We took the queue out of the equation, so you can spend your break where it matters.</p></div>
        <div className="flow-grid">
          {[['01', Coffee, 'Pick your favorites', 'Browse the canteen menu and make your order yours.'], ['02', TicketCheck, 'Get a smart token', 'Your unique number tracks the kitchen queue in real time.'], ['03', Zap, 'Grab & go', 'Get a heads-up when it’s ready. Swing by and enjoy.']].map(([n, Icon, title, body]) => <div className="flow-card" key={n}><div className="flow-number">{n}<ArrowUpRight size={15} /></div><div className="flow-icon"><Icon size={20} /></div><h3>{title}</h3><p>{body}</p></div>)}
        </div>
        <div className="flow-rail"><span>ORDER</span><i /><span>TOKEN</span><i /><span>PREP</span><i /><span>READY</span><i /><span>PICK UP</span></div>
      </section>

      <section className="favorites-section" id="favorites">
        <div className="section-heading-row"><div><span className="eyebrow">The campus shortlist</span><h2>Good things are<br />cooking <em>today.</em></h2></div><Link to="/login" className="text-link">See the whole menu <ArrowRight size={16} /></Link></div>
        <div className="landing-food-grid">{menu.length ? menu.map((item, i) => <motion.div key={item._id} className="landing-food-card" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * .08 }}>
          <Link to="/login" className="landing-food-img"><img src={item.image || imageFallback} alt={item.name} onError={e => { e.currentTarget.src = imageFallback; }} /><span>{item.category}</span></Link><div className="landing-food-info"><div><h3>{item.name}</h3><p>★ {Number(item.rating).toFixed(1)} <span>·</span> {item.prepTime} min</p></div><b>{money(item.price)}</b></div>
        </motion.div>) : <div className="landing-menu-empty"><span>Menu preview</span><p>Our kitchen is getting ready. Sign in to see today’s menu.</p></div>}</div>
        <div className="special-banner"><div className="special-leaf"><Leaf size={22} /></div><div><span>{special ? 'THIS WEEK’S PERK' : 'MADE FOR YOUR BREAK'}</span><h3>{special?.title || 'Your campus favorites, on your time.'}</h3><p>{special?.description || 'Order ahead, follow your token, and collect lunch between classes.'}</p></div><Link to="/register" className="button light">{special ? `Use ${special.code}` : 'Order ahead'} <ArrowRight size={16} /></Link><div className="banner-decor">✳</div></div>
      </section>

      <section className="close-cta"><div><span className="eyebrow">Your break starts here</span><h2>Hungry? We’ve got<br /><em>you, campus.</em></h2><p>Order in a few taps. Pick up on your time.</p></div><Link to="/register" className="button primary large">Get started <ArrowRight size={17} /></Link><div className="close-cta-stamp">GOOD<br />FOOD<br /><span>·</span> GOOD<br />MOOD</div></section>
    </main>
    <footer className="landing-footer"><Link to="/" className="brand"><span className="brand-mark">cb<span>·</span></span><span>campus<span className="brand-heavy">bite</span><small>Made for campus days.</small></span></Link><span>© {new Date().getFullYear()} Campus Bite · The canteen, on your time.</span><div><Link to="/login?role=admin">Staff sign in</Link><a href="#how">How it works</a></div></footer>
  </div>;
}
