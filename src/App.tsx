import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  setDoc,
  onSnapshot 
} from 'firebase/firestore';
import { 
  ShoppingCart, 
  Package, 
  History, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Smartphone, 
  Layers, 
  Tag, 
  DollarSign, 
  Printer, 
  RefreshCw, 
  Box, 
  X,
  CreditCard,
  Banknote,
  QrCode,
  Store,
  Settings,
  Bluetooth,
  Percent,
  User,
  Filter,
  ArrowUpDown,
  Calendar
} from 'lucide-react';

// --- KONFIGURASI FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAqwKnrshTfZg4zvigi9w2S6n8hHrwOIM",
  authDomain: "kasirpro-amira.firebaseapp.com",
  projectId: "kasirpro-amira",
  storageBucket: "kasirpro-amira.firebasestorage.app",
  messagingSenderId: "477581381663",
  appId: "1:477581381663:web:57de7f60158f889ea5c52a",
  measurementId: "G-6B0PV4D87B"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'kasir-pintar-pos-id';

// --- DATA CONTOH AWAL (Bila Database Kosong) ---
const SAMPLE_PRODUCTS = [
  {
    name: 'Indomie Goreng Spesial 85g',
    sku: 'BRG-001',
    category: 'Makanan',
    stock: 200,
    unit: 'Bungkus',
    costPrice: 2600,
    retailPrice: 3500,
    wholesalePrice: 3100,
    resellerPrice: 2950,
    wholesaleMinQty: 40 // 1 Dus
  },
  {
    name: 'Minyak Goreng SunCo 2 Liter',
    sku: 'BRG-002',
    category: 'Sembako',
    stock: 48,
    unit: 'Pouch',
    costPrice: 32000,
    retailPrice: 36500,
    wholesalePrice: 34500,
    resellerPrice: 33800,
    wholesaleMinQty: 6
  },
  {
    name: 'Kopi Kapal Api Special Mix 24g',
    sku: 'BRG-003',
    category: 'Minuman',
    stock: 150,
    unit: 'Sachet',
    costPrice: 1200,
    retailPrice: 2000,
    wholesalePrice: 1500,
    resellerPrice: 1400,
    wholesaleMinQty: 10 // 1 Renceng
  },
  {
    name: 'Beras Pandan Wangi Premium 5kg',
    sku: 'BRG-004',
    category: 'Sembako',
    stock: 25,
    unit: 'Karung',
    costPrice: 68000,
    retailPrice: 75000,
    wholesalePrice: 71500,
    resellerPrice: 70000,
    wholesaleMinQty: 5
  },
  {
    name: 'Teh Pucuk Harum 350ml',
    sku: 'BRG-005',
    category: 'Minuman',
    stock: 120,
    unit: 'Botol',
    costPrice: 2800,
    retailPrice: 4000,
    wholesalePrice: 3300,
    resellerPrice: 3150,
    wholesaleMinQty: 24 // 1 Karton
  },
  {
    name: 'Gula Pasir Gulaku 1kg',
    sku: 'BRG-006',
    category: 'Sembako',
    stock: 60,
    unit: 'Pack',
    costPrice: 15500,
    retailPrice: 18000,
    wholesalePrice: 16800,
    resellerPrice: 16400,
    wholesaleMinQty: 10
  }
];

// Format Rupiah dengan simbol Rp
const formatRp = (number: any) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Number(number) || 0);
};

// Format Angka Ribuan tanpa simbol Rp (agar muat rapi di kertas struk 58mm)
const formatNum = (number: any) => {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Number(number) || 0);
};

