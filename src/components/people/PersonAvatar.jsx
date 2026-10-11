import { useState } from 'react';
import { Avatar } from '../ui';

/** Employee photo served by the authorized photo endpoint; falls back to initials when absent or hidden. */
export default function PersonAvatar({ uuid, name = '', hasPhoto = true, large = false }) {
  const [failed, setFailed] = useState(false);
  if (!uuid || !hasPhoto || failed) {
    return large ? (
      <span
        className="inline-flex size-20 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xl font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-300"
        role="img"
        aria-label={name}
      >
        {name
          .split(' ')
          .map((s) => s[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()}
      </span>
    ) : (
      <Avatar name={name} />
    );
  }
  const base = import.meta.env.VITE_API_BASE || '/api';
  return (
    <img
      src={`${base}/v1/employees/${uuid}/photo`}
      alt={`Photo of ${name}`}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full bg-brand-100 object-cover dark:bg-brand-900 ${large ? 'size-20' : 'size-9'}`}
    />
  );
}
