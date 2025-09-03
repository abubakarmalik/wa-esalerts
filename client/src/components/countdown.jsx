import React, { useState, useEffect } from 'react';

const Countdown = ({ initialTime = 60, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);

  useEffect(() => {
    if (!timeLeft) {
      onComplete?.();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onComplete]);

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col p-3 min-w-[100px] items-center">
        <h3 className="font-semibold text-gray-600">
          Next message will be send
        </h3>
        <div className="text-4xl text-gray-800 font-mono  font-bold">
          {timeLeft}
        </div>
        <span className="text-xs text-gray-400 mt-1 text-center">seconds</span>
      </div>
    </div>
  );
};

export default Countdown;
