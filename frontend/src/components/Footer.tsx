import React from 'react';
import { useLocation } from 'react-router-dom';

export const Footer: React.FC = () => {
  const location = useLocation();

  // Kiosk screens run borderless without the website footer
  if (location.pathname.startsWith('/display/')) {
    return null;
  }

  return (
    <footer className="bg-[#FAF9F6] border-t border-[#E4E1DA] text-[#5B6472] text-[11px] py-4 mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-2 text-center md:text-left">
        <div>
          Maulana Azad National Institute of Technology, Bhopal • Council of Wardens
        </div>
        <div className="flex items-center gap-3 text-[#5B6472]">
          <span>Security desk: 0755-4051000</span>
          <span>•</span>
          <span>Anti-ragging: 1800-180-5522</span>
        </div>
        <div className="text-[#8C93A0]">
          © 2026 MANIT Bhopal
        </div>
      </div>
    </footer>
  );
};
