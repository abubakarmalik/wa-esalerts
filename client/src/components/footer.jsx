import React from 'react';

const Footer = () => {
  return (
    <>
      {/* Footer Branding */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white py-2 text-center text-sm z-50">
        <div className="container mx-auto flex items-center justify-center space-x-2">
          <span>Developed by</span>
          <a
            href="https://technogixt.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:text-gray-300 transition-colors"
          >
            Technogixt
          </a>
          <span>•</span>
          <span>{new Date().getFullYear()}</span>
        </div>
      </div>
    </>
  );
};

export default Footer;
