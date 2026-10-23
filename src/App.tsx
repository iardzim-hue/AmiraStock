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
  Store
} from 'lucide-react';

// --- KONFIGU// --- KONFIGURASI FIREBASE ---
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
    wholesaleMinQty: 10
  }
];

// Format Rupiah
const formatRp = (number: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(number || 0);
};

export default function App() {
  // --- STATE AUTH & SINKRONISASI ---
  const [user, setUser] = useState(null);
  const [isSyncing, setIsSyncing] = useState(true);
  const [activeTab, setActiveTab] = useState('pos'); // 'pos' | 'inventory' | 'transactions'
  const [notification, setNotification] = useState(null);

  // --- STATE DATA UTAMA (FIRESTORE) ---
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // --- STATE KASIR (POS) ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [defaultAddMode, setDefaultAddMode] = useState('auto'); // 'auto' | 'retail' | 'wholesale'
  const [cart, setCart] = useState([]);
  const [discountRp, setDiscountRp] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Tunai'); // 'Tunai' | 'QRIS' | 'Transfer'
  const [cashReceived, setCashReceived] = useState('');
  const [showReceiptModal, setShowReceiptModal] = useState(null);

  // --- STATE MODALS INVENTARIS & HARGA ---
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [quickPriceModal, setQuickPriceModal] = useState(null);

  // Form State untuk Tambah/Edit Barang
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: 'Sembako',
    stock: 0,
    unit: 'Pcs',
    costPrice: 0,
    retailPrice: 0,
    wholesalePrice: 0,
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
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
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

    const unsubProducts = onSnapshot(
      productsRef,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));
        items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setProducts(items);
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
          ...d.data()
        }));
        trans.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setTransactions(trans);
      },
      (error) => {
        console.error('Error listening transactions:', error);
      }
    );

    return () => {
      unsubProducts();
      unsubTransactions();
    };
  }, [user]);

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
    const cats = new Set(products.map((p) => p.category || 'Lainnya'));
    return ['Semua', ...Array.from(cats)];
  }, [products]);

  // --- FILTER PRODUK ---
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'Semua' || p.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        (p.name || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // --- LOGIKA KERANJANG (POS) ECER / SATUAN / GROSIR ---
  const addToCart = (product, forcedTier = null) => {
    if (product.stock <= 0) {
      showToast(`Stok ${product.name} habis!`, 'error');
      return;
    }

    const modeToUse = forcedTier || defaultAddMode;

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.productId === product.id);
      const minGrosir = Number(product.wholesaleMinQty) || 10;

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
        if (forcedTier === 'wholesale' || forcedTier === 'wholesale_pack') {
          newTier = 'wholesale';
        } else if (forcedTier === 'retail') {
          newTier = 'retail';
        } else if (!existing.manualOverride) {
          newTier = newQty >= minGrosir ? 'wholesale' : 'retail';
        }

        const activePrice =
          newTier === 'wholesale'
            ? Number(product.wholesalePrice)
            : Number(product.retailPrice);

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

        const activePrice =
          initialTier === 'wholesale'
            ? Number(product.wholesalePrice)
            : Number(product.retailPrice);

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
  const updateCartQty = (productId, newQtyValue) => {
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

  // Ganti Mode Harga per Item (Ecer/Satuan vs Grosir vs Ambil Paket Grosir)
  const switchCartItemTier = (productId, targetTier, setMinWholesaleQty = false) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;

        let newQty = item.qty;
        if (setMinWholesaleQty && newQty < item.wholesaleMinQty) {
          newQty = Math.min(item.wholesaleMinQty, item.maxStock);
        }

        const nextPrice =
          targetTier === 'wholesale' ? item.wholesalePrice : item.retailPrice;

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

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  // --- KALKULASI TOTAL TRANSAKSI ---
  const cartSummary = useMemo(() => {
    const subtotalRetail = cart.reduce((acc, item) => acc + item.retailPrice * item.qty, 0);
    const subtotalActual = cart.reduce((acc, item) => acc + item.activePrice * item.qty, 0);
    const wholesaleSavings = Math.max(0, subtotalRetail - subtotalActual);
    const validDiscount = Math.min(Number(discountRp) || 0, subtotalActual);
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
  }, [cart, discountRp]);

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
      setDiscountRp(0);
      setCashReceived('');
      showToast('Transaksi berhasil disimpan & disinkronkan!');
    } catch (err) {
      console.error('Checkout error:', err);
      showToast('Gagal menyimpan transaksi ke Cloud. Cek Rules Firestore.', 'error');
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
      wholesaleMinQty: 10
    });
    setProductModalOpen(true);
  };

  const openEditProductModal = (product) => {
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
      wholesaleMinQty: Number(product.wholesaleMinQty) || 10
    });
    setProductModalOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Nama barang wajib diisi!', 'error');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      sku: formData.sku.trim() || `BRG-${Date.now().toString().slice(-4)}`,
      category: formData.category.trim() || 'Umum',
      stock: Number(formData.stock) || 0,
      unit: formData.unit.trim() || 'Pcs',
      costPrice: Number(formData.costPrice) || 0,
      retailPrice: Number(formData.retailPrice) || 0,
      wholesalePrice: Number(formData.wholesalePrice) || Number(formData.retailPrice) || 0,
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
              item.tier === 'wholesale' ? payload.wholesalePrice : payload.retailPrice;
            return {
              ...item,
              name: payload.name,
              unit: payload.unit,
              retailPrice: payload.retailPrice,
              wholesalePrice: payload.wholesalePrice,
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
  const handleSaveQuickPrice = async (e) => {
    e.preventDefault();
    if (!quickPriceModal) return;

    const newRetail = Number(quickPriceModal.retailPrice) || 0;
    const newWholesale = Number(quickPriceModal.wholesalePrice) || 0;
    const newMinQty = Math.max(1, Number(quickPriceModal.wholesaleMinQty) || 1);

    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'products', quickPriceModal.id);
      await updateDoc(docRef, {
        retailPrice: newRetail,
        wholesalePrice: newWholesale,
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
            wholesaleMinQty: newMinQty,
            activePrice: item.tier === 'wholesale' ? newWholesale : newRetail
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

  const handleDeleteProduct = async (product) => {
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
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

      {/* HEADER UTAMA & STATUS MULTI-DEVICE */}
      <header className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg tracking-tight text-white">
                  KasirPintar <span className="text-emerald-400">PRO</span>
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Cloud Multi-Device Aktif
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Sistem Kasir Satuan, Eceran & Grosir Terintegrasi
              </p>
            </div>
          </div>

          <nav className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('pos')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'pos'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Kasir (POS)</span>
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'inventory'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Stok & Harga</span>
              <span className="hidden md:inline-block text-xs px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded-md">
                {products.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'transactions'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Riwayat</span>
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={openAddProductModal}
              className="hidden lg:flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              Tambah Barang
            </button>

            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400"
              title="ID Sinkronisasi Perangkat"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">ID:</span>
              <span className="font-mono text-slate-200 text-[11px]">
                {user ? user.uid.slice(0, 8) : 'Ready'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* KONTEN UTAMA */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-5">
        {activeTab === 'pos' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-lg">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari nama barang atau scan kode SKU..."
                      className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none"
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

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    Mode Klik Barang:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setDefaultAddMode('auto')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                        defaultAddMode === 'auto'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-950 text-slate-400 border border-slate-800'
                      }`}
                    >
                      Otomatis (Grosir saat capai min. qty)
                    </button>
                    <button
                      onClick={() => setDefaultAddMode('retail')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                        defaultAddMode === 'retail'
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-950 text-slate-400 border border-slate-800'
                      }`}
                    >
                      Selalu Ecer / Satuan
                    </button>
                    <button
                      onClick={() => setDefaultAddMode('wholesale')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                        defaultAddMode === 'wholesale'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-950 text-slate-400 border border-slate-800'
                      }`}
                    >
                      Langsung Harga Grosir
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
                                onClick={() => setQuickPriceModal({ ...product })}
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

                        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                          <div>
                            <span className="text-[10px] text-slate-400 block">
                              Ecer / Satuan
                            </span>
                            <span className="text-xs sm:text-sm font-bold text-sky-400">
                              {formatRp(product.retailPrice)}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              /{product.unit}
                            </span>
                          </div>
                          <div className="border-l border-slate-800 pl-2.5">
                            <span className="text-[10px] text-amber-400/90 font-medium block">
                              Grosir (≥{product.wholesaleMinQty})
                            </span>
                            <span className="text-xs sm:text-sm font-bold text-amber-400">
                              {formatRp(product.wholesalePrice)}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              /{product.unit}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            disabled={isOutOfStock}
                            onClick={() => addToCart(product, 'retail')}
                            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 disabled:opacity-40 transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+1 Ecer/Satuan</span>
                          </button>

                          <button
                            disabled={isOutOfStock}
                            onClick={() => addToCart(product, 'wholesale_pack')}
                            className="flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 disabled:opacity-40 transition-all"
                            title={`Langsung ambil ${product.wholesaleMinQty} ${product.unit} dengan harga grosir`}
                          >
                            <Layers className="w-3.5 h-3.5" />
                            <span>+{product.wholesaleMinQty} Grosir</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="lg:col-span-5 xl:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col lg:sticky lg:top-20 overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
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

              <div className="p-4 flex-1 max-h-[360px] overflow-y-auto divide-y divide-slate-800/80 space-y-3">
                {cart.length === 0 ? (
                  <div className="py-12 text-center flex flex-col items-center justify-center gap-2 text-slate-500">
                    <ShoppingCart className="w-10 h-10 stroke-[1.5]" />
                    <p className="text-xs">Belum ada barang di keranjang.</p>
                    <p className="text-[11px] text-slate-600">
                      Klik tombol <span className="text-sky-400">+1 Ecer/Satuan</span> atau{' '}
                      <span className="text-amber-400">+Grosir</span> pada produk.
                    </p>
                  </div>
                ) : (
                  cart.map((item) => {
                    const isWholesale = item.tier === 'wholesale';
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
                                  isWholesale
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                    : 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                                }`}
                              >
                                {isWholesale ? 'HARGA GROSIR' : 'ECER / SATUAN'}
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

                        <div className="flex items-center justify-between gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800/90">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => switchCartItemTier(item.productId, 'retail')}
                              className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                                !isWholesale
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
                              onClick={() => switchCartItemTier(item.productId, 'wholesale', true)}
                              className="px-1.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300"
                            >
                              Min.{item.wholesaleMinQty}
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

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Potongan Diskon (Rp):</span>
                  <input
                    type="number"
                    min="0"
                    value={discountRp || ''}
                    onChange={(e) => setDiscountRp(e.target.value)}
                    placeholder="0"
                    className="w-28 text-right bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
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
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Proses Bayar & Cetak Struk</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Manajemen Barang & Pengaturan Harga Multi-Device
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Setiap penambahan barang atau perubahan harga ecer/grosir otomatis tersinkronisasi ke seluruh perangkat kasir.
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

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <th className="py-3.5 px-4">Barang & SKU</th>
                      <th className="py-3.5 px-4">Kategori</th>
                      <th className="py-3.5 px-4">Stok & Satuan</th>
                      <th className="py-3.5 px-4">Harga Modal</th>
                      <th className="py-3.5 px-4 text-sky-400">Harga Ecer / Satuan</th>
                      <th className="py-3.5 px-4 text-amber-400">Harga Grosir</th>
                      <th className="py-3.5 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-xs">
                    {products.map((p) => (
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
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setQuickPriceModal({ ...p })}
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
                    ))}
                    {products.length === 0 && (
                      <tr>
                        <td colSpan="7" className="py-10 text-center text-slate-500">
                          Belum ada barang terdaftar.
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
                <span className="text-xs text-slate-400">Total Transaksi Tercatat</span>
                <div className="text-2xl font-extrabold text-white mt-1">
                  {transactions.length} Struk
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <span className="text-xs text-slate-400">Total Omzet Penjualan</span>
                <div className="text-2xl font-extrabold text-emerald-400 mt-1">
                  {formatRp(
                    transactions.reduce((acc, t) => acc + (Number(t.grandTotal) || 0), 0)
                  )}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <span className="text-xs text-slate-400">Status Sinkronisasi Cloud</span>
                <div className="text-sm font-bold text-sky-400 mt-2 flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  <span>Real-time Multi-Perangkat Aktif</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800">
                <h3 className="font-bold text-sm text-white">Riwayat Penjualan Terbaru</h3>
              </div>
              <div className="divide-y divide-slate-800">
                {transactions.length === 0 ? (
                  <div className="p-10 text-center text-slate-500 text-xs">
                    Belum ada riwayat transaksi penjualan.
                  </div>
                ) : (
                  transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-emerald-400">
                            {tx.invoiceNumber}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                            {tx.paymentMethod}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Perangkat: #{tx.cashierDevice || 'POS'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">
                          {(tx.items || [])
                            .map(
                              (i) =>
                                `${i.name} (${i.qty} ${i.unit} - ${
                                  i.tier === 'wholesale' ? 'Grosir' : 'Ecer'
                                })`
                            )
                            .join(', ')}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {new Date(tx.timestamp).toLocaleString('id-ID')}
                        </p>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-4">
                        <div className="text-right">
                          <span className="text-xs text-slate-400 block">Total Bayar</span>
                          <span className="text-sm font-extrabold text-white">
                            {formatRp(tx.grandTotal)}
                          </span>
                        </div>
                        <button
                          onClick={() => setShowReceiptModal(tx)}
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Struk</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ================= MODAL 1: TAMBAH / EDIT BARANG LENGKAP (STICKY HEADER & FOOTER) ================= */}
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
                  <span>Pengaturan Harga Satuan/Ecer & Grosir</span>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                  <div>
                    <label className="block text-amber-400 font-bold mb-1">
                      Harga Jual Grosir / Ambil Banyak (Rp) *
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
                    <label className="block text-amber-300 font-semibold mb-1">
                      Minimal Kuantitas Grosir
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

      {/* ================= MODAL 3: STRUK PEMBELIAN ================= */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 font-mono text-xs">
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              <h3 className="font-extrabold text-base tracking-tight">KASIRPINTAR PRO</h3>
              <p className="text-[11px] text-slate-500">Sistem Kasir Grosir & Eceran</p>
              <p className="text-[11px] text-slate-500 mt-1">
                {showReceiptModal.invoiceNumber} •{' '}
                {new Date(showReceiptModal.timestamp).toLocaleString('id-ID')}
              </p>
            </div>

            <div className="space-y-2 border-b border-dashed border-slate-300 pb-3 max-h-60 overflow-y-auto">
              {(showReceiptModal.items || []).map((item, idx) => (
                <div key={idx} className="flex justify-between items-start gap-2">
                  <div>
                    <div className="font-bold">{item.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {item.qty} {item.unit} x {formatRp(item.price)} (
                      {item.tier === 'wholesale' ? 'Grosir' : 'Ecer'})
                    </div>
                  </div>
                  <div className="font-bold">{formatRp(item.subtotal)}</div>
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

            <div className="pt-3 flex gap-2 font-sans">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak</span>
              </button>
              <button
                onClick={() => setShowReceiptModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
