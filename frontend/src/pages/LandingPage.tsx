import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

// SVG Icons as components
const LayersIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 9l6 6 6-6"/>
  </svg>
);

const StarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const LockIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const CalendarIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const FileTextIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);

const PackageIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);

const UsersIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const EyeOpenIcon = () => (
  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5A2.5 2.5 0 1 0 12 9a2.5 2.5 0 0 0 0 5.5z"/>
  </svg>
);

const EyeClosedIcon = () => (
  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2.1 3.5 3.5 2.1l18.4 18.4-1.4 1.4-2.5-2.5c-1.7.9-3.6 1.6-6 1.6-7 0-10-7-10-7 1-2.2 2.6-4.4 4.9-5.8L2.1 3.5zm7.2 7.2a3 3 0 0 0 4.2 4.2l-4.2-4.2zM12 7c3.9 0 6.5 3 7.7 5-.5 1-1.4 2.4-2.7 3.5l-1.5-1.5A5 5 0 0 0 9.5 8.5L8 7c1.1-.3 2.4-.5 4-.5z"/>
  </svg>
);

// Feature Card Component
const FeatureCard = ({ icon: Icon, iconColor, title, description }: { icon: React.ElementType, iconColor: string, title: string, description: string }) => (
  <article className="bg-white border border-[#e5e7eb] rounded-2xl p-8 relative overflow-hidden transition-all duration-300 hover:border-[rgba(128,0,0,0.15)] hover:shadow-[0_8px_30px_rgba(128,0,0,0.08)] hover:-translate-y-1 group">
    <div className="absolute top-0 left-0 right-0 h-[3px] bg-linear-to-r from-[#800000] to-[#FFB81C] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 text-white ${iconColor}`}>
      <Icon />
    </div>
    <h3 className="text-lg font-bold text-[#1f2937] mb-2">{title}</h3>
    <p className="text-sm text-[#4b5563] leading-relaxed">{description}</p>
  </article>
);

