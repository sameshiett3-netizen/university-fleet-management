const TONE = {
    Available: 'green', 'In Trip': 'blue', Maintenance: 'amber',
    Pending: 'grey', Approved: 'blue', Active: 'green', Completed: 'dark', Cancelled: 'red',
    Warning: 'amber', Overdue: 'red',
};

export default function StatusBadge({ value }) {
    if (!value) return null;
    return <span className={`badge badge-${TONE[value] || 'grey'}`}>{value}</span>;
}
