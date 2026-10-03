export default function StatCard({ emoji, icon: Icon, value, label, color = 'brand' }) {
  const colorMap = {
    brand: 'border-brand-600 text-brand-700',
    gold:  'border-gold-500 text-gold-600',
    red:   'border-red-500 text-red-600',
    green: 'border-emerald-500 text-emerald-600',
  };

  return (
    <div className={`card p-4 border-r-4 ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        {emoji && <span className="text-lg">{emoji}</span>}
        {Icon && <Icon size={18} />}
      </div>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs text-slate-500 font-semibold">{label}</div>
    </div>
  );
}