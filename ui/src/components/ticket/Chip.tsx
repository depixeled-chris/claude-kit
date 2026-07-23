// A classified value chip (KIT-T148). Only a real item id navigates in-app; a commit sha becomes a
// mono chip that permalinks to <remoteUrl>/commit/<sha> when the project has a resolvable remote,
// else a non-navigating copy-to-clipboard chip — never a broken ticket route. Plain text renders inert.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { classifyChip } from '../../lib/chips';
import './Chip.css';

const SHORT_SHA_LEN = 10; // git's abbreviated-sha display length
const COPIED_FEEDBACK_MS = 1200; // how long the "copied" confirmation shows

interface Props {
  value: string;
  projectKey: string;
  remoteUrl: string | null;
}

export function Chip({ value, projectKey, remoteUrl }: Props) {
  const kind = classifyChip(value);
  if (kind === 'item') {
    return <Link className="chip chip-item" to={`/p/${projectKey}/t/${value}`}>{value}</Link>;
  }
  if (kind === 'commit') {
    return <CommitChip sha={value} remoteUrl={remoteUrl} />;
  }
  return <span className="chip chip-text">{value}</span>;
}

function CommitChip({ sha, remoteUrl }: { sha: string; remoteUrl: string | null }) {
  const short = sha.length > SHORT_SHA_LEN ? sha.slice(0, SHORT_SHA_LEN) : sha;
  const [copied, setCopied] = useState(false);

  if (remoteUrl) {
    return (
      <a
        className="chip chip-commit"
        href={`${remoteUrl}/commit/${sha}`}
        target="_blank"
        rel="noreferrer"
        title={`View commit ${sha}`}
      >
        {short}
      </a>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard?.writeText(sha);
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      /* clipboard blocked — the title still shows the full sha */
    }
  }

  return (
    <button type="button" className="chip chip-commit chip-copy" title={`Copy ${sha}`} onClick={copy}>
      {copied ? 'copied' : short}
    </button>
  );
}
