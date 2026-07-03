export default function JobTable({ jobs, selectedJob, onSelect }) {
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <svg className="w-12 h-12 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-base font-medium mb-1">No job postings yet</p>
        <p className="text-sm">Click &ldquo;Search Jobs&rdquo; to get started</p>
      </div>
    );
  }

  const sorted = [...jobs].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {['Title', 'Company', 'Location', 'Type', 'Salary', 'Score', 'Status', 'Date'].map(h => (
              <th key={h} className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map((job, i) => {
            const isSelected = selectedJob?.url === job.url;
            return (
              <tr
                key={job.url ?? i}
                onClick={() => onSelect(isSelected ? null : job)}
                className={`cursor-pointer transition-colors ${
                  isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">{job.title}</td>
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{job.company}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{job.location}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{job.type}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{job.salary || 'Not listed'}</td>
                <td className="px-4 py-3 whitespace-nowrap"><ScoreBadge score={job.score} /></td>
                <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={job.status} /></td>
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{job.dateFound}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ScoreBadge({ score }) {
  const s = Number(score ?? 0);
  const cls = s >= 9
    ? 'bg-green-100 text-green-700'
    : s >= 7
    ? 'bg-blue-100 text-blue-700'
    : 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {s}/10
    </span>
  );
}

function StatusBadge({ status }) {
  if (!status || status === 'Not Applied') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
        Not Applied
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
      {status}
    </span>
  );
}
