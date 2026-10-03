export default function StartupSplash() {
  return (
    <main className="startup-screen" role="status" aria-live="polite" aria-label="جاري تحميل تمكن بلس">
      <div className="startup-lockup">
        <div className="startup-emblem">
          <span className="startup-ring startup-ring-outer" aria-hidden="true" />
          <span className="startup-ring startup-ring-inner" aria-hidden="true" />
          <img src="/logo.svg" alt="" className="startup-logo" />
        </div>
        <h1>تمكن بلس</h1>
        <p>مسار التمكّن التدريبي</p>
      </div>
      <span className="startup-status">جاري تجهيز مسارك...</span>
    </main>
  );
}