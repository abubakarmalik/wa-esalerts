import React from 'react';
import logo from '../assets/technogixt-logo.png';

const Branding = () => {
  return (
    <>
      {/* Header Branding */}
      <div className="bg-gray-200 backdrop-blur-sm shadow-md py-2 px-4">
        <div className="container mx-auto flex items-center justify-center">
          <div className="flex items-center">
            <div className="flex-shrink-0 mr-4">
              <img src={logo} alt="Technogixt Logo" className="h-12 w-auto" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold text-gray-800">
                Technogixt
              </span>
              <span className="text-sm text-gray-600">
                Innovating Technology Solutions
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Branding;
