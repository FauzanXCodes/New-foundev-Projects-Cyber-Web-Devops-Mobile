import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { useAuth } from './Auth';
import { Button, Field, useToast } from './components';

export default function AuthPage({ register = false }) {
  const navigate = useNavigate(); const location = useLocation(); const { signIn, register: createAccount } = useAuth(); const toast = useToast();
  const wantsAdmin = new URLSearchParams(location.search).get('role') === 'admin';
  const [role, setRole] = useState(wantsAdmin ? 'admin' : 'student');
  const [fields, setFields] = useState({ name: '', studentId: '', email: '', password: '', phone: '' });
  const [showPassword, setShowPassword] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const update = key => e => setFields(current => ({ ...current, [key]: e.target.value }));
  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const user = register ? await createAccount(fields) : await signIn({ email: fields.email, password: fields.password, role });
      navigate(user.role === 'admin' ? '/staff' : '/app', { replace: true });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function demoLogin(as) {
    setRole(as); setBusy(true); setError('');
    try { const user = await signIn({ email: as === 'admin' ? 'admin@campusbite.edu' : 'student@campusbite.edu', password: as === 'admin' ? 'admin123' : 'password123', role: as }); navigate(as === 'admin' ? '/staff' : '/app', { replace: true }); }
    catch (err) { setError(err.message); toast(err.message, 'error'); }
    finally { setBusy(false); }
  }
  return <div className="auth-page"><div className="auth-side">
    <Link to="/" className="brand auth-brand"><span className="brand-mark">cb<span>·</span></span><span>campus<span className="brand-heavy">bite</span><small>Fresh made. Smartly picked up.</small></span></Link>
    <div className="auth-visual"><div className="auth-photo"><img src="https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=85" alt="A colorful fresh lunch bowl" /></div><div className="auth-note"><span>✳</span><b>Your canteen,<br />on your time.</b><small>Good food. Better breaks.</small></div><div className="auth-side-caption"><span>BUILT FOR YOUR CAMPUS</span><i /> <span>01 — 03</span></div></div>
    <div className="auth-side-bottom"><span>Skip the queue, keep the flavor.</span><span>© {new Date().getFullYear()} Campus Bite</span></div>
  </div><div className="auth-main"><Link to="/" className="auth-back"><ArrowLeft size={16} /> Back to Campus Bite</Link><div className="auth-form-wrap">
    <div className="auth-topline"><span className="eyebrow">{register ? 'Your next great lunch' : 'Welcome back'}</span><span>✦</span></div>
    <h1>{register ? <>A better break<br /><em>starts here.</em></> : <>Good to see<br /><em>you again.</em></>}</h1>
    <p className="auth-subtitle">{register ? 'Make an account and get a little more out of every break.' : 'Sign in to order ahead and stay in the know.'}</p>
    {!register && <div className="auth-role-switch"><button className={role === 'student' ? 'active' : ''} onClick={() => setRole('student')}><UserRound size={15} /> Student</button><button className={role === 'admin' ? 'active' : ''} onClick={() => setRole('admin')}><ShieldCheck size={15} /> Canteen staff</button></div>}
    <form className="auth-form" onSubmit={submit}>
      {register && <><Field label="Your name" placeholder="e.g. Aarav Mehta" autoComplete="name" value={fields.name} onChange={update('name')} required maxLength="80" /><div className="form-two"><Field label="Student ID" placeholder="e.g. CB24CS108" value={fields.studentId} onChange={update('studentId')} required maxLength="24" /><Field label="Mobile (optional)" placeholder="+91" value={fields.phone} onChange={update('phone')} maxLength="20" /></div></>}
      <label className="field"><span>{role === 'admin' ? 'Staff email' : 'College email'}</span><div className="input-icon"><Mail size={16} /><input type="email" placeholder={role === 'admin' ? 'admin@campusbite.edu' : 'you@college.edu'} autoComplete="email" value={fields.email} onChange={update('email')} required /></div></label>
      <label className="field"><span>Password</span><div className="input-icon"><LockKeyhole size={16} /><input type={showPassword ? 'text' : 'password'} placeholder={register ? 'At least 8 characters' : 'Enter your password'} autoComplete={register ? 'new-password' : 'current-password'} value={fields.password} onChange={update('password')} minLength={register ? 8 : 1} required /><button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
      {error && <div className="form-error"><span>!</span>{error}</div>}
      <Button type="submit" disabled={busy} className="auth-submit">{busy ? 'Just a moment…' : register ? 'Create my account' : 'Sign in'}{!busy && <ArrowRight size={17} />}</Button>
    </form>
    {register ? <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p> : <><div className="demo-divider"><span /> Quick demo access <span /></div><div className="demo-buttons"><button onClick={() => demoLogin('student')} disabled={busy}><span className="demo-avatar student">AM</span><span><b>Student demo</b><small>Browse, order & track</small></span><ArrowRight size={15} /></button><button onClick={() => demoLogin('admin')} disabled={busy}><span className="demo-avatar staff">CB</span><span><b>Canteen demo</b><small>Manage kitchen & queue</small></span><ArrowRight size={15} /></button></div><p className="auth-switch">New to Campus Bite? <Link to="/register">Create an account</Link></p></>}
    <div className="auth-privacy"><Sparkles size={14} /> Your campus account is protected with secure sign-in.</div>
  </div><div className="auth-mobile-footer"><span>cb· campusbite</span><span>Good food. Better breaks.</span></div></div></div>;
}
