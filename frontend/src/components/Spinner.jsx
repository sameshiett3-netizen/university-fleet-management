export default function Spinner({ full = false, label = 'Loading...' }) {
    return (
        <div className={full ? 'spinner-full' : 'spinner-inline'} role="status">
            <span className="spinner" aria-hidden="true" />
            <span>{label}</span>
        </div>
    );
}
