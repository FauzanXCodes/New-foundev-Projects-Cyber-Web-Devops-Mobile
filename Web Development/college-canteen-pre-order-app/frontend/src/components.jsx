import { createContext, useContext, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Check, Clock3, Heart, Leaf, Plus, X } from 'lucide-react';
import { imageFallback, money } from './api';

const ToastContext = createContext(() => {});
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toast = (message, type = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(current => [...current, { id, message, type }]);
    window.setTimeout(() => setToasts(current => current.filter(t => t.id !== id)), 3400);
  };
  return <ToastContext.Provider value={toast}>{children}<div className="toast-stack" aria-live="polite"><AnimatePresence>{toasts.map(item => <motion.div key={item.id} initial={{ opacity: 0, y: 18, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 18 }} className={`toast ${item.type}`}><span className="toast-check">{item.type === 'error' ? '!' : <Check size={16} />}</span>{item.message}<button aria-label="Dismiss" onClick={() => setToasts(a => a.filter(t => t.id !== item.id))}><X size={15} /></button></motion.div>)}</AnimatePresence></div></ToastContext.Provider>;
}
export const useToast = () => useContext(ToastContext);

export function Button({ children, variant = 'primary', size = '', className = '', ...props }) {
  return <button className={`button ${variant} ${size} ${className}`} {...props}>{children}</button>;
}
export function Modal({ open, onClose, children, wide = false }) {
  useEffect(() => { if (!open) return; const key = e => e.key === 'Escape' && onClose?.(); window.addEventListener('keydown', key); document.body.classList.add('modal-open'); return () => { window.removeEventListener('keydown', key); document.body.classList.remove('modal-open'); }; }, [open, onClose]);
  return <AnimatePresence>{open && <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={e => e.target === e.currentTarget && onClose?.()}><motion.div className={`modal-card ${wide ? 'wide' : ''}`} initial={{ opacity: 0, y: 18, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: .98 }} transition={{ duration: .18 }}>{children}</motion.div></motion.div>}</AnimatePresence>;
}
export function PageHeading({ eyebrow, title, subtitle, action, className = '' }) {
  return <div className={`page-heading ${className}`}><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}
export function StatusBadge({ status }) {
  const label = { placed: 'New', confirmed: 'Confirmed', preparing: 'Preparing', ready: 'Ready', called: 'Called', completed: 'Completed', cancelled: 'Cancelled' }[status] || status;
  return <span className={`status-badge ${status}`}><i />{label}</span>;
}
export function FoodCard({ item, onAdd, onOpen, favorite, onFavorite }) {
  const available = item.available && item.stock > 0;
  return <motion.article className="food-card" layout whileHover={{ y: -4 }} transition={{ duration: .2 }}>
    <div className="food-image-wrap" onClick={() => onOpen?.(item)} role="button" tabIndex="0" onKeyDown={e => e.key === 'Enter' && onOpen?.(item)}>
      <img src={item.image || imageFallback} alt={item.name} loading="lazy" onError={e => { e.currentTarget.src = imageFallback; }} />
      {item.featured && <span className="image-label">✦ Campus fave</span>}
      {onFavorite && <button className={`favorite-button ${favorite ? 'active' : ''}`} aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'} onClick={e => { e.stopPropagation(); onFavorite(item); }}><Heart size={17} fill={favorite ? 'currentColor' : 'none'} /></button>}
      {!available && <div className="sold-overlay">Sold out for now</div>}
    </div>
    <div className="food-card-body">
      <div className="food-meta"><span>{item.category}</span><span className="veg-marker" title={item.veg ? 'Vegetarian' : 'Non-vegetarian'}><i className={item.veg ? 'veg' : 'nonveg'} />{item.veg && <Leaf size={12} />}</span></div>
      <button className="food-name" onClick={() => onOpen?.(item)}>{item.name}<ArrowUpRight size={15} /></button>
      <p className="food-description">{item.description}</p>
      <div className="food-card-bottom"><div className="food-price">{money(item.price)} <span>· {item.prepTime} min</span></div><button className="add-round" disabled={!available} onClick={() => onAdd?.(item)} aria-label={`Add ${item.name} to cart`}><Plus size={18} /></button></div>
      <div className="food-footnote"><span>★ {Number(item.rating || 0).toFixed(1)}</span><span><Clock3 size={12} /> Freshly made</span></div>
    </div>
  </motion.article>;
}
export function EmptyState({ icon: Icon, title, body, action }) {
  return <div className="empty-state"><div className="empty-icon">{Icon ? <Icon size={24} /> : '✦'}</div><h3>{title}</h3><p>{body}</p>{action}</div>;
}
export function StatCard({ label, value, note, icon: Icon, tone = 'orange' }) {
  return <div className={`stat-card ${tone}`}><div className="stat-top"><span>{label}</span>{Icon && <span className="stat-icon"><Icon size={18} /></span>}</div><strong>{value}</strong>{note && <small>{note}</small>}</div>;
}
export function Field({ label, hint, ...props }) {
  return <label className="field"><span>{label}</span><input {...props} />{hint && <small>{hint}</small>}</label>;
}
