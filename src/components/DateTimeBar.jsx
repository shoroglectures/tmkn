import { useEffect, useState } from 'react';
import { CalendarDays, Clock3 } from 'lucide-react';
import { fmtDate } from '../utils/format';

const clockFormatter = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
  timeZone: 'Asia/Riyadh',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

export default function DateTimeBar({ className = '' }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className={`date-time-bar no-print ${className}`} dir="rtl">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="inline-flex items-center gap-2">
          <CalendarDays size={15} aria-hidden="true" />
          <span>{fmtDate(now)}</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <Clock3 size={15} aria-hidden="true" />
          <time dateTime={now.toISOString()}>{clockFormatter.format(now)}</time>
        </span>
      </div>
    </header>
  );
}