export default function LandingPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    await login(email, password);
    const state = useAuthStore.getState();

    if (!state.isAuthenticated || !state.user) {
      setError('Invalid email or password.');
      setIsLoading(false);
      return;
    }

    if (state.user.role === 'ADMIN') {
      navigate('/admin/dashboard');
    } else if (state.user.role === 'FACULTY') {
      navigate('/faculty/panel');
    } else {
      navigate('/student/panel');
    }

    setIsLoading(false);
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#faf9f7] text-[#1f2937] font-['Inter','Montserrat',sans-serif] leading-relaxed">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-5 md:px-20 h-[72px] bg-[rgba(250,249,247,0.92)] backdrop-blur-xl border-b border-[rgba(128,0,0,0.08)]">
        <a href="#home" className="flex items-center gap-2.5" onClick={(e) => { e.preventDefault(); scrollToSection('home'); }}>
          <img src="/PUPLogo.png" alt="PUP Lopez Logo" className="w-[38px] h-[38px] object-contain rounded-full border-2 border-[#FFB81C] p-0.5 bg-white" />
          <h2 className="text-[#800000] font-bold text-xl tracking-tight">SmartLab</h2>
        </a>

        <nav>
          <ul className="flex list-none gap-2 items-center">
            <li><a href="#home" onClick={(e) => { e.preventDefault(); scrollToSection('home'); }} className="text-[#4b5563] px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all hover:text-[#800000] hover:bg-[rgba(128,0,0,0.05)]">Home</a></li>
            <li><a href="#features" onClick={(e) => { e.preventDefault(); scrollToSection('features'); }} className="text-[#4b5563] px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all hover:text-[#800000] hover:bg-[rgba(128,0,0,0.05)]">Features</a></li>
            <li><a href="#about" onClick={(e) => { e.preventDefault(); scrollToSection('about'); }} className="text-[#4b5563] px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all hover:text-[#800000] hover:bg-[rgba(128,0,0,0.05)]">About</a></li>
            <li className="mx-1 text-[#e5e7eb] select-none">|</li>
            <li><a href="#login" onClick={(e) => { e.preventDefault(); scrollToSection('login'); }} className="bg-[#800000] text-white px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:bg-[#a83232]">Sign In</a></li>
          </ul>
        </nav>
      </header>

      <main className="pt-[72px]">
        {/* Hero Section */}
        <section id="home" className="relative flex flex-col items-center text-center px-5 pt-24 pb-32 gap-4 overflow-hidden">
          <div className="absolute -top-[60%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-[radial-gradient(circle,rgba(128,0,0,0.04)_0%,transparent_70%)] pointer-events-none" />
          
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#fef3e2] border border-[rgba(255,184,28,0.3)] rounded-full text-xs font-semibold text-[#9a7b4f] tracking-wide">
            <LayersIcon />
            PUP Lopez Campus
          </div>

          <h1 className="text-4xl md:text-[52px] leading-tight text-[#800000] max-w-[900px] font-bold tracking-tight">
            Smart Laboratory<br />
            <span className="bg-linear-to-br from-[#800000] to-[#a83232] bg-clip-text text-transparent">Management System</span>
          </h1>

          <p className="max-w-[600px] text-lg text-[#4b5563] leading-relaxed mt-2">
            Streamline equipment borrowing, room scheduling, and lab operations
            through one centralized platform built for students, faculty, and administrators.
          </p>

          <div className="flex gap-3 mt-4 items-center">
            <button 
              onClick={() => scrollToSection('login')}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-linear-to-br from-[#800000] to-[#5c0000] text-white font-semibold transition-all hover:from-[#a83232] hover:to-[#800000] hover:-translate-y-0.5 shadow-[0_4px_12px_rgba(128,0,0,0.25)] hover:shadow-[0_6px_20px_rgba(128,0,0,0.3)]"
            >
              Get Started
              <ArrowRightIcon />
            </button>
            <button 
              onClick={() => scrollToSection('features')}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white text-[#800000] font-semibold border border-[rgba(128,0,0,0.15)] transition-all hover:border-[#800000] hover:bg-[rgba(128,0,0,0.03)]"
            >
              Learn More
              <ChevronDownIcon />
            </button>
          </div>
        </section>

        {/* Stats Strip */}
        <div className="flex justify-center gap-12 py-10 bg-white border-y border-[#e5e7eb]">
          <div className="text-center">
            <div className="text-3xl font-bold text-[#800000] leading-tight">3</div>
            <div className="text-sm text-[#4b5563] font-medium">User Roles</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[#800000] leading-tight">24/7</div>
            <div className="text-sm text-[#4b5563] font-medium">System Access</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[#800000] leading-tight">Real-time</div>
            <div className="text-sm text-[#4b5563] font-medium">Conflict Detection</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[#800000] leading-tight">100%</div>
            <div className="text-sm text-[#4b5563] font-medium">Digital Records</div>
          </div>
        </div>

        {/* Features Section */}
        <section id="features" className="py-24 px-5 md:px-20 max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#9a7b4f] uppercase tracking-wider mb-3">
              <StarIcon />
              Features
            </div>
            <h2 className="text-4xl font-bold text-[#1f2937] leading-tight mb-3">Everything You Need to<br />Manage Your Laboratory</h2>
            <p className="text-base text-[#4b5563] max-w-[550px] mx-auto">Built to simplify every step of the lab management process — from borrowing equipment to scheduling rooms.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard 
              icon={LockIcon} 
              iconColor="bg-linear-to-br from-[#800000] to-[#5c0000]" 
              title="Secure Authentication" 
              description="Role-based access for students, faculty, and administrators ensures the right people access the right tools."
            />
            <FeatureCard 
              icon={CalendarIcon} 
              iconColor="bg-linear-to-br from-[#FFB81C] to-[#e5a518]" 
              title="Smart Scheduling" 
              description="Automatic conflict detection prevents double-booking and overlapping reservations across all lab rooms."
            />
            <FeatureCard 
              icon={FileTextIcon} 
              iconColor="bg-linear-to-br from-[#0d9488] to-[#0f766e]" 
              title="Reports & Export" 
              description="Generate PDF and CSV reports for equipment usage, borrowing history, and scheduling records on demand."
            />
            <FeatureCard 
              icon={PackageIcon} 
              iconColor="bg-linear-to-br from-[#FFB81C] to-[#e5a518]" 
              title="Equipment Tracking" 
              description="Monitor laboratory equipment inventory, track borrowing status, and manage returns through a centralized dashboard."
            />
            <FeatureCard 
              icon={UsersIcon} 
              iconColor="bg-linear-to-br from-[#800000] to-[#5c0000]" 
              title="Multi-Role Dashboards" 
              description="Dedicated interfaces for admins, faculty, and students — each tailored with the tools and views they need."
            />
            <FeatureCard 
              icon={ClockIcon} 
              iconColor="bg-linear-to-br from-[#0d9488] to-[#0f766e]" 
              title="Real-time Updates" 
              description="Instant status updates on requests, approvals, and schedule changes keep everyone informed and in sync."
            />
          </div>
        </section>

        {/* About Section */}
        <section id="about" className="bg-linear-to-br from-[#5c0000] via-[#800000] to-[#a83232] text-white py-24 px-5 md:px-20 relative overflow-hidden">
          <div className="absolute -bottom-24 -right-24 w-[400px] h-[400px] rounded-full bg-[rgba(255,184,28,0.06)] pointer-events-none" />
          
          <div className="max-w-[1100px] mx-auto grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-16 items-center relative z-10">
            <div>
              <h2 className="text-4xl font-bold leading-tight mb-4">About<br />SmartLab</h2>
              <div className="w-[60px] h-[3px] bg-[#FFB81C] rounded mb-4" />
              <p className="text-sm opacity-80 leading-relaxed">
                Polytechnic University of the Philippines<br />
                Lopez, Quezon Campus<br />
                Bachelor of Science in Information Technology
              </p>
            </div>

            <div className="space-y-5">
              <p className="text-base leading-7 opacity-90">
                SmartLab is a web-based laboratory management system developed for PUP Lopez Campus. It provides a centralized platform for managing equipment borrowing, room scheduling, and laboratory operations — replacing manual processes with a streamlined digital workflow.
              </p>
              <p className="text-base leading-7 opacity-90">
                The system features automatic conflict detection for schedules, real-time equipment tracking, and role-based access for students, faculty, and administrators. Every request is validated, logged, and traceable.
              </p>
              <p className="text-base leading-7 opacity-90">
                Developed by students of the Bachelor of Science in Information Technology, SmartLab reflects the university's commitment to innovation and operational efficiency in academic laboratory management.
              </p>
            </div>
          </div>
        </section>

        {/* Login Section */}
        <section id="login" className="bg-linear-to-b from-[#faf9f7] to-[#f0ede8] py-24 px-5 flex justify-center">
          <div className="w-full max-w-[440px] bg-white rounded-2xl p-10 shadow-[0_8px_40px_rgba(0,0,0,0.08)] border border-[#e5e7eb] relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-[#800000] to-[#FFB81C]" />
            
            <div className="flex justify-center mb-5">
              <img src="/PUPLogo.png" alt="PUP Lopez Logo" className="w-[52px] h-[52px] object-contain rounded-full border-2 border-[#FFB81C] p-0.5 bg-white" />
            </div>
            
            <h2 className="text-2xl font-bold text-[#800000] text-center mb-1">Welcome Back</h2>
            <p className="text-center text-sm text-[#4b5563] mb-7">Sign in to your SmartLab account to continue.</p>

            {error && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 mb-4 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] text-sm">
                <span>Invalid email or password.</span>
              </div>
            )}

            <form onSubmit={handleLogin} noValidate>
              <label className="block text-xs font-semibold text-[#1f2937] mb-1.5 tracking-wide">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-3 rounded-xl border border-[#e5e7eb] bg-[#faf9f7] mb-4 text-sm font-[inherit] text-[#1f2937] transition-all focus:outline-none focus:border-[#800000] focus:shadow-[0_0_0_3px_rgba(128,0,0,0.08)] focus:bg-white"
                required
              />

              <label className="block text-xs font-semibold text-[#1f2937] mb-1.5 tracking-wide">Password</label>
              <div className="relative mb-4">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-3.5 py-3 pr-11 rounded-xl border border-[#e5e7eb] bg-[#faf9f7] text-sm font-[inherit] text-[#1f2937] transition-all focus:outline-none focus:border-[#800000] focus:shadow-[0_0_0_3px_rgba(128,0,0,0.08)] focus:bg-white"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 -translate-y-1/2 right-3 w-[34px] h-[34px] flex items-center justify-center text-[#9ca3af] rounded-md transition-all hover:text-[#800000] hover:bg-[rgba(128,0,0,0.05)]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full border-none rounded-xl bg-linear-to-br from-[#800000] to-[#5c0000] text-white py-3.5 text-base font-semibold flex items-center justify-center gap-2 transition-all hover:from-[#a83232] hover:to-[#800000] hover:-translate-y-0.5 shadow-[0_4px_12px_rgba(128,0,0,0.2)] hover:shadow-[0_6px_16px_rgba(128,0,0,0.3)] disabled:opacity-50"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
                <ArrowRightIcon />
              </button>
            </form>

            <p className="text-center mt-5 text-xs text-[#4b5563]">
              PUP Lopez Campus · Bachelor of Science in Information Technology
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-linear-to-br from-[#5c0000] to-[#800000] text-white text-center py-12 px-5">
        <div className="flex items-center justify-center gap-2 mb-3">
          <img src="/PUPLogo.png" alt="PUP Logo" className="w-7 h-7 object-contain rounded-full border border-[#FFB81C] p-0.5 bg-white" />
          <h3 className="text-lg font-bold">SmartLab</h3>
        </div>
        <p className="text-sm mb-1 opacity-85">Laboratory Equipment Borrowing and Scheduling System</p>
        <p className="text-sm mb-4 opacity-85">Polytechnic University of the Philippines — Lopez, Quezon Campus</p>
        <div className="w-[60px] h-0.5 bg-[#FFB81C] rounded mx-auto my-4 opacity-60" />
        <span className="block text-xs opacity-65">© 2026 SmartLab · Bachelor of Science in Information Technology</span>
      </footer>
    </div>
  );
}
