import React from 'react';
import Header from '../components/reusable/Header';

const NotFoundPage = () => {
    return (
        <div className="bg-[#f6f7f8] font-sans text-[#0d141b] min-h-screen flex flex-col transition-colors duration-200">
            <Header />
            <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
                <div className="flex flex-col items-center gap-8 w-full max-w-[480px] animate-in fade-in slide-in-from-bottom-4 duration-700">

                    <div className="relative w-full max-w-[320px] aspect-square flex items-center justify-center">
                        <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-3xl"></div>

                        <div className="relative flex flex-col items-center">
                            <span className="text-9xl font-black text-[#137fec] opacity-10 select-none">404</span>
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-3 text-center">
                        <h1 className="text-[#0d141b] text-3xl font-bold leading-tight tracking-tight">
                            Oops! Page Not Found
                        </h1>
                        <p className="text-slate-500 text-base font-medium leading-relaxed max-w-[360px]">
                            The link you followed may be broken, or the page may have been moved.
                        </p>
                    </div>

                </div>
            </main>

        </div>
    );
};

export default NotFoundPage;