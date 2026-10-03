export default function PageHeader({ title, subtitle, action, backTo, backLabel }) {
  return (
    <div className="mb-6">
      {backTo && (
        <a
          href={backTo}
          className="text-brand-600 text-sm font-semibold hover:underline inline-block mb-2"
        >
          ← {backLabel || 'العودة'}
        </a>
      )}
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-800">{title}</h1>
          {subtitle && <p className="text-slate-500 text-sm mt-1">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}