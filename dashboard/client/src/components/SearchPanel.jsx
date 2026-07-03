import { useState } from 'react';

export default function SearchPanel({ onSearch, disabled }) {
  const [keyword, setKeyword] = useState('');

  const handleClick = () => {
    if (disabled) return;
    onSearch(keyword.trim());
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        placeholder="Keyword (optional)"
        value={keyword}
        onChange={e => setKeyword(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleClick()}
        disabled={disabled}
        className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-44 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <button
        onClick={handleClick}
        disabled={disabled}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {disabled ? 'Running...' : 'Search Jobs'}
      </button>
    </div>
  );
}
