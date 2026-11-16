import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { EvidenceVerifier, fetchEvidenceFile, openEvidenceInNewTab } from '../lib/api';

interface EvidenceImageProps {
  idBukti: string;
  namaFile: string;
  mimeType: string;
  verifier?: EvidenceVerifier;
  className?: string;
}

/**
 * Pratinjau bukti. Gambar diambil dari backend lalu ditampilkan sebagai blob lokal.
 * Berkas lain (PDF) hanya menampilkan nama berkas; bukanya lewat EvidenceOpenButton.
 */
export function EvidenceImage({
  idBukti,
  namaFile,
  mimeType,
  verifier,
  className = 'h-48',
}: EvidenceImageProps) {
  const isImage = mimeType.startsWith('image/');
  const ticketId = verifier?.ticketId;
  const tanggalLahir = verifier?.tanggalLahir;
  const last4Hp = verifier?.last4Hp;
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isImage) return undefined;
    let cancelled = false;
    let objectUrl = '';
    setError('');
    fetchEvidenceFile(idBukti, { ticketId, tanggalLahir, last4Hp })
      .then((file) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(file.blob);
        setSrc(objectUrl);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal memuat pratinjau.');
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setSrc(null);
    };
  }, [idBukti, isImage, ticketId, tanggalLahir, last4Hp]);

  if (!isImage) {
    return (
      <div className={`${className} bg-slate-100 flex flex-col items-center justify-center p-4`}>
        <FileText className="w-10 h-10 text-[#0F2942]" aria-hidden="true" />
        <span className="mt-2 text-sm font-medium text-slate-700 text-center break-all">{namaFile}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className} bg-rose-50 flex items-center justify-center p-4`}>
        <p role="alert" className="text-sm text-rose-800 text-center">
          {error}
        </p>
      </div>
    );
  }

  if (!src) {
    return (
      <div className={`${className} bg-slate-100 flex items-center justify-center`}>
        <p className="text-sm text-slate-600">Memuat pratinjau...</p>
      </div>
    );
  }

  return <img src={src} alt={namaFile} className={`${className} w-full object-cover bg-slate-100`} />;
}

interface EvidenceOpenButtonProps {
  idBukti: string;
  label: string;
  verifier?: EvidenceVerifier;
  className?: string;
}

/** Tombol untuk membuka bukti di tab baru, lengkap dengan pesan galat bila gagal. */
export function EvidenceOpenButton({ idBukti, label, verifier, className }: EvidenceOpenButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleOpen = async () => {
    setBusy(true);
    setError('');
    try {
      await openEvidenceInNewTab(idBukti, verifier ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuka bukti.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="shrink-0 text-right">
      <button type="button" onClick={handleOpen} disabled={busy} className={className}>
        {busy ? 'Membuka...' : label}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-rose-700 max-w-[14rem]">
          {error}
        </p>
      )}
    </div>
  );
}
