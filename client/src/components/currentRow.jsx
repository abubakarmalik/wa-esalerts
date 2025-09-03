import React from 'react';
import { useSelector } from 'react-redux';

const CurrentRow = () => {
  return (
    <div className="overflow-x-auto rounded-lg shadow-md">
      <table className="min-w-full bg-white">
        <thead>
          <tr className="bg-gray-800 text-white">
            <th className="py-4 px-6 text-left font-semibold">Serial No.</th>
            <th className="py-4 px-6 text-left font-semibold">SMS to</th>
            <th className="py-4 px-6 text-left font-semibold">SMS Body</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          <tr>
            <td className="py-4 px-6 text-gray-500" colSpan={3}>
              No active row
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default CurrentRow;
