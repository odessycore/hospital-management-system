import { initials } from '../../lib/format';

export function Avatar({
  name,
  size = 'md',
}: {
  name: string;
  size?: 'sm' | 'md';
}) {
  const dims = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700 ${dims}`}
    >
      {initials(name) || '?'}
    </div>
  );
}
