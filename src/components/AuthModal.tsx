import React, { useState } from 'react';
import { KeyRound, ShieldCheck, UserPlus, X } from 'lucide-react';
import { PublicUserSession } from '../shared/types';
import { apiFetch, persistAuth } from '../lib/api';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: (user: PublicUserSession) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess }) => {
  const [tab, setTab] = useState<'login' | 'register' | 'verify' | 'reset'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Registration fields
  const [namaLengkap, setNamaLengkap] = useState('');
  const [nik, setNik] = useState('');
  const [kk, setKk] = useState('');
  const [tanggalLahir, setTanggalLahir] = useState('');
  const [alamat, setAlamat] = useState('');
  const [rtRw, setRtRw] = useState('');
  const [noHp, setNoHp] = useState('');

  // Verify / Reset
  const [kodeVerifikasi, setKodeVerifikasi] = useState('');
  const [issuedCode, setIssuedCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: PublicUserSession }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      persistAuth(res.token, res.user);
      onSuccess(res.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await apiFetch<{ message: string; username: string; kodeVerifikasi: string }>(
        '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({
            namaLengkap,
            nik,
            kk,
            tanggalLahir,
            alamat,
            rtRw,
            noHp,
            username: username || noHp,
            password,
          }),
        }
      );
      setIssuedCode(res.kodeVerifikasi);
      setUsername(res.username);
      setKodeVerifikasi(res.kodeVerifikasi);
      setInfo(`${res.message} Kode verifikasi Anda: ${res.kodeVerifikasi}`);
      setTab('verify');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: PublicUserSession }>('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ username, kodeVerifikasi }),
      });
      persistAuth(res.token, res.user);
      onSuccess(res.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ username, tanggalLahir, newPassword }),
      });
      setInfo(res.message);
      setTab('login');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 sm:p-8 my-8 relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup jendela masuk"
          className="absolute top-5 right-5 p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        <h2 id="auth-modal-title" className="font-display text-2xl font-extrabold text-[#0F2942]">
          {tab === 'login' && 'Masuk ke WARGA AMPEL'}
          {tab === 'register' && 'Daftar Akun Warga Desa'}
          {tab === 'verify' && 'Verifikasi Identitas Warga'}
          {tab === 'reset' && 'Atur Ulang Kata Sandi'}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {tab === 'login' && 'Gunakan akun Warga, Petugas, Operator, Kepala Desa, atau Super Admin.'}
          {tab === 'register' && 'NIK dan nomor KK disimpan dalam bentuk ter-mask untuk keamanan data Anda.'}
          {tab === 'verify' && 'Masukkan kode verifikasi yang telah dikirim untuk mengaktifkan akun.'}
          {tab === 'reset' && 'Cocokkan username/No. HP dan tanggal lahir terdaftar.'}
        </p>

        {/* Mode Switch Tabs */}
        <div className="mt-5 flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-sm">
          <button
            type="button"
            onClick={() => { setTab('login'); setError(''); }}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold whitespace-nowrap cursor-pointer ${
              tab === 'login' ? 'bg-white text-[#0F2942] shadow-sm' : 'text-slate-600'
            }`}
          >
            Masuk
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setError(''); }}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold whitespace-nowrap cursor-pointer ${
              tab === 'register' ? 'bg-white text-[#0F2942] shadow-sm' : 'text-slate-600'
            }`}
          >
            Daftar Warga
          </button>
          <button
            type="button"
            onClick={() => { setTab('reset'); setError(''); }}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold whitespace-nowrap cursor-pointer ${
              tab === 'reset' ? 'bg-white text-[#0F2942] shadow-sm' : 'text-slate-600'
            }`}
          >
            Lupa Sandi
          </button>
        </div>

        {error && (
          <div role="alert" className="mt-4 p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-sm font-medium">
            {error}
          </div>
        )}
        {info && (
          <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 text-sm font-medium">
            {info}
          </div>
        )}

        {tab === 'login' && (
          <form onSubmit={handleLogin} className="mt-5 space-y-4">
            <div>
              <label htmlFor="login-username" className="block text-sm font-semibold text-slate-900 mb-1">
                Username atau Nomor HP
              </label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Contoh: admin atau sriwahyuni"
                className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-semibold text-slate-900 mb-1">
                Kata Sandi
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi"
                className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#0B6E4F] text-white text-base font-bold rounded-xl hover:bg-[#08553d] transition-colors cursor-pointer"
            >
              {loading ? 'Memeriksa...' : 'Masuk Sekarang'}
            </button>
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={handleRegister} className="mt-5 space-y-3.5">
            <div>
              <label htmlFor="reg-nama" className="block text-sm font-semibold text-slate-900 mb-1">
                Nama Lengkap Sesuai KTP
              </label>
              <input
                id="reg-nama"
                type="text"
                value={namaLengkap}
                onChange={(e) => setNamaLengkap(e.target.value)}
                className="w-full px-3.5 py-2.5 text-base border border-slate-300 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-nik" className="block text-sm font-semibold text-slate-900 mb-1">
                  NIK (16 Digit)
                </label>
                <input
                  id="reg-nik"
                  type="text"
                  maxLength={16}
                  value={nik}
                  onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))}
                  placeholder="3309..."
                  className="w-full px-3.5 py-2.5 text-base font-mono border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label htmlFor="reg-kk" className="block text-sm font-semibold text-slate-900 mb-1">
                  Nomor KK (Opsional)
                </label>
                <input
                  id="reg-kk"
                  type="text"
                  maxLength={16}
                  value={kk}
                  onChange={(e) => setKk(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3.5 py-2.5 text-base font-mono border border-slate-300 rounded-xl"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-dob" className="block text-sm font-semibold text-slate-900 mb-1">
                  Tanggal Lahir
                </label>
                <input
                  id="reg-dob"
                  type="date"
                  value={tanggalLahir}
                  onChange={(e) => setTanggalLahir(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-base border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label htmlFor="reg-hp" className="block text-sm font-semibold text-slate-900 mb-1">
                  Nomor HP / WhatsApp
                </label>
                <input
                  id="reg-hp"
                  type="tel"
                  value={noHp}
                  onChange={(e) => setNoHp(e.target.value)}
                  placeholder="08..."
                  className="w-full px-3.5 py-2.5 text-base border border-slate-300 rounded-xl"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-alamat" className="block text-sm font-semibold text-slate-900 mb-1">
                  Dusun / Alamat
                </label>
                <input
                  id="reg-alamat"
                  type="text"
                  value={alamat}
                  onChange={(e) => setAlamat(e.target.value)}
                  placeholder="Dusun Krajan"
                  className="w-full px-3.5 py-2.5 text-base border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label htmlFor="reg-rtrw" className="block text-sm font-semibold text-slate-900 mb-1">
                  RT / RW
                </label>
                <input
                  id="reg-rtrw"
                  type="text"
                  value={rtRw}
                  onChange={(e) => setRtRw(e.target.value)}
                  placeholder="RT 02 / RW 01"
                  className="w-full px-3.5 py-2.5 text-base border border-slate-300 rounded-xl"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-user" className="block text-sm font-semibold text-slate-900 mb-1">
                  Username
                </label>
                <input
                  id="reg-user"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Misal: budiwarga"
                  className="w-full px-3.5 py-2.5 text-base border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label htmlFor="reg-pass" className="block text-sm font-semibold text-slate-900 mb-1">
                  Kata Sandi (min. 6)
                </label>
                <input
                  id="reg-pass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-base border border-slate-300 rounded-xl"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#0B6E4F] text-white text-base font-bold rounded-xl hover:bg-[#08553d] flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-5 h-5" aria-hidden="true" />
              <span>{loading ? 'Mendaftarkan...' : 'Daftar & Dapatkan Kode Verifikasi'}</span>
            </button>
          </form>
        )}

        {tab === 'verify' && (
          <form onSubmit={handleVerify} className="mt-5 space-y-4">
            {issuedCode && (
              <div className="p-3 bg-slate-100 border border-slate-300 rounded-xl text-sm">
                Kode verifikasi terdaftar: <span className="font-mono font-bold text-[#0F2942]">{issuedCode}</span>
              </div>
            )}
            <div>
              <label htmlFor="ver-user" className="block text-sm font-semibold text-slate-900 mb-1">
                Username / No. HP
              </label>
              <input
                id="ver-user"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label htmlFor="ver-code" className="block text-sm font-semibold text-slate-900 mb-1">
                Kode Verifikasi
              </label>
              <input
                id="ver-code"
                type="text"
                value={kodeVerifikasi}
                onChange={(e) => setKodeVerifikasi(e.target.value)}
                placeholder="Contoh: AMP-4821"
                className="w-full px-4 py-3 text-base font-mono border border-slate-300 rounded-xl"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#0B6E4F] text-white text-base font-bold rounded-xl hover:bg-[#08553d] flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
              <span>{loading ? 'Memverifikasi...' : 'Aktifkan Akun Saya'}</span>
            </button>
          </form>
        )}

        {tab === 'reset' && (
          <form onSubmit={handleReset} className="mt-5 space-y-4">
            <div>
              <label htmlFor="rst-user" className="block text-sm font-semibold text-slate-900 mb-1">
                Username atau Nomor HP Terdaftar
              </label>
              <input
                id="rst-user"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label htmlFor="rst-dob" className="block text-sm font-semibold text-slate-900 mb-1">
                Tanggal Lahir Terdaftar
              </label>
              <input
                id="rst-dob"
                type="date"
                value={tanggalLahir}
                onChange={(e) => setTanggalLahir(e.target.value)}
                className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label htmlFor="rst-pass" className="block text-sm font-semibold text-slate-900 mb-1">
                Kata Sandi Baru (min. 6 karakter)
              </label>
              <input
                id="rst-pass"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#0F2942] text-white text-base font-bold rounded-xl hover:bg-[#173b5e] flex items-center justify-center gap-2 cursor-pointer"
            >
              <KeyRound className="w-5 h-5" aria-hidden="true" />
              <span>{loading ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
