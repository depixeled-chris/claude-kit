// The shared loading / error views every page shows while useAsync resolves. Keeps the three
// pages from each re-implementing a spinner + retry block.

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="async-loading">{label}</div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="async-error">
      <p>{message}</p>
      {onRetry && <button className="btn" onClick={onRetry}>Retry</button>}
    </div>
  );
}
