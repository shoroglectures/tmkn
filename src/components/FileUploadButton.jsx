import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';

export default function FileUploadButton({
  onFile,
  accept = '.xlsx,.xls,.csv',
  label = 'استيراد',
  className = 'btn-ghost',
}) {
  const ref = useRef(null);
  const [loading, setLoading] = useState(false);

  async function handle(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      await onFile(file);
    } finally {
      setLoading(false);
      if (ref.current) ref.current.value = '';
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={className}
        disabled={loading}
      >
        <Upload size={16} />
        {loading ? 'جاري...' : label}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        onChange={handle}
        className="hidden"
      />
    </>
  );
}