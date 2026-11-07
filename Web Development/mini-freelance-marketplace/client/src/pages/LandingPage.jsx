import React from 'react';
import {
  FileText,
  UserSearch,
  CheckCircle,
} from 'lucide-react';
import Header from '../components/reusable/Header';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate()
  return (
    <div className="bg-slate-50 font-sans text-[#111418] transition-colors duration-200 min-h-screen">

      <Header />

      <main className="w-full max-w-7xl mx-auto">

        <div className="px-4 py-6 md:py-10">
          <div className="relative overflow-hidden rounded-2xl bg-blue-600/5">
            <div
              className="flex min-h-[440px] md:min-h-[520px] flex-col gap-6 items-center justify-center p-8 text-center bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage: `linear-gradient(rgba(19, 127, 236, 0.2), rgba(0, 0, 0, 0.7)), url("https://images.unsplash.com/photo-1497215728101-856f4ea42174?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80")`
              }}
            >
              <div className="flex flex-col gap-4 max-w-2xl">
                <h1 className="text-white text-3xl md:text-5xl font-black leading-tight tracking-tight">
                  Connect with world-class freelancers.
                </h1>
                <h2 className="text-white/90 text-sm md:text-lg font-normal leading-relaxed">
                  The trusted platform for professional project management and talent sourcing across 150+ countries.
                </h2>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mt-4">
                <button type='button' onClick={() => { navigate(`/login`) }} className="flex min-w-[160px] cursor-pointer items-center justify-center rounded-xl h-12 px-6 bg-blue-600 text-white text-base font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
                  Get Started
                </button>
                <button type='button' onClick={() => { navigate(`/find-work`) }} className="flex min-w-[160px] cursor-pointer items-center justify-center rounded-xl h-12 px-6 bg-white text-[#111418] text-base font-bold hover:bg-gray-100 transition-all">
                  Browse Projects
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h4 className="text-blue-600 text-sm font-bold uppercase tracking-widest px-4 py-2 text-center">
            Platform Excellence
          </h4>
          <h3 className="text-[#111418] text-2xl md:text-3xl font-bold text-center mb-4">
            How it works
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
          <FeatureCard
            icon={<FileText size={24} />}
            title="Post a Job"
            description="Clearly describe your project requirements and budget to attract the best talent."
          />
          <FeatureCard
            icon={<UserSearch size={24} />}
            title="Hire Talent"
            description="Review detailed portfolios, compare proposals, and interview your top candidates."
          />
          <FeatureCard
            icon={<CheckCircle size={24} />}
            title="Get Work Done"
            description="Collaborate in real-time using our workspace and only pay for work you approve."
          />
        </div>

      </main>
    </div>
  );
};


const FeatureCard = ({ icon, title, description }) => (
  <div className="flex flex-1 gap-4 rounded-2xl border border-slate-200 bg-white p-6 flex-col hover:shadow-lg transition-all">
    <div className="text-blue-600 bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center">
      {icon}
    </div>
    <div className="flex flex-col gap-2">
      <h2 className="text-[#111418] text-lg font-bold leading-tight">{title}</h2>
      <p className="text-slate-500 text-sm leading-normal">{description}</p>
    </div>
  </div>
);


export default LandingPage;