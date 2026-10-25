import React, { useRef, useState } from 'react';
import { doc, setDoc, writeBatch, Firestore } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Download, Upload, ShieldCheck, FileSpreadsheet, AlertTriangle } from 'lucide-react';

type BackupPanelProps = {
  db: Firestore;
  appId: string;
  products: any[];
  transactions: any[];
  storeInfo: any;
  paperSize: string;
  onNotice: (message: string) => void;
};

const path = (appId: string, name: string) => ['artifacts', appId, 'public', 'data', name];

function jsonSafe(value: any) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default function BackupPanel({
  db, appId, products, transactions, storeInfo, paperSize, onNotice
}: BackupPanelProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const downloadBackup = () => {
    try {
      const workbook = XLSX.utils.book_new();
      const productRows = products.map(({ id, ...data }) => ({ id, ...jsonSafe(data) }));
      const transactionRows = transactions.map(({ id, ...data }) => {
        const { items, ...transactionFields } = data;
        return {
          id,
          ...jsonSafe(transactionFields),
          items_json: JSON.stringify(items ?? [])
        };
      });
      const transactionDetails = transactions.flatMap((transaction: any) =>
        (Array.isArray(transaction.items) ? transaction.items : []).map((item: any, index: number) => ({
          transactionId: transaction.id,
          invoiceNumber: transaction.invoiceNumber ?? '',
          itemIndex: index + 1,
          ...jsonSafe(item)
        }))
      );
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(productRows), 'Produk');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(transactionRows), 'Transaksi');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(transactionDetails), 'Detail Transaksi');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{
        ...jsonSafe(storeInfo),
        paperSize,
        documentId: 'receipt_config'
      }]), 'Pengaturan Toko');
      XLSX.writeFile(workbook, `AmiraKasir_Backup_${new Date().toISOString().slice(0, 10)}.xlsx`);
      onNotice('Backup Excel berhasil diunduh.');
    } catch (error) {
      console.error('Backup export failed:', error);
      onNotice('Backup gagal dibuat. Silakan coba lagi.');
    }
  };

  const restoreBackup = async (file: File) => {
    setBusy(true);
    try {
      const bytes = await file.arrayBuffer();
      const workbook = XLSX.read(bytes, { type: 'array' });
      const requiredSheets = ['Produk', 'Transaksi'];
      const missing = requiredSheets.filter((name) => !workbook.Sheets[name]);
      if (missing.length) throw new Error(`Sheet wajib tidak ditemukan: ${missing.join(', ')}`);

      const readRows = (sheetName: string) =>
        XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[sheetName], { defval: null });

      const productRows = readRows('Produk');
      const transactionRows = readRows('Transaksi');
      const settingsRows = workbook.Sheets['Pengaturan Toko'] ? readRows('Pengaturan Toko') : [];
      const validate = (rows: any[], label: string) => {
        if (rows.some((row) => !row.id || typeof row.id !== 'string')) {
          throw new Error(`Ada ID dokumen kosong/tidak valid di sheet ${label}.`);
        }
        const ids = rows.map((row) => row.id);
        if (new Set(ids).size !== ids.length) throw new Error(`Ada ID duplikat di sheet ${label}.`);
      };
      validate(productRows, 'Produk');
      validate(transactionRows, 'Transaksi');
      if (!productRows.length && !transactionRows.length && !settingsRows.length) {
        throw new Error('File backup tidak berisi data untuk dipulihkan.');
      }

      const parsedTransactions = transactionRows.map((row) => {
        const { id, items_json, ...fields } = row;
        let items = fields.items;
        if (typeof items_json === 'string' && items_json.trim()) {
          try { items = JSON.parse(items_json); } catch { throw new Error(`Detail item transaksi ${id} rusak.`); }
        }
        if (items == null) items = [];
        if (!Array.isArray(items)) throw new Error(`Format item transaksi ${id} tidak valid.`);
        delete fields.items;
        return { id, data: { ...fields, items: jsonSafe(items) } };
      });
      const parsedProducts = productRows.map(({ id, ...data }) => ({ id, data }));
      const settings = settingsRows[0];
      if (settings && settings.documentId && settings.documentId !== 'receipt_config') {
        throw new Error('ID pengaturan toko tidak valid.');
      }

      const confirmed = window.confirm(
        `Pulihkan ${parsedProducts.length} produk dan ${parsedTransactions.length} transaksi dari file Excel?\n\nMode: gabungkan berdasarkan ID. Data yang tidak ada di file tidak dihapus. Data dengan ID sama akan diperbarui.`
      );
      if (!confirmed) return;

      const operations: Array<{ ref: any; data: any }> = [
        ...parsedProducts.map((row) => ({
          ref: doc(db, ...path(appId, 'products'), row.id),
          data: row.data
        })),
        ...parsedTransactions.map((row) => ({
          ref: doc(db, ...path(appId, 'transactions'), row.id),
          data: row.data
        }))
      ];
      for (let start = 0; start < operations.length; start += 450) {
        const batch = writeBatch(db);
        operations.slice(start, start + 450).forEach(({ ref, data }) => batch.set(ref, data, { merge: true }));
        await batch.commit();
      }

      if (settings) {
        const { documentId, ...settingsData } = settings;
        const configRef = doc(db, ...path(appId, 'settings'), 'receipt_config');
        await setDoc(configRef, settingsData, { merge: true });
      }
      onNotice('Restore selesai. Data dengan ID sama diperbarui; data lain tetap dipertahankan.');
    } catch (error: any) {
      console.error('Backup restore failed:', error);
      onNotice(error?.message ? `Restore gagal: ${error.message}` : 'Restore gagal. Pastikan file Excel berasal dari backup Amira Kasir.');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <section className="space-y-5">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-500/10 p-3"><FileSpreadsheet className="w-6 h-6 text-emerald-400" /></div>
          <div>
            <h2 className="text-lg font-bold text-white">Backup & Restore Data</h2>
            <p className="text-sm text-slate-400 mt-1">Simpan atau pulihkan data Amira Kasir Pro menggunakan file Excel (.xlsx).</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
          <button type="button" onClick={downloadBackup} disabled={busy}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-3 text-sm font-bold text-white">
            <Download className="w-4 h-4" /> Download Backup Excel
          </button>
          <button type="button" onClick={() => fileInput.current?.click()} disabled={busy}
            className="flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 px-4 py-3 text-sm font-bold text-white">
            <Upload className="w-4 h-4" /> {busy ? 'Memulihkan...' : 'Upload / Restore Excel'}
          </button>
          <input ref={fileInput} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void restoreBackup(file);
            }} />
        </div>
        <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300"><ShieldCheck className="w-4 h-4" /> Data aman: mode gabungkan</p>
          <p className="text-xs leading-relaxed text-slate-400 mt-2">Restore mempertahankan ID dokumen. Data yang sudah ada dengan ID sama akan diperbarui, data baru akan ditambahkan, dan data yang tidak ada di file tidak dihapus.</p>
        </div>
        <div className="mt-3 flex items-start gap-2 text-xs text-amber-300/90">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>Simpan file backup di tempat aman. File Excel berisi data transaksi dan informasi toko. Lakukan download backup sebelum memulihkan data.</p>
        </div>
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[['Produk', products.length], ['Transaksi', transactions.length], ['Detail barang', transactions.reduce((n: number, t: any) => n + (Array.isArray(t.items) ? t.items.length : 0), 0)], ['Format', 'Excel .xlsx']].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-bold text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