export default function App() {
  // --- STATE AUTH & SINKRONISASI ---
  const [user, setUser] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('pos'); // 'pos' | 'inventory' | 'transactions'
  const [notification, setNotification] = useState<any>(null);

  // --- STATE DATA UTAMA (FIRESTORE) ---
  const [products, setProducts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  // --- STATE PENGATURAN NOTA TOKO & BLUETOOTH ---
  const [receiptSettingsModal, setReceiptSettingsModal] = useState<boolean>(false);
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm'>('58mm');
  const [isPrintingBt, setIsPrintingBt] = useState<boolean>(false);
  const [storeInfo, setStoreInfo] = useState<any>({
    name: 'KASIRPINTAR PRO',
    address: 'Sistem Kasir Grosir & Eceran',
    phone: '0812-3456-7890',
    footerNote: 'Terima kasih atas kunjungan Anda! Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.'
  });

  // --- STATE KASIR (POS) ---
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [defaultAddMode, setDefaultAddMode] = useState<string>('auto'); // 'auto' | 'retail' | 'wholesale' | 'reseller'
  const [cart, setCart] = useState<any[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [showDiscountInput, setShowDiscountInput] = useState<boolean>(false);
  const [discountType, setDiscountType] = useState<'rp' | 'percent'>('rp');
  const [discountValue, setDiscountValue] = useState<any>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Tunai'); // 'Tunai' | 'QRIS' | 'Transfer'
  const [cashReceived, setCashReceived] = useState<any>('');
  const [showReceiptModal, setShowReceiptModal] = useState<any>(null);

  // --- STATE FILTER STOK BARANG (INVENTORY) ---
  const [invSearchQuery, setInvSearchQuery] = useState<string>('');
  const [invCategory, setInvCategory] = useState<string>('Semua');
  const [invStockFilter, setInvStockFilter] = useState<string>('all'); // 'all' | 'low' | 'out'

  // --- STATE FILTER & SORTIR RIWAYAT TRANSAKSI ---
  const [txSearchQuery, setTxSearchQuery] = useState<string>('');
  const [txDateFilter, setTxDateFilter] = useState<string>('all'); // 'all' | 'today' | '7days' | 'month'
  const [txPaymentFilter, setTxPaymentFilter] = useState<string>('Semua');
  const [txSortOrder, setTxSortOrder] = useState<string>('newest'); // 'newest' | 'oldest' | 'highest' | 'lowest'

  // --- STATE MODALS INVENTARIS, HARGA & EDIT RIWAYAT NOTA ---
  const [productModalOpen, setProductModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [quickPriceModal, setQuickPriceModal] = useState<any>(null);
  const [editingTx, setEditingTx] = useState<any>(null);
  const [originalTxItems, setOriginalTxItems] = useState<any[]>([]);
  const [deletingTxConfirm, setDeletingTxConfirm] = useState<any>(null);

  // Form State untuk Tambah/Edit Barang
  const [formData, setFormData] = useState<any>({
    name: '',
    sku: '',
    category: 'Sembako',
    stock: 0,
    unit: 'Pcs',
    costPrice: 0,
    retailPrice: 0,
    wholesalePrice: 0,
    resellerPrice: 0,
    wholesaleMinQty: 10
  });

  // --- FUNGSI NOTIFIKASI ---
  const showToast = (message: string, type: string = 'success') => {
    setNotification({ message, type } as any);
    setTimeout(() => {
      setNotification(null);
    }, 3500);
  };

  // --- 1. AUTENTIKASI FIREBASE ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof (window as any).__initial_auth_token !== 'undefined' && (window as any).__initial_auth_token) {
          await signInWithCustomToken(auth, (window as any).__initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error('Auth error:', err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // --- 2. LISTEN DATA REALTIME DARI CLOUD (MULTI-DEVICE) ---
  useEffect(() => {
    setIsSyncing(true);
    const productsRef = collection(db, 'artifacts', appId, 'public', 'data', 'products');
    const transactionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
    const storeConfigRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'receipt_config');

    const unsubStoreConfig = onSnapshot(
      storeConfigRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setStoreInfo((prev: any) => ({ ...prev, ...data }));
          if (data.paperSize) setPaperSize(data.paperSize);
        }
      },
      (err) => console.error('Error listening store config:', err)
    );

    const unsubProducts = onSnapshot(
      productsRef,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any)
        }));
        items.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
        setProducts(items as any);
        setIsSyncing(false);
      },
      (error) => {
        console.error('Error listening products:', error);
        setIsSyncing(false);
      }
    );

    const unsubTransactions = onSnapshot(
      transactionsRef,
      (snapshot) => {
        const trans = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any)
        }));
        trans.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
        setTransactions(trans as any);
      },
      (error) => {
        console.error('Error listening transactions:', error);
      }
    );

    return () => {
      unsubStoreConfig();
      unsubProducts();
      unsubTransactions();
    };
  }, [user]);

  // --- SIMPAN PENGATURAN NOTA KE CLOUD ---
  const handleSaveReceiptSettings = async (e: any) => {
    e.preventDefault();
    try {
      const storeConfigRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'receipt_config');
      await setDoc(storeConfigRef, {
        ...storeInfo,
        paperSize,
        updatedAt: Date.now()
      }, { merge: true });
      setReceiptSettingsModal(false);
      showToast('Pengaturan nota berhasil disimpan!');
    } catch (err) {
      console.error(err);
      setReceiptSettingsModal(false);
      showToast('Pengaturan diterapkan secara lokal!');
    }
  };

  // =========================================================================
  // GENERATOR TEKS STRUK MURNI (ESC/POS CONTINUOUS ROLL - TANPA PUTUS HALAMAN)
  // =========================================================================
  // 58mm = 32 karakter per baris | 80mm = 48 karakter per baris
  const buildEscPosText = (tx: any, includeEscCommands: boolean = true) => {
    const maxChars = paperSize === '58mm' ? 32 : 48;
    const divider = '-'.repeat(maxChars);
    const doubleDivider = '='.repeat(maxChars);

    // Helper meratakan teks kiri & kanan dalam 1 baris
    const formatLeftRight = (left: string, right: string) => {
      const cleanLeft = String(left || '');
      const cleanRight = String(right || '');
      const spaceCount = maxChars - cleanLeft.length - cleanRight.length;
      if (spaceCount >= 1) {
        return cleanLeft + ' '.repeat(spaceCount) + cleanRight;
      }
      // Jika kepanjangan, potong bagian kiri agar harga kanan tetap utuh
      const maxLeft = Math.max(1, maxChars - cleanRight.length - 1);
      return cleanLeft.slice(0, maxLeft) + ' ' + cleanRight;
    };

    // Helper meratakan teks ke tengah (Center) dengan word-wrap otomatis
    const formatCenter = (text: string) => {
      const clean = String(text || '').trim();
      if (!clean) return '';
      const words = clean.split(' ');
      const lines: string[] = [];
      let currentLine = '';

      words.forEach((word) => {
        if ((currentLine + (currentLine ? ' ' : '') + word).length <= maxChars) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      });
      if (currentLine) lines.push(currentLine);

      return lines
        .map((line) => {
          const padLeft = Math.max(0, Math.floor((maxChars - line.length) / 2));
          return ' '.repeat(padLeft) + line;
        })
        .join('\n');
    };

    const ESC = '\x1B';
    const GS = '\x1D';
    let out = '';

    if (includeEscCommands) {
      out += ESC + '@'; // Inisialisasi/Reset Printer Thermal
    }

    // HEADER TOKO
    out += formatCenter((storeInfo.name || 'KASIRPINTAR PRO').toUpperCase()) + '\n';
    if (storeInfo.address) out += formatCenter(storeInfo.address) + '\n';
    if (storeInfo.phone) out += formatCenter(`Telp: ${storeInfo.phone}`) + '\n';
    out += divider + '\n';

    // INFO TRANSAKSI
    out += formatLeftRight('No Nota:', tx.invoiceNumber) + '\n';
    out += formatLeftRight('Tanggal:', new Date(tx.timestamp).toLocaleString('id-ID')) + '\n';
    out += formatLeftRight('Kasir:', `#${tx.cashierDevice || 'POS'}`) + '\n';
    if (tx.customerName) {
      out += formatLeftRight('Pelanggan:', tx.customerName) + '\n';
    }
    out += divider + '\n';

    // DAFTAR BARANG (OTOMATIS MEMANJANG SEBANYAK APAPUN BELANJAANNYA)
    (tx.items || []).forEach((item: any) => {
      out += `${item.name}\n`;
      const qtyLine = `${item.qty} ${item.unit} x ${formatNum(item.price)}`;
      const subLine = formatNum(item.subtotal);
      out += formatLeftRight(qtyLine, subLine) + '\n';
    });

    out += divider + '\n';

    // RINGKASAN PEMBAYARAN
    if (tx.wholesaleSavings > 0) {
      out += formatLeftRight('Hemat Grosir:', `-${formatRp(tx.wholesaleSavings)}`) + '\n';
    }
    if (tx.discount > 0) {
      out += formatLeftRight('Diskon:', `-${formatRp(tx.discount)}`) + '\n';
    }

    out += doubleDivider + '\n';
    out += formatLeftRight('TOTAL:', formatRp(tx.grandTotal)) + '\n';
    out += doubleDivider + '\n';
    out += formatLeftRight(`Bayar (${tx.paymentMethod}):`, formatRp(tx.cashReceived)) + '\n';
    out += formatLeftRight('Kembali:', formatRp(tx.change)) + '\n';
    out += divider + '\n';

    // FOOTER
    out += formatCenter(storeInfo.footerNote || 'Terima kasih atas kunjungan Anda!') + '\n';
    out += '\n\n\n'; // Spasi gulungan kertas akhir supaya mudah disobek

    if (includeEscCommands) {
      out += GS + 'V' + '\x41' + '\x03'; // Perintah Auto-Cut (bagi printer 80mm yang punya pisau otomatis)
    }

    return out;
  };

  // --- 1. CETAK INSTAN HP ANDROID VIA RAWBT (CONTINUOUS ROLL TANPA DIALOG PDF) ---
  const handlePrintRawBT = (tx: any) => {
    if (!tx) return;
    try {
      const escPosData = buildEscPosText(tx, true);
      // Encode UTF-8 ke Base64 agar dikirim langsung ke aplikasi RawBT Android
      const base64Data = window.btoa(unescape(encodeURIComponent(escPosData)));
      window.location.href = `rawbt:base64,${base64Data}`;
      showToast('Mengirim struk memanjang otomatis ke RawBT...');
    } catch (err) {
      console.error('RawBT error:', err);
      showToast('Gagal membuka RawBT. Pastikan aplikasi RawBT terinstal di HP.', 'error');
    }
  };

  // --- 2. CETAK LANGSUNG WEB BLUETOOTH (CHROME ANDROID / PC KE PRINTER THERMAL) ---
  const handlePrintWebBluetooth = async (tx: any) => {
    if (!tx) return;
    const nav = navigator as any;
    if (!nav.bluetooth) {
      showToast('Browser ini belum mendukung Web Bluetooth. Gunakan Google Chrome di HP Android atau tombol RawBT.', 'error');
      return;
    }

    setIsPrintingBt(true);
    try {
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455'
        ]
      });

      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();
      let writableChar: any = null;

      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            writableChar = char;
            break;
          }
        }
        if (writableChar) break;
      }

      if (!writableChar) {
        throw new Error(' Karakteristik tulis printer tidak ditemukan.');
      }

      const escPosString = buildEscPosText(tx, true);
      const encoder = new TextEncoder();
      const bytes = encoder.encode(escPosString);

      // Kirim bertahap per 100 byte agar buffer printer Bluetooth tidak penuh meskipun struk sangat panjang
      const chunkSize = 100;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        if (writableChar.properties.writeWithoutResponse) {
          await writableChar.writeValueWithoutResponse(chunk);
        } else {
          await writableChar.writeValue(chunk);
        }
        await new Promise((res) => setTimeout(res, 20));
      }

      showToast('Struk berhasil dicetak via Bluetooth!');
    } catch (err: any) {
      console.error('Bluetooth print error:', err);
      if (err?.name !== 'NotFoundError') {
        showToast('Gagal cetak Bluetooth. Gunakan tombol RawBT untuk hasil paling stabil di HP.', 'error');
      }
    } finally {
      setIsPrintingBt(false);
    }
  };

  // --- 3. CETAK BROWSER / PC DENGAN UKURAN TINGGI DINAMIS MENGIKUTI JUMLAH BARANG ---
  const handlePrintReceipt = (tx: any) => {
    if (!tx) return;
    const widthCss = paperSize === '58mm' ? '58mm' : '80mm';
    const itemsHtml = (tx.items || [])
      .map(
        (item: any) => `
        <div class="item-row">
          <div class="item-name">${item.name}</div>
          <div class="item-calc">
            <span>${item.qty} ${item.unit} x ${formatNum(item.price)}</span>
            <span class="bold">${formatNum(item.subtotal)}</span>
          </div>
        </div>
      `
      )
      .join('');

    const savingsHtml =
      tx.wholesaleSavings > 0
        ? `<div class="summary-row"><span>Hemat Grosir:</span><span>-${formatRp(tx.wholesaleSavings)}</span></div>`
        : '';

    const discountHtml =
      tx.discount > 0
        ? `<div class="summary-row"><span>Diskon:</span><span>-${formatRp(tx.discount)}</span></div>`
        : '';

    const printWindow = window.open('', '_blank', 'width=400,height=650');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cetak Nota - ${tx.invoiceNumber}</title>
        <style>
          @page {
            size: ${widthCss} auto;
            margin: 0mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
          }
          html, body {
            font-family: 'Courier New', Courier, monospace;
            width: ${widthCss};
            height: auto;
            margin: 0;
            padding: 3mm 2mm;
            color: #000;
            background: #fff;
            font-size: ${paperSize === '58mm' ? '11px' : '12px'};
            line-height: 1.35;
          }
          .text-center { text-align: center; }
          .bold { font-weight: bold; }
          .header-title { font-size: ${paperSize === '58mm' ? '14px' : '16px'}; font-weight: 800; text-transform: uppercase; margin-bottom: 2px; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .item-row { margin-bottom: 5px; page-break-inside: avoid; }
          .item-name { font-weight: bold; word-wrap: break-word; }
          .item-calc { display: flex; justify-content: space-between; font-size: ${paperSize === '58mm' ? '10px' : '11px'}; }
          .summary-row { display: flex; justify-content: space-between; margin: 2px 0; }
          .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: ${paperSize === '58mm' ? '13px' : '14px'}; margin: 4px 0; }
          .footer { text-align: center; margin-top: 10px; padding-bottom: 8mm; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="header-title">${storeInfo.name || 'KASIRPINTAR PRO'}</div>
          <div>${storeInfo.address || ''}</div>
          ${storeInfo.phone ? `<div>Telp: ${storeInfo.phone}</div>` : ''}
        </div>
        <div class="divider"></div>
        <div>
          <div>No: <b>${tx.invoiceNumber}</b></div>
          <div>Tgl: ${new Date(tx.timestamp).toLocaleString('id-ID')}</div>
          <div>Kasir: #${tx.cashierDevice || 'POS'}</div>
          ${tx.customerName ? `<div>Pelanggan: <b>${tx.customerName}</b></div>` : ''}
        </div>
        <div class="divider"></div>
        <div>${itemsHtml}</div>
        <div class="divider"></div>
        <div>
          ${savingsHtml}
          ${discountHtml}
          <div class="total-row">
            <span>TOTAL:</span>
            <span>${formatRp(tx.grandTotal)}</span>
          </div>
          <div class="summary-row">
            <span>Bayar (${tx.paymentMethod}):</span>
            <span>${formatRp(tx.cashReceived)}</span>
          </div>
          <div class="summary-row bold">
            <span>Kembali:</span>
            <span>${formatRp(tx.change)}</span>
          </div>
        </div>
        <div class="divider"></div>
        <div class="footer">${storeInfo.footerNote || 'Terima kasih atas kunjungan Anda!'}</div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
              window.close();
            }, 250);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // --- MUAT CONTOH BARANG BILA KOSONG ---
  const seedSampleProducts = async () => {
    setIsSyncing(true);
    try {
      const productsRef = collection(db, 'artifacts', appId, 'public', 'data', 'products');
      for (const item of SAMPLE_PRODUCTS) {
        await addDoc(productsRef, {
          ...item,
          updatedAt: Date.now()
        });
      }
      showToast('Data produk contoh berhasil dimuat ke Cloud!');
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat contoh barang. Pastikan Rules Firestore sudah diatur ke Test Mode.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // --- KATEGORI UNIK ---
  const categories = useMemo(() => {
    const cats = new Set(products.map((p: any) => p.category || 'Lainnya'));
    return ['Semua', ...Array.from(cats)];
  }, [products]);

  // --- FILTER PRODUK DI KASIR (POS) ---
  const filteredProducts = useMemo(() => {
    return products.filter((p: any) => {
      const matchCat = selectedCategory === 'Semua' || p.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        (p.name || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // --- FILTER PRODUK DI TAB STOK BARANG (INVENTORY) ---
  const filteredInventoryProducts = useMemo(() => {
    return products.filter((p: any) => {
      const matchCat = invCategory === 'Semua' || p.category === invCategory;
      const q = invSearchQuery.toLowerCase();
      const matchSearch =
        (p.name || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q);
      const stockNum = Number(p.stock) || 0;
      const matchStock =
        invStockFilter === 'all'
          ? true
          : invStockFilter === 'out'
          ? stockNum <= 0
          : stockNum > 0 && stockNum <= 10;
      return matchCat && matchSearch && matchStock;
    });
  }, [products, invCategory, invSearchQuery, invStockFilter]);

  // --- FILTER & URUTAN WAKTU RIWAYAT TRANSAKSI ---
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOf7Days = startOfToday - 7 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const list = transactions.filter((tx: any) => {
      const ts = Number(tx.timestamp) || 0;
      const matchDate =
        txDateFilter === 'all'
          ? true
          : txDateFilter === 'today'
          ? ts >= startOfToday
          : txDateFilter === '7days'
          ? ts >= startOf7Days
          : ts >= startOfMonth;

      const matchPay = txPaymentFilter === 'Semua' || tx.paymentMethod === txPaymentFilter;

      const q = txSearchQuery.toLowerCase().trim();
      if (!q) return matchDate && matchPay;

      const matchInv = (tx.invoiceNumber || '').toLowerCase().includes(q);
      const matchCust = (tx.customerName || '').toLowerCase().includes(q);
      const matchItem = (tx.items || []).some((i: any) =>
        (i.name || '').toLowerCase().includes(q)
      );

      return matchDate && matchPay && (matchInv || matchCust || matchItem);
    });

    list.sort((a: any, b: any) => {
      if (txSortOrder === 'oldest') return (a.timestamp || 0) - (b.timestamp || 0);
      if (txSortOrder === 'highest') return (Number(b.grandTotal) || 0) - (Number(a.grandTotal) || 0);
      if (txSortOrder === 'lowest') return (Number(a.grandTotal) || 0) - (Number(b.grandTotal) || 0);
      return (b.timestamp || 0) - (a.timestamp || 0);
    });

    return list;
  }, [transactions, txDateFilter, txPaymentFilter, txSearchQuery, txSortOrder]);

  // Helper mendapatkan harga berdasarkan tier ('retail' | 'wholesale' | 'reseller')
  const getTierPrice = (prod: any, tierName: string) => {
    const retail = Number(prod.retailPrice) || 0;
    const wholesale = Number(prod.wholesalePrice) || retail;
    const reseller = Number(prod.resellerPrice) || wholesale || retail;
    if (tierName === 'reseller') return reseller;
    if (tierName === 'wholesale') return wholesale;
    return retail;
  };

  // --- LOGIKA KERANJANG (POS) ECER / GROSIR / RESELLER ---
  const addToCart = (product: any, forcedTier: any = null) => {
    if (product.stock <= 0) {
      showToast(`Stok ${product.name} habis!`, 'error');
      return;
    }

    const modeToUse = forcedTier || defaultAddMode;

    setCart((prevCart: any[]) => {
      const existingIndex = prevCart.findIndex((item) => item.productId === product.id);
      const minGrosir = Number(product.wholesaleMinQty) || 10;
      const resellerPriceVal =
        Number(product.resellerPrice) || Number(product.wholesalePrice) || Number(product.retailPrice);

      if (existingIndex > -1) {
        const existing = prevCart[existingIndex];
        let addQty = 1;
        if (forcedTier === 'wholesale_pack') {
          addQty = minGrosir;
        }

        const newQty = existing.qty + addQty;
        if (newQty > product.stock) {
          showToast(`Stok tidak cukup! Sisa stok: ${product.stock} ${product.unit}`, 'error');
          return prevCart;
        }

        let newTier = existing.tier;
        if (forcedTier === 'reseller') {
          newTier = 'reseller';
        } else if (forcedTier === 'wholesale' || forcedTier === 'wholesale_pack') {
          newTier = 'wholesale';
        } else if (forcedTier === 'retail') {
          newTier = 'retail';
        } else if (!existing.manualOverride) {
          newTier = newQty >= minGrosir ? 'wholesale' : 'retail';
        }

        const activePrice = getTierPrice(product, newTier);

        const updated = [...prevCart];
        updated[existingIndex] = {
          ...existing,
          qty: newQty,
          tier: newTier,
          activePrice,
          manualOverride: forcedTier ? true : existing.manualOverride
        };
        return updated;
      } else {
        let initialQty = 1;
        let initialTier = 'retail';
        let isManual = false;

        if (modeToUse === 'wholesale_pack') {
          initialQty = Math.min(minGrosir, product.stock);
          initialTier = 'wholesale';
          isManual = true;
        } else if (modeToUse === 'reseller') {
          initialQty = 1;
          initialTier = 'reseller';
          isManual = true;
        } else if (modeToUse === 'wholesale') {
          initialQty = 1;
          initialTier = 'wholesale';
          isManual = true;
        } else if (modeToUse === 'retail') {
          initialQty = 1;
          initialTier = 'retail';
          isManual = true;
        } else {
          initialQty = 1;
          initialTier = initialQty >= minGrosir ? 'wholesale' : 'retail';
        }

        const activePrice = getTierPrice(product, initialTier);

        return [
          ...prevCart,
          {
            productId: product.id,
            name: product.name,
            sku: product.sku,
            unit: product.unit || 'Pcs',
            qty: initialQty,
            retailPrice: Number(product.retailPrice),
            wholesalePrice: Number(product.wholesalePrice),
            resellerPrice: resellerPriceVal,
            wholesaleMinQty: minGrosir,
            maxStock: Number(product.stock),
            tier: initialTier,
            manualOverride: isManual,
            activePrice,
            customPrice: null
          }
        ];
      }
    });
  };

  // Ubah Kuantitas di Keranjang
  const updateCartQty = (productId: string, newQtyValue: any) => {
    const parsed = parseInt(newQtyValue, 10);
    if (isNaN(parsed) || parsed <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const validQty = Math.min(parsed, item.maxStock);
        if (parsed > item.maxStock) {
          showToast(`Maksimal stok tersedia: ${item.maxStock} ${item.unit}`, 'error');
        }

        let nextTier = item.tier;
        if (!item.manualOverride) {
          nextTier = validQty >= item.wholesaleMinQty ? 'wholesale' : 'retail';
        }

        const nextPrice =
          item.customPrice !== null
            ? item.customPrice
            : nextTier === 'reseller'
            ? item.resellerPrice || item.wholesalePrice || item.retailPrice
            : nextTier === 'wholesale'
            ? item.wholesalePrice
            : item.retailPrice;

        return {
          ...item,
          qty: validQty,
          tier: nextTier,
          activePrice: nextPrice
        };
      })
    );
  };

  // Ganti Mode Harga per Item (Ecer vs Grosir vs Reseller)
  const switchCartItemTier = (productId: string, targetTier: string, setMinWholesaleQty: boolean = false) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;

        let newQty = item.qty;
        if (setMinWholesaleQty && newQty < item.wholesaleMinQty) {
          newQty = Math.min(item.wholesaleMinQty, item.maxStock);
        }

        const nextPrice =
          targetTier === 'reseller'
            ? item.resellerPrice || item.wholesalePrice || item.retailPrice
            : targetTier === 'wholesale'
            ? item.wholesalePrice
            : item.retailPrice;

        return {
          ...item,
          qty: newQty,
          tier: targetTier,
          manualOverride: true,
          customPrice: null,
          activePrice: nextPrice
        };
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  // --- KALKULASI TOTAL TRANSAKSI ---
  const cartSummary = useMemo(() => {
    const subtotalRetail = cart.reduce((acc, item) => acc + item.retailPrice * item.qty, 0);
    const subtotalActual = cart.reduce((acc, item) => acc + item.activePrice * item.qty, 0);
    const wholesaleSavings = Math.max(0, subtotalRetail - subtotalActual);

    let rawDiscount = 0;
    if (showDiscountInput) {
      const val = Number(discountValue) || 0;
      if (discountType === 'percent') {
        rawDiscount = Math.round((subtotalActual * Math.min(100, Math.max(0, val))) / 100);
      } else {
        rawDiscount = Math.max(0, val);
      }
    }

    const validDiscount = Math.min(rawDiscount, subtotalActual);
    const grandTotal = Math.max(0, subtotalActual - validDiscount);
    const totalItems = cart.reduce((acc, item) => acc + item.qty, 0);

    return {
      subtotalRetail,
      subtotalActual,
      wholesaleSavings,
      validDiscount,
      grandTotal,
      totalItems
    };
  }, [cart, showDiscountInput, discountType, discountValue]);

  const changeAmount = useMemo(() => {
    const cash = Number(cashReceived) || 0;
    return cash - cartSummary.grandTotal;
  }, [cashReceived, cartSummary.grandTotal]);

  // --- PROSES BAYAR (CHECKOUT) & UPDATE STOK CLOUD ---
  const handleCheckout = async () => {
    if (cart.length === 0) {
      showToast('Keranjang masih kosong!', 'error');
      return;
    }

    const cashNum = Number(cashReceived) || 0;
    if (paymentMethod === 'Tunai' && cashNum < cartSummary.grandTotal) {
      showToast('Uang tunai yang diterima kurang dari total belanja!', 'error');
      return;
    }

    try {
      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
      const txData = {
        invoiceNumber,
        timestamp: Date.now(),
        cashierDevice: user ? user.uid.slice(0, 6).toUpperCase() : 'POS-01',
        customerName: customerName.trim() || '',
        items: cart.map((i) => ({
          productId: i.productId,
          name: i.name,
          qty: i.qty,
          unit: i.unit,
          tier: i.tier,
          price: i.activePrice,
          subtotal: i.activePrice * i.qty
        })),
        subtotal: cartSummary.subtotalActual,
        wholesaleSavings: cartSummary.wholesaleSavings,
        discount: cartSummary.validDiscount,
        grandTotal: cartSummary.grandTotal,
        paymentMethod,
        cashReceived: paymentMethod === 'Tunai' ? cashNum : cartSummary.grandTotal,
        change: paymentMethod === 'Tunai' ? Math.max(0, cashNum - cartSummary.grandTotal) : 0
      };

      const txRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
      await addDoc(txRef, txData);

      for (const item of cart) {
        const prodDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'products', item.productId);
        const currentProd = products.find((p) => p.id === item.productId);
        if (currentProd) {
          const updatedStock = Math.max(0, Number(currentProd.stock) - item.qty);
          await updateDoc(prodDocRef, {
            stock: updatedStock,
            updatedAt: Date.now()
          });
        }
      }

      setShowReceiptModal(txData);
      setCart([]);
      setCustomerName('');
      setShowDiscountInput(false);
      setDiscountValue('');
      setCashReceived('');
      showToast('Transaksi berhasil disimpan & siap cetak nota!');
    } catch (err) {
      console.error('Checkout error:', err);
      showToast('Gagal menyimpan transaksi ke Cloud. Cek Rules Firestore.', 'error');
    }
  };

  // --- FITUR EDIT & HAPUS RIWAYAT NOTA ---
  const openEditTxModal = (tx: any) => {
    const clonedItems = (tx.items || []).map((i: any) => ({ ...i }));
    setOriginalTxItems((tx.items || []).map((i: any) => ({ ...i })));
    setEditingTx({
      ...tx,
      customerName: tx.customerName || '',
      items: clonedItems,
      discount: Number(tx.discount) || 0,
      cashReceived: Number(tx.cashReceived) || 0,
      paymentMethod: tx.paymentMethod || 'Tunai'
    });
  };

  const handleEditTxItemChange = (idx: number, field: string, val: any) => {
    if (!editingTx) return;
    const updatedItems = [...editingTx.items];
    const current = { ...updatedItems[idx] };

    if (field === 'qty') {
      current.qty = Math.max(1, parseInt(val, 10) || 1);
    } else if (field === 'price') {
      current.price = Math.max(0, Number(val) || 0);
    } else if (field === 'name') {
      current.name = val;
    } else if (field === 'tier') {
      current.tier = val;
    }

    current.subtotal = current.qty * current.price;
    updatedItems[idx] = current;
    setEditingTx({ ...editingTx, items: updatedItems });
  };

  const handleRemoveEditTxItem = (idx: number) => {
    if (!editingTx) return;
    const updatedItems = editingTx.items.filter((_: any, i: number) => i !== idx);
    setEditingTx({ ...editingTx, items: updatedItems });
  };

  const handleSaveEditedTx = async (e: any) => {
    e.preventDefault();
    if (!editingTx) return;

    if (editingTx.items.length === 0) {
      showToast('Nota harus memiliki minimal 1 barang, atau gunakan tombol Hapus Nota.', 'error');
      return;
    }

    const newSubtotal = editingTx.items.reduce(
      (acc: number, item: any) => acc + Number(item.price) * Number(item.qty),
      0
    );
    const newDiscount = Math.min(Math.max(0, Number(editingTx.discount) || 0), newSubtotal);
    const newGrandTotal = Math.max(0, newSubtotal - newDiscount);
    const newCash =
      editingTx.paymentMethod === 'Tunai'
        ? Math.max(newGrandTotal, Number(editingTx.cashReceived) || newGrandTotal)
        : newGrandTotal;
    const newChange = editingTx.paymentMethod === 'Tunai' ? Math.max(0, newCash - newGrandTotal) : 0;

    try {
      const txDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'transactions', editingTx.id);
      const updatedPayload = {
        customerName: (editingTx.customerName || '').trim(),
        items: editingTx.items,
        subtotal: newSubtotal,
        discount: newDiscount,
        grandTotal: newGrandTotal,
        paymentMethod: editingTx.paymentMethod,
        cashReceived: newCash,
        change: newChange,
        updatedAt: Date.now()
      };

      await updateDoc(txDocRef, updatedPayload);

      // Sesuaikan stok barang berdasarkan selisih jumlah lama dan jumlah baru
      const allProductIds = new Set([
        ...originalTxItems.map((i: any) => i.productId),
        ...editingTx.items.map((i: any) => i.productId)
      ]);

      for (const pid of Array.from(allProductIds)) {
        if (!pid) continue;
        const oldItem = originalTxItems.find((i: any) => i.productId === pid);
        const newItem = editingTx.items.find((i: any) => i.productId === pid);
        const oldQty = oldItem ? Number(oldItem.qty) : 0;
        const newQty = newItem ? Number(newItem.qty) : 0;
        const diffQty = newQty - oldQty; // Positif = stok berkurang lagi, Negatif = stok dikembalikan

        if (diffQty !== 0) {
          const prod = products.find((p: any) => p.id === pid);
          if (prod) {
            const prodRef = doc(db, 'artifacts', appId, 'public', 'data', 'products', pid);
            await updateDoc(prodRef, {
              stock: Math.max(0, Number(prod.stock) - diffQty),
              updatedAt: Date.now()
            });
          }
        }
      }

      setEditingTx(null);
      showToast(`Nota ${editingTx.invoiceNumber} berhasil diperbarui & stok disesuaikan!`);
    } catch (err) {
      console.error('Error updating transaction:', err);
      showToast('Gagal memperbarui riwayat nota', 'error');
    }
  };

  const handleDeleteTransaction = async (tx: any, restoreStock: boolean = true) => {
    if (!tx) return;
    try {
      if (restoreStock && tx.items) {
        for (const item of tx.items) {
          if (!item.productId) continue;
          const prod = products.find((p: any) => p.id === item.productId);
          if (prod) {
            const prodRef = doc(db, 'artifacts', appId, 'public', 'data', 'products', item.productId);
            await updateDoc(prodRef, {
              stock: Number(prod.stock) + Number(item.qty),
              updatedAt: Date.now()
            });
          }
        }
      }

      const txDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'transactions', tx.id);
      await deleteDoc(txDocRef);
      setDeletingTxConfirm(null);
      if (editingTx && editingTx.id === tx.id) setEditingTx(null);
      showToast(
        restoreStock
          ? `Nota ${tx.invoiceNumber} dihapus & stok barang dikembalikan!`
          : `Nota ${tx.invoiceNumber} berhasil dihapus!`
      );
    } catch (err) {
      console.error('Error deleting transaction:', err);
      showToast('Gagal menghapus riwayat nota', 'error');
    }
  };

  // --- MANAJEMEN BARANG: TAMBAH & EDIT HARGA ---
  const openAddProductModal = () => {
    setEditingProduct(null);
    const nextNumber = products.length + 1;
    setFormData({
      name: '',
      sku: `BRG-00${nextNumber}`,
      category: 'Sembako',
      stock: 50,
      unit: 'Pcs',
      costPrice: 0,
      retailPrice: 0,
      wholesalePrice: 0,
      resellerPrice: 0,
      wholesaleMinQty: 10
    });
    setProductModalOpen(true);
  };

  const openEditProductModal = (product: any) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      sku: product.sku || '',
      category: product.category || 'Sembako',
      stock: Number(product.stock) || 0,
      unit: product.unit || 'Pcs',
      costPrice: Number(product.costPrice) || 0,
      retailPrice: Number(product.retailPrice) || 0,
      wholesalePrice: Number(product.wholesalePrice) || 0,
      resellerPrice: Number(product.resellerPrice) || Number(product.wholesalePrice) || 0,
      wholesaleMinQty: Number(product.wholesaleMinQty) || 10
    });
    setProductModalOpen(true);
  };

  const handleSaveProduct = async (e: any) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Nama barang wajib diisi!', 'error');
      return;
    }

    const retailVal = Number(formData.retailPrice) || 0;
    const wholesaleVal = Number(formData.wholesalePrice) || retailVal;
    const resellerVal = Number(formData.resellerPrice) || wholesaleVal || retailVal;

    const payload = {
      name: formData.name.trim(),
      sku: formData.sku.trim() || `BRG-${Date.now().toString().slice(-4)}`,
      category: formData.category.trim() || 'Umum',
      stock: Number(formData.stock) || 0,
      unit: formData.unit.trim() || 'Pcs',
      costPrice: Number(formData.costPrice) || 0,
      retailPrice: retailVal,
      wholesalePrice: wholesaleVal,
      resellerPrice: resellerVal,
      wholesaleMinQty: Math.max(1, Number(formData.wholesaleMinQty) || 1),
      updatedAt: Date.now()
    };

    try {
      if (editingProduct) {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'products', editingProduct.id);
        await updateDoc(docRef, payload);
        showToast(`Data & harga "${payload.name}" berhasil diperbarui!`);
      } else {
        const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'products');
        await addDoc(colRef, payload);
        showToast(`Barang baru "${payload.name}" berhasil ditambahkan!`);
      }

      if (editingProduct) {
        setCart((prev) =>
          prev.map((item) => {
            if (item.productId !== editingProduct.id) return item;
            const nextActive =
              item.tier === 'reseller'
                ? payload.resellerPrice
                : item.tier === 'wholesale'
                ? payload.wholesalePrice
                : payload.retailPrice;
            return {
              ...item,
              name: payload.name,
              unit: payload.unit,
              retailPrice: payload.retailPrice,
              wholesalePrice: payload.wholesalePrice,
              resellerPrice: payload.resellerPrice,
              wholesaleMinQty: payload.wholesaleMinQty,
              maxStock: payload.stock,
              activePrice: nextActive
            };
          })
        );
      }

      setProductModalOpen(false);
    } catch (err) {
      console.error('Error saving product:', err);
      showToast(`Gagal menyimpan ke Cloud: Pastikan Firestore Database sudah dibuat & Rules diizinkan`, 'error');
    }
  };

  // --- FITUR EDIT HARGA CEPAT ---
  const handleSaveQuickPrice = async (e: any) => {
    e.preventDefault();
    if (!quickPriceModal) return;

    const newRetail = Number(quickPriceModal.retailPrice) || 0;
    const newWholesale = Number(quickPriceModal.wholesalePrice) || newRetail;
    const newReseller = Number(quickPriceModal.resellerPrice) || newWholesale || newRetail;
    const newMinQty = Math.max(1, Number(quickPriceModal.wholesaleMinQty) || 1);

    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'products', quickPriceModal.id);
      await updateDoc(docRef, {
        retailPrice: newRetail,
        wholesalePrice: newWholesale,
        resellerPrice: newReseller,
        wholesaleMinQty: newMinQty,
        updatedAt: Date.now()
      });

      setCart((prev) =>
        prev.map((item) => {
          if (item.productId !== quickPriceModal.id) return item;
          return {
            ...item,
            retailPrice: newRetail,
            wholesalePrice: newWholesale,
            resellerPrice: newReseller,
            wholesaleMinQty: newMinQty,
            activePrice:
              item.tier === 'reseller'
                ? newReseller
                : item.tier === 'wholesale'
                ? newWholesale
                : newRetail
          };
        })
      );

      showToast(`Harga ${quickPriceModal.name} berhasil diubah!`);
      setQuickPriceModal(null);
    } catch (err) {
      console.error('Error updating price:', err);
      showToast('Gagal mengubah harga', 'error');
    }
  };

  const handleDeleteProduct = async (product: any) => {
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'products', product.id);
      await deleteDoc(docRef);
      removeFromCart(product.id);
      showToast(`Barang "${product.name}" dihapus.`);
    } catch (err) {
      console.error(err);
      showToast('Gagal menghapus barang', 'error');
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* CSS FALLBACK CETAK NOTA LANGSUNG */}
      <style>{`
        @media print {
          @page {
            size: ${paperSize === '58mm' ? '58mm' : '80mm'} auto;
            margin: 0mm;
          }
          body * {
            visibility: hidden;
          }
          #printable-receipt-area, #printable-receipt-area * {
            visibility: visible;
          }
          #printable-receipt-area {
            position: absolute;
            left: 0;
            top: 0;
            width: ${paperSize === '58mm' ? '58mm' : '80mm'};
            padding: 2mm;
            margin: 0;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* TOAST NOTIFIKASI */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md transition-all bg-slate-900/95 border-slate-700">
          {notification.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span className="text-sm font-medium text-slate-100">{notification.message}</span>
        </div>
      )}

      {/* HEADER UTAMA & STATUS MULTI-DEVICE (RESPONSIF HP ANTI JEBOL KE SAMPING) */}
      <header className="bg-slate-900/95 border-b border-slate-800 sticky top-0 z-30 backdrop-blur-md w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex flex-col gap-2.5">
          {/* Baris Atas: Brand Toko + Tombol Aksi (Atur Nota, Tambah, ID) */}
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                <Store className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-sm sm:text-lg tracking-tight text-white truncate">
                    {storeInfo.name || 'KasirPintar'} <span className="text-emerald-400">PRO</span>
                  </h1>
                  <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Cloud Multi-Device Aktif
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  Kasir Satuan, Eceran & Grosir
                </p>
              </div>
            </div>

            {/* Tombol Kanan yang Rapi di Layar HP maupun Desktop */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                onClick={() => setReceiptSettingsModal(true)}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold transition-all"
                title="Pengaturan Cetak Nota & Toko"
              >
                <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="hidden sm:inline">Atur Nota</span>
              </button>

              <button
                onClick={openAddProductModal}
                className="flex items-center gap-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold transition-all"
                title="Tambah Barang Baru"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
                <span className="hidden sm:inline">Tambah Barang</span>
              </button>

              <div
                className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400"
                title="ID Sinkronisasi Perangkat"
              >
                <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-mono text-slate-200">
                  {user ? user.uid.slice(0, 5) : 'Ready'}
                </span>
              </div>
            </div>
          </div>

          {/* Baris Navigasi Tab: Full-Width & Proporsional di HP */}
          <nav className="grid grid-cols-3 bg-slate-950 p-1 rounded-xl border border-slate-800 w-full">
            <button
              onClick={() => setActiveTab('pos')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'pos'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">Kasir (POS)</span>
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'inventory'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">Stok ({products.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'transactions'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">Riwayat</span>
            </button>
          </nav>
        </div>
      </header>

      {/* KONTEN UTAMA */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-5">
        {activeTab === 'pos' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4 min-w-0">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col gap-3 shadow-lg">
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1 min-w-0">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari nama barang atau scan kode SKU..."
                      className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-10 pr-9 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={openAddProductModal}
                    className="flex items-center justify-center gap-2 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 border border-emerald-500/30 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Barang Baru</span>
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Mode Klik Barang:</span>
                  </span>
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setDefaultAddMode('auto')}
                      className={`px-2 py-1.5 rounded-lg font-medium text-[11px] sm:text-xs transition-all text-center ${
                        defaultAddMode === 'auto'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-950 text-slate-400 border border-slate-800'
                      }`}
                    >
                      Otomatis
                    </button>
                    <button
                      onClick={() => setDefaultAddMode('retail')}
                      className={`px-2 py-1.5 rounded-lg font-medium text-[11px] sm:text-xs transition-all text-center ${
                        defaultAddMode === 'retail'
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-950 text-slate-400 border border-slate-800'
                      }`}
                    >
                      Selalu Ecer
                    </button>
                    <button
                      onClick={() => setDefaultAddMode('wholesale')}
                      className={`px-2 py-1.5 rounded-lg font-medium text-[11px] sm:text-xs transition-all text-center ${
                        defaultAddMode === 'wholesale'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-950 text-slate-400 border border-slate-800'
                      }`}
                    >
                      Langsung Grosir
                    </button>
                    <button
                      onClick={() => setDefaultAddMode('reseller')}
                      className={`px-2 py-1.5 rounded-lg font-medium text-[11px] sm:text-xs transition-all text-center ${
                        defaultAddMode === 'reseller'
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-950 text-slate-400 border border-slate-800'
                      }`}
                    >
                      Harga Reseller
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-all ${
                        selectedCategory === cat
                          ? 'bg-slate-100 text-slate-900 font-semibold'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {products.length === 0 && !isSyncing ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400">
                    <Box className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Belum Ada Data Barang</h3>
                    <p className="text-xs text-slate-400 max-w-md mt-1">
                      Tambahkan barang baru secara manual atau muat daftar barang sembako contoh untuk langsung mencoba fitur kasir satuan, eceran, dan grosir.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 justify-center">
                    <button
                      onClick={seedSampleProducts}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Muat 6 Barang Contoh
                    </button>
                    <button
                      onClick={openAddProductModal}
                      className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-700 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Tambah Barang Sendiri
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {filteredProducts.map((product) => {
                    const inCartItem = cart.find((c) => c.productId === product.id);
                    const isOutOfStock = Number(product.stock) <= 0;
                    const resellerPriceVal =
                      Number(product.resellerPrice) ||
                      Number(product.wholesalePrice) ||
                      Number(product.retailPrice);

                    return (
                      <div
                        key={product.id}
                        className={`bg-slate-900 border rounded-2xl p-4 flex flex-col justify-between gap-3 transition-all hover:border-slate-700 relative group ${
                          inCartItem
                            ? 'border-emerald-500/60 ring-1 ring-emerald-500/30'
                            : 'border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                              {product.category || 'Umum'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                                  isOutOfStock
                                    ? 'bg-rose-500/20 text-rose-400'
                                    : Number(product.stock) <= 10
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-emerald-500/10 text-emerald-400'
                                }`}
                              >
                                Stok: {product.stock} {product.unit}
                              </span>
                              <button
                                onClick={() =>
                                  setQuickPriceModal({
                                    ...product,
                                    resellerPrice: resellerPriceVal
                                  })
                                }
                                title="Edit Harga Cepat"
                                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <h3 className="font-bold text-sm text-white leading-snug line-clamp-2">
                            {product.name}
                          </h3>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {product.sku}
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-2 rounded-xl border border-slate-800/80">
                          <div>
                            <span className="text-[9px] text-slate-400 block">
                              Eceran
                            </span>
                            <span className="text-xs font-bold text-sky-400">
                              {formatRp(product.retailPrice)}
                            </span>
                            <span className="text-[9px] text-slate-500 block">
                              /{product.unit}
                            </span>
                          </div>
                          <div className="border-l border-slate-800 pl-1.5">
                            <span className="text-[9px] text-amber-400/90 font-medium block">
                              Grosir (≥{product.wholesaleMinQty})
                            </span>
                            <span className="text-xs font-bold text-amber-400">
                              {formatRp(product.wholesalePrice)}
                            </span>
                            <span className="text-[9px] text-slate-500 block">
                              /{product.unit}
                            </span>
                          </div>
                          <div className="border-l border-slate-800 pl-1.5">
                            <span className="text-[9px] text-purple-400 font-medium block">
                              Reseller
                            </span>
                            <span className="text-xs font-bold text-purple-400">
                              {formatRp(resellerPriceVal)}
                            </span>
                            <span className="text-[9px] text-slate-500 block">
                              /{product.unit}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                          <button
                            disabled={isOutOfStock}
                            onClick={() => addToCart(product, 'retail')}
                            className="flex items-center justify-center gap-1 py-2 px-1.5 rounded-xl text-[11px] font-semibold bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 disabled:opacity-40 transition-all"
                          >
                            <Plus className="w-3 h-3 shrink-0" />
                            <span>Ecer</span>
                          </button>

                          <button
                            disabled={isOutOfStock}
                            onClick={() => addToCart(product, 'wholesale_pack')}
                            className="flex items-center justify-center gap-1 py-2 px-1.5 rounded-xl text-[11px] font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 disabled:opacity-40 transition-all"
                            title={`Langsung ambil ${product.wholesaleMinQty} ${product.unit} dengan harga grosir`}
                          >
                            <Layers className="w-3 h-3 shrink-0" />
                            <span>+{product.wholesaleMinQty} Grosir</span>
                          </button>

                          <button
                            disabled={isOutOfStock}
                            onClick={() => addToCart(product, 'reseller')}
                            className="flex items-center justify-center gap-1 py-2 px-1.5 rounded-xl text-[11px] font-semibold bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 disabled:opacity-40 transition-all"
                            title="Tambahkan dengan Harga Khusus Reseller"
                          >
                            <Tag className="w-3 h-3 shrink-0" />
                            <span>Reseller</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="lg:col-span-5 xl:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col lg:sticky lg:top-20 overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex flex-col gap-3 bg-slate-900/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="font-bold text-sm text-white">Keranjang Kasir</h2>
                      <p className="text-[11px] text-slate-400">
                        {cartSummary.totalItems} barang dipilih
                      </p>
                    </div>
                  </div>
                  {cart.length > 0 && (
                    <button
                      onClick={() => setCart([])}
                      className="text-xs text-rose-400 hover:text-rose-300 font-medium px-2.5 py-1 rounded-lg hover:bg-rose-500/10 transition-colors"
                    >
                      Kosongkan
                    </button>
                  )}
                </div>

                {/* INPUT NAMA PELANGGAN (OPSIONAL) */}
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nama Pelanggan / Reseller (Opsional)..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-8 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                  {customerName && (
                    <button
                      type="button"
                      onClick={() => setCustomerName('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 flex-1 max-h-[360px] overflow-y-auto divide-y divide-slate-800/80 space-y-3">
                {cart.length === 0 ? (
                  <div className="py-12 text-center flex flex-col items-center justify-center gap-2 text-slate-500">
                    <ShoppingCart className="w-10 h-10 stroke-[1.5]" />
                    <p className="text-xs">Belum ada barang di keranjang.</p>
                    <p className="text-[11px] text-slate-600">
                      Klik tombol <span className="text-sky-400">+Ecer</span>,{' '}
                      <span className="text-amber-400">+Grosir</span>, atau{' '}
                      <span className="text-purple-400">+Reseller</span> pada produk.
                    </p>
                  </div>
                ) : (
                  cart.map((item) => {
                    const isWholesale = item.tier === 'wholesale';
                    const isReseller = item.tier === 'reseller';
                    return (
                      <div key={item.productId} className="pt-3 first:pt-0 flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-bold text-slate-100 leading-tight">
                              {item.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                                  isReseller
                                    ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                    : isWholesale
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                    : 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                                }`}
                              >
                                {isReseller
                                  ? 'HARGA RESELLER'
                                  : isWholesale
                                  ? 'HARGA GROSIR'
                                  : 'ECER / SATUAN'}
                              </span>
                              <span className="text-xs font-medium text-slate-300">
                                {formatRp(item.activePrice)} /{item.unit}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.productId)}
                            className="text-slate-500 hover:text-rose-400 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800/90">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => switchCartItemTier(item.productId, 'retail')}
                              className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                                !isWholesale && !isReseller
                                  ? 'bg-sky-600 text-white'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              Ecer
                            </button>
                            <button
                              onClick={() => switchCartItemTier(item.productId, 'wholesale', false)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                                isWholesale
                                  ? 'bg-amber-600 text-white'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              Grosir
                            </button>
                            <button
                              onClick={() => switchCartItemTier(item.productId, 'reseller', false)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                                isReseller
                                  ? 'bg-purple-600 text-white'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              Reseller
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => updateCartQty(item.productId, item.qty - 1)}
                              className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center text-xs font-bold"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              max={item.maxStock}
                              value={item.qty}
                              onChange={(e) => updateCartQty(item.productId, e.target.value)}
                              className="w-12 text-center bg-slate-900 border border-slate-700 rounded-lg py-0.5 text-xs font-bold text-white"
                            />
                            <button
                              onClick={() => updateCartQty(item.productId, item.qty + 1)}
                              className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center text-xs font-bold"
                            >
                              +
                            </button>
                          </div>

                          <div className="text-right min-w-[75px]">
                            <span className="text-xs font-bold text-emerald-400 block">
                              {formatRp(item.activePrice * item.qty)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-4 bg-slate-950/90 border-t border-slate-800 space-y-3">
                {cartSummary.wholesaleSavings > 0 && (
                  <div className="flex items-center justify-between text-xs px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
                    <span>Hemat Harga Grosir:</span>
                    <span className="font-bold">-{formatRp(cartSummary.wholesaleSavings)}</span>
                  </div>
                )}

                {/* MENU INPUT DISKON OPSIONAL (RP ATAU PERSEN %) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        if (showDiscountInput) {
                          setShowDiscountInput(false);
                          setDiscountValue('');
                        } else {
                          setShowDiscountInput(true);
                        }
                      }}
                      className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>
                        {showDiscountInput ? 'Tutup Diskon Opsional' : '+ Tambah Diskon (Opsional)'}
                      </span>
                    </button>
                    {cartSummary.validDiscount > 0 && (
                      <span className="text-rose-400 font-bold">
                        -{formatRp(cartSummary.validDiscount)}
                      </span>
                    )}
                  </div>

                  {showDiscountInput && (
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setDiscountType('rp');
                              setDiscountValue('');
                            }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                              discountType === 'rp'
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Rp
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDiscountType('percent');
                              setDiscountValue('');
                            }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-0.5 ${
                              discountType === 'percent'
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <Percent className="w-3 h-3" />
                          </button>
                        </div>

                        <input
                          type="number"
                          min="0"
                          max={discountType === 'percent' ? 100 : undefined}
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                          placeholder={
                            discountType === 'percent' ? 'Diskon % (cth: 10)' : 'Nominal Diskon Rp...'
                          }
                          className="flex-1 text-right bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none min-w-0"
                        />

                        {discountValue && (
                          <button
                            type="button"
                            onClick={() => setDiscountValue('')}
                            className="p-1.5 text-slate-400 hover:text-rose-400"
                            title="Reset Diskon"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Tombol Cepat Pilihan Diskon */}
                      <div className="flex flex-wrap gap-1">
                        {discountType === 'percent'
                          ? [5, 10, 15, 20, 50].map((pct) => (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => setDiscountValue(pct)}
                                className="text-[10px] px-2 py-0.5 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold"
                              >
                                {pct}%
                              </button>
                            ))
                          : [1000, 2000, 5000, 10000].map((nom) => (
                              <button
                                key={nom}
                                type="button"
                                onClick={() => setDiscountValue(nom)}
                                className="text-[10px] px-2 py-0.5 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold"
                              >
                                Potong {formatNum(nom)}
                              </button>
                            ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <span className="text-sm font-semibold text-slate-300">Total Tagihan</span>
                  <span className="text-xl font-extrabold text-emerald-400">
                    {formatRp(cartSummary.grandTotal)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { id: 'Tunai', icon: Banknote },
                    { id: 'QRIS', icon: QrCode },
                    { id: 'Transfer', icon: CreditCard }
                  ].map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id)}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          paymentMethod === m.id
                            ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{m.id}</span>
                      </button>
                    );
                  })}
                </div>

                {paymentMethod === 'Tunai' && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">Uang Tunai:</span>
                      <input
                        type="number"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        placeholder="Masukkan nominal..."
                        className="flex-1 text-right bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-sm font-bold text-white focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCashReceived(cartSummary.grandTotal)}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-emerald-400 font-semibold"
                      >
                        Uang Pas
                      </button>
                      {[20000, 50000, 100000, 200000].map((nom) => (
                        <button
                          key={nom}
                          type="button"
                          onClick={() => setCashReceived(nom)}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300"
                        >
                          {formatRp(nom)}
                        </button>
                      ))}
                    </div>
                    {Number(cashReceived) > 0 && (
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-slate-400">Kembalian:</span>
                        <span
                          className={`font-bold text-sm ${
                            changeAmount >= 0 ? 'text-amber-400' : 'text-rose-400'
                          }`}
                        >
                          {changeAmount >= 0
                            ? formatRp(changeAmount)
                            : `Kurang ${formatRp(Math.abs(changeAmount))}`}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={handleCheckout}
                  disabled={cart.length === 0}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-40 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span>Proses Bayar & Cetak Nota</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Manajemen Barang & Pengaturan Harga Multi-Device
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Atur harga Eceran, Grosir, dan Reseller secara real-time di semua perangkat.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={seedSampleProducts}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-700"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Muat Barang Contoh
                  </button>
                  <button
                    onClick={openAddProductModal}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20"
                  >
                    <Plus className="w-4 h-4" />
                    Tambah Barang Baru
                  </button>
                </div>
              </div>

              {/* SEARCH & FILTER BAR DI TAB STOK BARANG */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 border-t border-slate-800">
                <div className="relative sm:col-span-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={invSearchQuery}
                    onChange={(e) => setInvSearchQuery(e.target.value)}
                    placeholder="Cari nama barang atau SKU di stok..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-10 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                  {invSearchQuery && (
                    <button
                      onClick={() => setInvSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={invCategory}
                    onChange={(e) => setInvCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        Kategori: {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {[
                    { id: 'all', label: 'Semua Stok' },
                    { id: 'low', label: 'Menipis (≤10)' },
                    { id: 'out', label: 'Habis (0)' }
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setInvStockFilter(st.id)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all ${
                        invStockFilter === st.id
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <th className="py-3.5 px-4">Barang & SKU</th>
                      <th className="py-3.5 px-4">Kategori</th>
                      <th className="py-3.5 px-4">Stok & Satuan</th>
                      <th className="py-3.5 px-4">Harga Modal</th>
                      <th className="py-3.5 px-4 text-sky-400">Harga Ecer</th>
                      <th className="py-3.5 px-4 text-amber-400">Harga Grosir</th>
                      <th className="py-3.5 px-4 text-purple-400">Harga Reseller</th>
                      <th className="py-3.5 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-xs">
                    {filteredInventoryProducts.map((p) => {
                      const resellerVal =
                        Number(p.resellerPrice) || Number(p.wholesalePrice) || Number(p.retailPrice);
                      return (
                        <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-100">{p.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{p.sku}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-medium">
                              {p.category}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`font-bold ${
                                p.stock <= 5 ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                            >
                              {p.stock}
                            </span>{' '}
                            <span className="text-slate-400">{p.unit}</span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400">
                            {formatRp(p.costPrice)}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-sky-400">
                            {formatRp(p.retailPrice)}{' '}
                            <span className="text-[10px] font-normal text-slate-500">
                              /{p.unit}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-amber-400">
                              {formatRp(p.wholesalePrice)}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Min. beli {p.wholesaleMinQty} {p.unit}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-purple-400">
                            {formatRp(resellerVal)}{' '}
                            <span className="text-[10px] font-normal text-slate-500">
                              /{p.unit}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() =>
                                  setQuickPriceModal({
                                    ...p,
                                    resellerPrice: resellerVal
                                  })
                                }
                                className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-semibold flex items-center gap-1"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                <span>Edit Harga</span>
                              </button>
                              <button
                                onClick={() => openEditProductModal(p)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                                title="Edit Detail Barang"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                                title="Hapus Barang"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredInventoryProducts.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-500">
                          Tidak ada barang yang cocok dengan filter pencarian.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <span className="text-xs text-slate-400">Transaksi Ditampilkan</span>
                <div className="text-2xl font-extrabold text-white mt-1">
                  {filteredTransactions.length}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    dari {transactions.length} Nota
                  </span>
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <span className="text-xs text-slate-400">Omzet Terfilter</span>
                <div className="text-2xl font-extrabold text-emerald-400 mt-1">
                  {formatRp(
                    filteredTransactions.reduce((acc, t) => acc + (Number(t.grandTotal) || 0), 0)
                  )}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <span className="text-xs text-slate-400">Ukuran Kertas Printer</span>
                <div className="text-sm font-bold text-amber-400 mt-2 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Printer className="w-4 h-4" />
                    Thermal {paperSize} (Roll Otomatis)
                  </span>
                  <button
                    onClick={() => setReceiptSettingsModal(true)}
                    className="text-xs text-emerald-400 hover:underline font-semibold"
                  >
                    Ubah
                  </button>
                </div>
              </div>
            </div>

            {/* FILTER DAN URUTAN WAKTU DI RIWAYAT */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={txSearchQuery}
                    onChange={(e) => setTxSearchQuery(e.target.value)}
                    placeholder="Cari No Nota, Nama Pelanggan, Barang..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-10 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                  {txSearchQuery && (
                    <button
                      onClick={() => setTxSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <select
                    value={txDateFilter}
                    onChange={(e) => setTxDateFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="all">Semua Waktu</option>
                    <option value="today">Hari Ini</option>
                    <option value="7days">7 Hari Terakhir</option>
                    <option value="month">Bulan Ini</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <select
                    value={txSortOrder}
                    onChange={(e) => setTxSortOrder(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="newest">Urutan: Terbaru ke Terlama</option>
                    <option value="oldest">Urutan: Terlama ke Terbaru</option>
                    <option value="highest">Nominal: Tertinggi ke Terendah</option>
                    <option value="lowest">Nominal: Terendah ke Tertinggi</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-1">
                <span className="text-[11px] text-slate-400 mr-1 shrink-0">Metode Bayar:</span>
                {['Semua', 'Tunai', 'QRIS', 'Transfer'].map((pm) => (
                  <button
                    key={pm}
                    type="button"
                    onClick={() => setTxPaymentFilter(pm)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                      txPaymentFilter === pm
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                    }`}
                  >
                    {pm}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-sm text-white">
                  Riwayat Penjualan, Edit & Cetak Ulang Nota
                </h3>
                <span className="text-[11px] text-slate-400">
                  Klik Edit untuk koreksi harga/jumlah
                </span>
              </div>
              <div className="divide-y divide-slate-800">
                {filteredTransactions.length === 0 ? (
                  <div className="p-10 text-center text-slate-500 text-xs">
                    Tidak ada riwayat transaksi yang sesuai filter.
                  </div>
                ) : (
                  filteredTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-xs text-emerald-400">
                            {tx.invoiceNumber}
                          </span>
                          {tx.customerName && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {tx.customerName}
                            </span>
                          )}
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                            {tx.paymentMethod}
                          </span>
                          {tx.discount > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/20">
                              Diskon: -{formatRp(tx.discount)}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-500">
                            #{tx.cashierDevice || 'POS'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 break-words">
                          {(tx.items || [])
                            .map(
                              (i: any) =>
                                `${i.name} (${i.qty} ${i.unit} x ${formatNum(i.price)})`
                            )
                            .join(', ')}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {new Date(tx.timestamp).toLocaleString('id-ID')}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80 shrink-0">
                        <div className="text-left sm:text-right mr-2">
                          <span className="text-[10px] text-slate-400 block">Total Bayar</span>
                          <span className="text-sm font-extrabold text-white">
                            {formatRp(tx.grandTotal)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openEditTxModal(tx)}
                            className="px-2.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-semibold text-amber-300 flex items-center gap-1"
                            title="Edit Harga, Jumlah atau Isi Nota"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handlePrintRawBT(tx)}
                            className="px-2.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-xs font-semibold text-emerald-300 flex items-center gap-1"
                            title="Langsung Cetak di HP via RawBT"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Cetak HP</span>
                          </button>
                          <button
                            onClick={() => setShowReceiptModal(tx)}
                            className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1"
                            title="Lihat & Cetak Struk"
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Nota</span>
                          </button>
                          <button
                            onClick={() => setDeletingTxConfirm(tx)}
                            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400"
                            title="Hapus Nota"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ================= MODAL 5: EDIT RIWAYAT NOTA (HARGA, JUMLAH, DISKON, HAPUS) ================= */}
      {editingTx && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-4 sm:p-5 shadow-2xl space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 sticky top-0 bg-slate-900 z-10">
              <div>
                <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  <span>Edit Riwayat Nota ({editingTx.invoiceNumber})</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Perubahan jumlah barang otomatis menyesuaikan kembali stok di gudang.
                </p>
              </div>
              <button
                onClick={() => setEditingTx(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedTx} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Nama Pelanggan (Opsional)</label>
                <input
                  type="text"
                  value={editingTx.customerName || ''}
                  onChange={(e) =>
                    setEditingTx({ ...editingTx, customerName: e.target.value })
                  }
                  placeholder="Kosongkan bila pelanggan umum..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white font-semibold"
                />
              </div>

              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1 divide-y divide-slate-800">
                {editingTx.items.map((item: any, idx: number) => (
                  <div key={idx} className="pt-2.5 first:pt-0 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleEditTxItemChange(idx, 'name', e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveEditTxItem(idx)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 shrink-0"
                        title="Hapus Barang dari Nota"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">
                          Jumlah ({item.unit})
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={(e) => handleEditTxItemChange(idx, 'qty', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-bold text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-sky-400 mb-0.5">
                          Harga Satuan (Rp)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={item.price}
                          onChange={(e) => handleEditTxItemChange(idx, 'price', e.target.value)}
                          className="w-full bg-slate-950 border border-sky-500/40 rounded-lg px-2.5 py-1.5 font-bold text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">
                          Subtotal
                        </label>
                        <div className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1.5 font-bold text-emerald-400 truncate">
                          {formatRp(Number(item.qty) * Number(item.price))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-slate-400 mb-1">Potongan Diskon (Rp)</label>
                    <input
                      type="number"
                      min="0"
                      value={editingTx.discount}
                      onChange={(e) =>
                        setEditingTx({ ...editingTx, discount: e.target.value })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Metode Bayar</label>
                    <select
                      value={editingTx.paymentMethod}
                      onChange={(e) =>
                        setEditingTx({ ...editingTx, paymentMethod: e.target.value })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-bold"
                    >
                      <option value="Tunai">Tunai</option>
                      <option value="QRIS">QRIS</option>
                      <option value="Transfer">Transfer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Uang Diterima (Rp)</label>
                    <input
                      type="number"
                      min="0"
                      value={editingTx.cashReceived}
                      onChange={(e) =>
                        setEditingTx({ ...editingTx, cashReceived: e.target.value })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-bold"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <span className="text-slate-300 font-semibold">Total Nota Baru:</span>
                  <span className="text-base font-extrabold text-emerald-400">
                    {formatRp(
                      Math.max(
                        0,
                        editingTx.items.reduce(
                          (acc: number, i: any) => acc + Number(i.price) * Number(i.qty),
                          0
                        ) - (Number(editingTx.discount) || 0)
                      )
                    )}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingTxConfirm(editingTx)}
                  className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 font-semibold flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Nota Ini</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTx(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-600/20"
                  >
                    Simpan Perubahan Nota
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 6: KONFIRMASI HAPUS NOTA ================= */}
      {deletingTxConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-sm text-white">
                Hapus Nota {deletingTxConfirm.invoiceNumber}?
              </h3>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Pilih apakah Anda ingin menghapus nota sekaligus mengembalikan stok barang ke gudang, atau hapus riwayat nota saja.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleDeleteTransaction(deletingTxConfirm, true)}
                className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-center"
              >
                Hapus Nota & Kembalikan Stok Barang
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTransaction(deletingTxConfirm, false)}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 font-semibold text-center"
              >
                Hapus Nota Saja (Stok Tetap)
              </button>
              <button
                type="button"
                onClick={() => setDeletingTxConfirm(null)}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 text-slate-400 hover:text-white font-semibold text-center"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 1: TAMBAH / EDIT BARANG LENGKAP ================= */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 my-auto shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 sticky top-0 bg-slate-900 z-10">
              <h3 className="font-bold text-base text-white">
                {editingProduct ? 'Edit Data & Harga Barang' : 'Tambah Barang Baru'}
              </h3>
              <button
                onClick={() => setProductModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1">
                    Nama Barang (Wajib Diisi) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ketik nama barang di sini..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Kode SKU
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Kategori
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Sembako"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Jumlah Stok
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Satuan Jual
                  </label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="Pcs / Bungkus"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-emerald-400" />
                  <span>Pengaturan Harga Ecer, Grosir & Reseller</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Harga Modal (Rp)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.costPrice}
                      onChange={(e) =>
                        setFormData({ ...formData, costPrice: e.target.value })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sky-400 font-bold mb-1">
                      Harga Jual Ecer / Satuan (Rp) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={formData.retailPrice}
                      onChange={(e) =>
                        setFormData({ ...formData, retailPrice: e.target.value })
                      }
                      className="w-full bg-slate-900 border border-sky-500/40 rounded-xl px-3 py-2 text-white font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
                  <div>
                    <label className="block text-amber-400 font-bold mb-1">
                      Harga Grosir (Rp) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={formData.wholesalePrice}
                      onChange={(e) =>
                        setFormData({ ...formData, wholesalePrice: e.target.value })
                      }
                      className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-purple-400 font-bold mb-1">
                      Harga Reseller (Rp)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.resellerPrice}
                      onChange={(e) =>
                        setFormData({ ...formData, resellerPrice: e.target.value })
                      }
                      placeholder="Opsional"
                      className="w-full bg-slate-900 border border-purple-500/40 rounded-xl px-3 py-2 text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-amber-300 font-semibold mb-1">
                      Min. Kuantitas Grosir
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.wholesaleMinQty}
                      onChange={(e) =>
                        setFormData({ ...formData, wholesaleMinQty: e.target.value })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800 sticky bottom-0 bg-slate-900 py-2">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-600/20"
                >
                  Simpan Barang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: EDIT HARGA CEPAT ================= */}
      {quickPriceModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-white">Edit Harga Cepat</h3>
                <p className="text-xs text-emerald-400 font-medium">
                  {quickPriceModal.name}
                </p>
              </div>
              <button
                onClick={() => setQuickPriceModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickPrice} className="space-y-3 text-xs">
              <div>
                <label className="block text-sky-400 font-bold mb-1">
                  Harga Eceran / Satuan (per {quickPriceModal.unit})
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={quickPriceModal.retailPrice}
                  onChange={(e) =>
                    setQuickPriceModal({
                      ...quickPriceModal,
                      retailPrice: e.target.value
                    })
                  }
                  className="w-full bg-slate-950 border border-sky-500/40 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white"
                />
              </div>

              <div>
                <label className="block text-amber-400 font-bold mb-1">
                  Harga Grosir (per {quickPriceModal.unit})
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={quickPriceModal.wholesalePrice}
                  onChange={(e) =>
                    setQuickPriceModal({
                      ...quickPriceModal,
                      wholesalePrice: e.target.value
                    })
                  }
                  className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white"
                />
              </div>

              <div>
                <label className="block text-purple-400 font-bold mb-1">
                  Harga Khusus Reseller (per {quickPriceModal.unit})
                </label>
                <input
                  type="number"
                  min="0"
                  value={quickPriceModal.resellerPrice ?? quickPriceModal.wholesalePrice}
                  onChange={(e) =>
                    setQuickPriceModal({
                      ...quickPriceModal,
                      resellerPrice: e.target.value
                    })
                  }
                  className="w-full bg-slate-950 border border-purple-500/40 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Minimal Ambil Grosir ({quickPriceModal.unit})
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quickPriceModal.wholesaleMinQty}
                  onChange={(e) =>
                    setQuickPriceModal({
                      ...quickPriceModal,
                      wholesaleMinQty: e.target.value
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm font-bold text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setQuickPriceModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Update Harga Sekarang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: STRUK PEMBELIAN & CETAK ROLL OTOMATIS ================= */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 my-auto">
            {/* Pilihan Ukuran Kertas Cepat */}
            <div className="flex items-center justify-between bg-slate-100 p-2 rounded-xl text-xs font-sans no-print">
              <span className="font-semibold text-slate-600 pl-1">Lebar Kertas Roll:</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setPaperSize('58mm')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    paperSize === '58mm'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  58mm (32 char)
                </button>
                <button
                  type="button"
                  onClick={() => setPaperSize('80mm')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    paperSize === '80mm'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  80mm (48 char)
                </button>
              </div>
            </div>

            {/* AREA NOTA YANG DICETAK */}
            <div id="printable-receipt-area" className="font-mono text-xs space-y-3 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <h3 className="font-extrabold text-base tracking-tight uppercase">
                  {storeInfo.name || 'KASIRPINTAR PRO'}
                </h3>
                <p className="text-[11px] text-slate-600">
                  {storeInfo.address || 'Sistem Kasir Grosir & Eceran'}
                </p>
                {storeInfo.phone && (
                  <p className="text-[11px] text-slate-600">Telp: {storeInfo.phone}</p>
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  {showReceiptModal.invoiceNumber} •{' '}
                  {new Date(showReceiptModal.timestamp).toLocaleString('id-ID')}
                </p>
                {showReceiptModal.customerName && (
                  <p className="text-[11px] font-bold text-slate-700 mt-0.5">
                    Pelanggan: {showReceiptModal.customerName}
                  </p>
                )}
              </div>

              <div className="space-y-2 border-b border-dashed border-slate-300 pb-3 max-h-56 overflow-y-auto">
                {(showReceiptModal.items || []).map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-start gap-2">
                    <div>
                      <div className="font-bold">{item.name}</div>
                      <div className="text-[10px] text-slate-500">
                        {item.qty} {item.unit} x {formatNum(item.price)}
                      </div>
                    </div>
                    <div className="font-bold">{formatNum(item.subtotal)}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-xs">
                {showReceiptModal.wholesaleSavings > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>Hemat Grosir:</span>
                    <span>-{formatRp(showReceiptModal.wholesaleSavings)}</span>
                  </div>
                )}
                {showReceiptModal.discount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Diskon:</span>
                    <span>-{formatRp(showReceiptModal.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-slate-200">
                  <span>TOTAL:</span>
                  <span>{formatRp(showReceiptModal.grandTotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Bayar ({showReceiptModal.paymentMethod}):</span>
                  <span>{formatRp(showReceiptModal.cashReceived)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Kembali:</span>
                  <span>{formatRp(showReceiptModal.change)}</span>
                </div>
              </div>

              <div className="text-center border-t border-dashed border-slate-300 pt-3 text-[10px] text-slate-500">
                {storeInfo.footerNote || 'Terima kasih atas kunjungan Anda!'}
              </div>
            </div>

            {/* TOMBOL PILIHAN CETAK LENGKAP (HP RAWBT, BLUETOOTH LANGSUNG, & BROWSER PC) */}
            <div className="space-y-2 font-sans no-print pt-1">
              <button
                type="button"
                onClick={() => handlePrintRawBT(showReceiptModal)}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
              >
                <Smartphone className="w-4 h-4" />
                <span>Cetak HP Android (RawBT Roll Otomatis)</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isPrintingBt}
                  onClick={() => handlePrintWebBluetooth(showReceiptModal)}
                  className="py-2.5 px-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow"
                >
                  <Bluetooth className="w-4 h-4" />
                  <span>{isPrintingBt ? 'Mencetak...' : 'Bluetooth Langsung'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePrintReceipt(showReceiptModal)}
                  className="py-2.5 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>Print PC / Browser</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowReceiptModal(null)}
                className="w-full py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-colors"
              >
                Tutup / Transaksi Baru
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 4: PENGATURAN CETAK NOTA & IDENTITAS TOKO ================= */}
      {receiptSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">Pengaturan Cetak Nota Toko</h3>
              </div>
              <button
                onClick={() => setReceiptSettingsModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReceiptSettings} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nama Toko (Header Nota)
                </label>
                <input
                  type="text"
                  required
                  value={storeInfo.name}
                  onChange={(e) => setStoreInfo({ ...storeInfo, name: e.target.value })}
                  placeholder="Contoh: TOKO SEMBAKO AMIRA"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Alamat Toko
                </label>
                <input
                  type="text"
                  value={storeInfo.address}
                  onChange={(e) => setStoreInfo({ ...storeInfo, address: e.target.value })}
                  placeholder="Jl. Raya Utama No. 12"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nomor Telepon / WhatsApp
                </label>
                <input
                  type="text"
                  value={storeInfo.phone}
                  onChange={(e) => setStoreInfo({ ...storeInfo, phone: e.target.value })}
                  placeholder="0812-3456-7890"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Ukuran Kertas Printer Thermal
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaperSize('58mm')}
                    className={`py-2 rounded-xl font-bold border transition-all ${
                      paperSize === '58mm'
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    Thermal 58mm (32 Kar)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaperSize('80mm')}
                    className={`py-2 rounded-xl font-bold border transition-all ${
                      paperSize === '80mm'
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    Thermal 80mm (48 Kar)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Pesan Catatan Kaki (Footer Nota)
                </label>
                <textarea
                  rows={2}
                  value={storeInfo.footerNote}
                  onChange={(e) => setStoreInfo({ ...storeInfo, footerNote: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReceiptSettingsModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Simpan Pengaturan Nota
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
