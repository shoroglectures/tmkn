import { Inbox } from 'lucide-react';

export default function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="card p-10 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon size={26} strokeWidth={1.8} aria-hidden="true" />
      </div>
      <h3 className="font-bold text-lg mb-1">{title}</h3>
      {description && (
        <p className="text-slate-500 text-sm mb-5 max-w-sm mx-auto">{description}</p>
      )}
      {action}
    </div>
  );
}