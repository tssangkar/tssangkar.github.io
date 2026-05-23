import { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Calendar,
  ShoppingCart,
  ShoppingBag,
  Trash2,
  Search,
  Plus,
  Minus,
  User,
  MapPin,
  Phone,
  CalendarDays,
  Tag,
  Coins,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Download,
  Share2,
  RotateCcw,
  X,
  Menu,
  PlusCircle,
  TrendingUp,
  Settings,
  BarChart3,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { INITIAL_PRODUCTS, SHEET_API_URL, SHEET_API_URL_PESANAN } from './data/products';
import { Product, CartItem, TransactionData } from './types';
import Receipt from './components/Receipt';

// Helper function to convert Google Drive URL to high-performance Thumbnail URL
const getGoogleDriveThumbnailUrl = (url: string): string => {
  if (!url) return '';
  
  // If it's already a thumbnail URL, keep it
  if (url.includes('drive.google.com/thumbnail')) {
    return url;
  }

  let fileId = '';
  
  if (url.includes('drive.google.com')) {
    // Matches /file/d/ID/view or similar paths
    const fileDMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
    if (fileDMatch && fileDMatch[1]) {
      fileId = fileDMatch[1];
    } else {
      // Matches ?id=ID or &id=ID
      const idMatch = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
      if (idMatch && idMatch[1]) {
        fileId = idMatch[1];
      }
    }
  }
  
  if (fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w300`;
  }
  
  return url;
};

export default function App() {
  const [products, setProducts] = useState<Product[]>(() => 
    INITIAL_PRODUCTS.map(p => ({
      ...p,
      foto: getGoogleDriveThumbnailUrl(p.foto)
    }))
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Customer Form states
  const [nama, setNama] = useState<string>('');
  const [alamat, setAlamat] = useState<string>('');
  const [kontak, setKontak] = useState<string>('');
  const [estimasi, setEstimasi] = useState<string>('');
  const [ongkir, setOngkir] = useState<number>(0);
  const [tambahan, setTambahan] = useState<number>(0);
  const [diskon, setDiskon] = useState<number>(0);
  const [metode, setMetode] = useState<string>('Tunai');
  const [uangDiterima, setUangDiterima] = useState<number>(0);
  const [dpDiterima, setDpDiterima] = useState<number>(0);

  // Time & date states
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  // Toast notifications states
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<'success' | 'warning' | 'error' | 'info'>('success');
  const [showToast, setShowToast] = useState<boolean>(false);

  // Hidden Capture Container ref
  const captureRef = useRef<HTMLDivElement>(null);

  // Clock ticks
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      setCurrentDate(
        now.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch products from Google Apps Script Web App
  const loadProducts = async (quiet = false) => {
    if (!SHEET_API_URL || SHEET_API_URL.trim() === '' || SHEET_API_URL.includes('PASTE_YOUR_URL')) {
      return;
    }
    if (!quiet) setLoading(true);
    try {
      const urlWithAction = `${SHEET_API_URL}${SHEET_API_URL.includes('?') ? '&' : '?'}action=getProducts`;
      const response = await fetch(urlWithAction);
      if (!response.ok) throw new Error('Gagal mengambil produk');
      const data = await response.json();
      if (Array.isArray(data)) {
        const mapped: Product[] = data.map((item: any) => ({
          id: item.id !== undefined && item.id !== null ? String(item.id) : '',
          nama: item.nama_produk !== undefined && item.nama_produk !== null ? String(item.nama_produk) : '',
          ukuran: item.ukuran !== undefined && item.ukuran !== null ? String(item.ukuran) : '',
          harga: Number(item.harga) || 0,
          kategori: item.kategori !== undefined && item.kategori !== null ? String(item.kategori) : '',
          foto: getGoogleDriveThumbnailUrl(item.foto_url || ''),
          stok: item.stok !== undefined && item.stok !== '' ? Number(item.stok) : 100,
        }));
        setProducts(mapped);
        if (!quiet) triggerToast('Katalog produk disinkronkan dari Google Sheets!', 'success');
      }
    } catch (err) {
      console.error('Fetch products failed:', err);
      if (!quiet) triggerToast('Gagal memuat produk. Menampilkan data lokal offline.', 'warning');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts(true);
  }, []);

  // CRUD implementation for products
  const addProductToSheet = async (newProd: Omit<Product, 'id'>) => {
    setLoading(true);
    try {
      // Local backup addition first so user sees immediate results
      const localId = 'temp-' + Date.now();
      const localAdd: Product = { ...newProd, id: localId };
      setProducts(prev => [...prev, localAdd]);

      if (!SHEET_API_URL || SHEET_API_URL.trim() === '' || SHEET_API_URL.includes('PASTE_YOUR_URL')) {
        triggerToast('Produk disimpan lokal (Konfigurasi GAS belum aktif!)', 'info');
        setLoading(false);
        return true;
      }

      // We send simple request bypasses CORS preflight in GAS Web Apps
      const response = await fetch(SHEET_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({
          action: 'addProduct',
          data: {
            kategori: newProd.kategori,
            nama_produk: newProd.nama,
            ukuran: newProd.ukuran,
            tipe: 'Mentah', 
            harga: newProd.harga,
            foto_url: newProd.foto,
            stok: newProd.stok !== undefined ? newProd.stok : 100
          }
        })
      });

      // Attempt parsing response
      try {
        const resText = await response.text();
        const resData = JSON.parse(resText);
        if (resData.status === 'success') {
          if (resData.id) {
            setProducts(prev => prev.map(p => p.id === localId ? { ...p, id: resData.id } : p));
          }
          triggerToast('Produk baru berhasil disimpan ke Google Sheets!', 'success');
        } else {
          console.warn('API warning:', resData.message);
        }
      } catch (e) {
        // Simple fallback
        triggerToast('Menambahkan produk...', 'info');
      }
      
      // Refresh to get official values
      await loadProducts(true);
      return true;
    } catch (err) {
      console.error('Add product failed:', err);
      triggerToast('Gagal menyimpan produk ke cloud', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const editProductInSheet = async (editedProd: Product) => {
    setLoading(true);
    try {
      // Local edit update first
      setProducts(prev => prev.map(p => {
        const isMatch = (p.id && editedProd.id && String(p.id) === String(editedProd.id)) || (p.nama === editedProd.nama && p.ukuran === editedProd.ukuran);
        return isMatch ? editedProd : p;
      }));

      if (!SHEET_API_URL || SHEET_API_URL.trim() === '' || SHEET_API_URL.includes('PASTE_YOUR_URL')) {
        triggerToast('Perubahan disimpan lokal (GAS belum aktif)', 'info');
        setLoading(false);
        return true;
      }

      const response = await fetch(SHEET_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({
          action: 'editProduct',
          data: {
            id: editedProd.id,
            kategori: editedProd.kategori,
            nama_produk: editedProd.nama,
            ukuran: editedProd.ukuran,
            tipe: 'Mentah',
            harga: editedProd.harga,
            foto_url: editedProd.foto,
            stok: editedProd.stok !== undefined ? editedProd.stok : 100
          }
        })
      });

      try {
        const resText = await response.text();
        const resData = JSON.parse(resText);
        if (resData.status === 'success') {
          triggerToast('Produk diperbarui di Google Sheets!', 'success');
        }
      } catch (e) {
        triggerToast('Menyimpan perubahan produk...', 'info');
      }

      await loadProducts(true);
      return true;
    } catch (err) {
      console.error('Edit product failed:', err);
      triggerToast('Gagal merubah produk ke cloud', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteProductFromSheet = (prod: Product) => {
    // Membuka modal konfirmasi kustom yang aman dari sandbox iframe
    setDeleteConfirmProduct(prod);
  };

  const executeDeleteProduct = async (prod: Product) => {
    setDeleteConfirmProduct(null);
    setLoading(true);
    try {
      // Local filter first (Hanya fokus pada ID saja)
      setProducts(prev => prev.filter(p => {
        const isMatch = p.id && prod.id && String(p.id) === String(prod.id);
        return !isMatch;
      }));

      if (!SHEET_API_URL || SHEET_API_URL.trim() === '' || SHEET_API_URL.includes('PASTE_YOUR_URL')) {
        triggerToast('Produk dihapus lokal', 'info');
        setLoading(false);
        return true;
      }

      const response = await fetch(SHEET_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({
          action: 'deleteProduct',
          data: {
            id: prod.id
          }
        })
      });

      const resText = await response.text();
      let resData: any;
      try {
        resData = JSON.parse(resText);
      } catch (e) {
        setDeleteDebugHeader('DEBUG INFO');
        setDeleteDebugLog(`Request hapus dikirim ke Google Sheets, tetapi gagal mengurai response JSON.\n\nRaw Response dari Server:\n${resText}\n\nHarap periksa spreadsheet Anda.`);
        triggerToast('Menghapus produk dari Sheet...', 'info');
        await loadProducts(true);
        return true;
      }

      if (resData.status === 'success') {
        triggerToast('Produk berhasil dihapus dari Google Sheets!', 'success');
      } else {
        setDeleteDebugHeader('DEBUG GAGAL CLOUD');
        setDeleteDebugLog(`Gagal menghapus produk dari Cloud!\n\nDetail Pesan Error:\n${resData.message || 'Error tidak dikenal'}\n\nResponse Server:\n${JSON.stringify(resData, null, 2)}`);
        triggerToast('Gagal menghapus produk: ' + (resData.message || 'Error tidak dikenal'), 'error');
      }

      await loadProducts(true);
      return true;
    } catch (err: any) {
      console.error('Delete product failed:', err);
      setDeleteDebugHeader('DEBUG ERROR NETWORK');
      setDeleteDebugLog(`Terjadi kesalahan koneksi / jaringan:\n\n${err.message || err.toString()}`);
      triggerToast('Gagal menghapus produk dari cloud', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Show customized toasts
  const triggerToast = (msg: string, type: 'success' | 'warning' | 'error' | 'info') => {
    setToastMessage(msg);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  // Filter products by searching and category selection
  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'all' || p.kategori === selectedCategory;
    const matchesKeyword =
      p.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.kategori.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.ukuran.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesKeyword;
  });

  // Basket calculations
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

  const getSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.qty * item.harga, 0);
  };

  const getDiskonAmount = () => {
    const checkedPct = Math.min(100, Math.max(0, diskon));
    return Math.round((getSubtotal() * checkedPct) / 100);
  };

  const getTotal = () => {
    return getSubtotal() - getDiskonAmount() + ongkir + tambahan;
  };

  const currentUangDiterima = metode === 'DP' ? dpDiterima : uangDiterima;
  const netChangeOrDue = currentUangDiterima - getTotal();

  // Handle adding products to cart
  const addToCart = (p: Product) => {
    const productStock = p.stok !== undefined ? p.stok : 100;
    const existingIndex = cart.findIndex((item) => item.nama === p.nama && item.ukuran === p.ukuran);
    
    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].qty;
      if (currentQty >= productStock) {
        triggerToast(`Stok tidak mencukupi! Hanya ada ${productStock} unit tersisa.`, 'warning');
        return;
      }
      const updated = [...cart];
      updated[existingIndex].qty += 1;
      setCart(updated);
    } else {
      if (productStock <= 0) {
        triggerToast(`Stok produk "${p.nama}" sedang kosong!`, 'warning');
        return;
      }
      setCart([...cart, { ...p, qty: 1, note: '' }]);
    }
    triggerToast(`Ditambahkan: ${p.nama}`, 'success');
  };

  // Adjust product quantities in cart
  const updateQty = (index: number, val: number) => {
    const item = cart[index];
    const originalProduct = products.find(p => p.nama === item.nama && p.ukuran === item.ukuran);
    const productStock = originalProduct && originalProduct.stok !== undefined ? originalProduct.stok : 100;

    let n = Math.max(1, isNaN(val) ? 1 : val);
    if (n > productStock) {
      triggerToast(`Batas stok tercapai! Hanya ada ${productStock} unit tersedia.`, 'warning');
      n = productStock;
    }

    const updated = [...cart];
    updated[index].qty = n;
    setCart(updated);
  };

  // Remove individual items
  const removeCartItem = (index: number) => {
    const updated = [...cart];
    updated.splice(index, 1);
    setCart(updated);
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (confirm('Kosongkan seluruh keranjang?')) {
      setCart([]);
      triggerToast('Keranjang dikosongkan', 'info');
    }
  };

  // Prepare transaction parameters object
  const getTransactionData = (): TransactionData => {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const formattedTime = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const invoiceId = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate()
    ).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(
      now.getMinutes()
    ).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

    return {
      noTransaksi: invoiceId,
      tanggal: formattedDate,
      jam: formattedTime,
      nama: nama || 'Common Customer',
      alamat: alamat || 'Alamat Toko / Ambil Sendiri',
      kontak: kontak || '-',
      estimasi: estimasi || '',
      items: cart.map((c) => ({
        nama: c.nama,
        ukuran: c.ukuran,
        qty: c.qty,
        harga: c.harga,
        catatan: c.note || '',
      })),
      subtotal: getSubtotal(),
      diskonPct: diskon,
      diskonAmount: getDiskonAmount(),
      ongkir: ongkir,
      tambahan: tambahan,
      total: getTotal(),
      uangDiterima: currentUangDiterima,
      change: netChangeOrDue,
      metode: metode,
    };
  };

  // Submit process to sheet (Google Apps Script API endpoint) and launch print layout output
  const checkout = async () => {
    if (cart.length === 0) {
      triggerToast('Pilih beberapa produk terlebih dahulu!', 'warning');
      return;
    }

    const receiptData = getTransactionData();
    triggerToast('Menyimpan transaksi ke cloud...', 'info');

    // Submit back in a fire-and-forget/no-cors design to sheet
    if (
      SHEET_API_URL_PESANAN &&
      SHEET_API_URL_PESANAN.trim() !== '' &&
      !SHEET_API_URL_PESANAN.includes('PASTE_YOUR_URL')
    ) {
      try {
        await fetch(SHEET_API_URL_PESANAN, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'saveTransaction', data: receiptData }),
        });
      } catch (err) {
        console.error('Submitting transaction data failed:', err);
      }
    }

    // Render print window containing custom iframe output
    const receiptHTMLString = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Nota ${storeNameState} - ${receiptData.noTransaksi}</title>
          <style>
            body { margin: 0; background: #ffffff; padding: 20px; display: flex; justify-content: center; }
            @media print {
              body { padding: 0; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div id="receipt-root"></div>
          <script>
            // We transfer the metadata dynamically for perfect printing in separate print window
            const root = document.getElementById('receipt-root');
            root.innerHTML = \`
              <div style="font-family:'Segoe UI',Arial,sans-serif;width:400px;background:#fff;color:#1a1a1a;padding:5px;">
                <div style="text-align:center;padding-bottom:12px;border-bottom:2px dashed #ddd;">
                  <img src="${storeLogoState}" alt="Logo" style="width:75px;height:auto;margin-bottom:6px;border-radius:50%;" onerror="this.style.display='none'" />
                  <h2 style="margin:0;font-size:20px;font-weight:800;color:#1a1a2e;text-transform:uppercase;">${storeNameState}</h2>
                  <p style="margin:3px 0 0;font-size:10px;color:#777;">${storeSloganState}</p>
                </div>
                <div style="padding:10px 0;font-size:11px;border-bottom:1px solid #eee;">
                  <table style="width:100%;border-collapse:collapse;">
                    <tr>
                      <td>📅 ${receiptData.tanggal}</td>
                      <td style="text-align:right;">📅 ${receiptData.jam}</td>
                    </tr>
                    <tr>
                      <td colspan="2" style="font-weight:700;font-size:12px;margin-top:4px;">No: ${receiptData.noTransaksi}</td>
                    </tr>
                  </table>
                </div>
                <div style="padding:10px 0;font-size:11px;line-height:1.6;border-bottom:1px solid #eee;">
                  <div><strong>Pelanggan:</strong> ${receiptData.nama}</div>
                  <div><strong>Alamat:</strong> ${receiptData.alamat}</div>
                  <div><strong>Kontak:</strong> ${receiptData.kontak}</div>
                  \${"${receiptData.estimasi}" ? "<div><strong>Estimasi PO:</strong> " + new Date("${receiptData.estimasi}").toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'}) + "</div>" : ""}
                </div>
                <div style="padding:10px 0;">
                  <table style="width:100%;border-collapse:collapse;font-size:11px;">
                    <thead>
                      <tr style="border-bottom:2px solid #ccc;background:#f9f9f9;">
                        <th style="text-align:left;padding:4px;">Produk</th>
                        <th style="text-align:center;padding:4px;">Qty</th>
                        <th style="text-align:right;padding:4px;">Harga</th>
                        <th style="text-align:right;padding:4px;">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      \${JSON.parse(\`${JSON.stringify(receiptData.items)}\`).map(item => \`
                        <tr style="border-bottom:1px solid #eee;">
                          <td style="padding:6px 4px;">
                            \${item.nama} <span style="font-size:9;color:#777;">(\${item.ukuran})</span>
                            \${item.catatan ? '<div style="font-size:9px;color:#888;">📝 ' + item.catatan + '</div>' : ''}
                          </td>
                          <td style="text-align:center;padding:6px 4px;">\${item.qty}</td>
                          <td style="text-align:right;padding:6px 4px;">Rp \${item.harga.toLocaleString('id-ID')}</td>
                          <td style="text-align:right;padding:6px 4px;font-weight:600;">Rp \${(item.qty * item.harga).toLocaleString('id-ID')}</td>
                        </tr>
                      \`).join('')}
                    </tbody>
                  </table>
                </div>
                <div style="font-size:11px;line-height:1.6;">
                  <div style="display:flex;justify-content:space-between;"><span>Subtotal:</span><strong>Rp ${receiptData.subtotal.toLocaleString('id-ID')}</strong></div>
                  \${${receiptData.diskonAmount} > 0 ? \`<div style="display:flex;justify-content:space-between;color:red;"><span>Diskon (${receiptData.diskonPct}%):</span><strong>-Rp ${receiptData.diskonAmount.toLocaleString('id-ID')}</strong></div>\` : ''}
                  <div style="display:flex;justify-content:space-between;"><span>Ongkir:</span><strong>Rp ${receiptData.ongkir.toLocaleString('id-ID')}</strong></div>
                  <div style="display:flex;justify-content:space-between;"><span>Biaya Tambahan:</span><strong>Rp ${receiptData.tambahan.toLocaleString('id-ID')}</strong></div>
                  <div style="border-top:1px solid #111;margin:6px 0;"></div>
                  <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:800;"><span>TOTAL:</span><span>Rp ${receiptData.total.toLocaleString('id-ID')}</span></div>
                  <div style="margin-top:6px;">💳 Metode: <strong>${receiptData.metode === 'DP' ? '🏷️ DP (Uang Muka)' : receiptData.metode}</strong></div>
                  ${
                    receiptData.metode === 'Belum Dibayar'
                      ? `<div style="margin-top:6px;padding:6px;background:#fff9eb;border:1px solid #fde68a;text-align:center;">⏳ Bayar saat barang diambil</div>`
                      : `
                    <div style="display:flex;justify-content:space-between;margin-top:3px;"><span>Uang Masuk:</span><strong>Rp ${receiptData.uangDiterima.toLocaleString('id-ID')}</strong></div>
                    <div style="display:flex;justify-content:space-between;font-weight:700;\${${receiptData.change} >=0 ? 'color:green' : 'color:red'}">
                      <span>\${"${receiptData.metode}" === "DP" ? "Sisa Tagihan:" : "Kembalian:"}</span>
                      <span>Rp \${Math.abs(${receiptData.change}).toLocaleString('id-ID')}</span>
                    </div>
                  `
                  }
                </div>
                <div style="text-align:center;margin-top:20px;padding-top:10px;border-top:2px dashed #ddd;font-size:9px;color:#777;">
                  <p style="margin:2px 0;">🙏 Terima kasih atas kepercayaan Anda</p>
                  <p style="margin:2px 0;font-weight:600;text-transform:uppercase;">· ${storeNameState} ·</p>
                  <p style="margin:2px 0;">${storeAlamatState}</p>
                </div>
              </div>
            \`;
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=500,height=750');
    if (printWindow) {
      printWindow.document.write(receiptHTMLString);
      printWindow.document.close();
      triggerToast('Membuka dialog pencetakan nota...', 'success');
    } else {
      triggerToast('Gagal membuka dialog cetak (pembatas popup aktif)', 'error');
    }
  };

  // Capture html2canvas helper with proper loading triggers
  const executeCapture = async (): Promise<{ blob: Blob; filename: string } | null> => {
    if (cart.length === 0) {
      triggerToast('Keranjang belanja kosong!', 'warning');
      return null;
    }
    const receiptData = getTransactionData();
    triggerToast('Sedang memproses tangkapan nota...', 'info');

    // Create a rendering target that exists but is off-screen using proper styles
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '-9999px';
    container.style.width = '480px';
    container.style.background = '#ffffff';
    document.body.appendChild(container);

    try {
      // Inline dynamic import representation
      const rootDiv = document.createElement('div');
      container.appendChild(rootDiv);

      // Render custom receipt template dynamically to match html2canvas layout specs
      const elementHtml = `
        <div style="font-family:'Segoe UI',Arial,sans-serif;width:440px;background:#ffffff;color:#111827;padding:24px;border:1px solid #e5e7eb;border-radius:8px;">
          <div style="text-align:center;padding-bottom:14px;border-bottom:2px dashed #d1d5db;">
            ${storeLogoState && storeLogoState !== 'ts.png' ? `<img src="${storeLogoState}" style="width:70px;height:auto;border-radius:50%;margin-bottom:6px;object-fit:cover;" onerror="this.style.display='none'" />` : ''}
            <div style="font-size:20px;font-weight:800;letter-spacing:1px;color:#1e1b4b;margin-bottom:3px;text-transform:uppercase;">${storeNameState}</div>
            <div style="font-size:11px;color:#4b5563;">${storeSloganState}</div>
          </div>
          <div style="padding:10px 0;font-size:11px;border-bottom:1px solid #f3f4f6;">
            <table style="width:100%;">
              <tr>
                <td style="color:#4b5563;">📅 ${receiptData.tanggal}</td>
                <td style="text-align:right;font-weight:700;">🕐 ${receiptData.jam}</td>
              </tr>
              <tr>
                <td colspan="2" style="font-weight:700;font-size:12px;color:#111827;padding-top:4px;">No: ${receiptData.noTransaksi}</td>
              </tr>
            </table>
          </div>
          <div style="padding:10px 0;font-size:11px;line-height:1.6;border-bottom:1px solid #f3f4f6;color:#1f2937;">
            <div>👤 Pelanggan: <strong>${receiptData.nama}</strong></div>
            <div>📍 Alamat: ${receiptData.alamat}</div>
            <div>📞 Kontak: ${receiptData.kontak}</div>
            ${receiptData.estimasi ? `<div>📅 Estimasi PO: <strong>${new Date(receiptData.estimasi).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'})}</strong></div>` : ''}
          </div>
          <div style="padding:10px 0;">
            <table style="width:100%;border-collapse:collapse;font-size:11px;">
              <thead>
                <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb;">
                  <th style="padding:6px;text-align:left;">Produk</th>
                  <th style="padding:6px;text-align:center;">Qty</th>
                  <th style="padding:6px;text-align:right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${receiptData.items
                  .map(
                    (item) => `
                  <tr style="border-bottom:1px solid #f3f4f6;">
                    <td style="padding:6px;">
                      ${item.nama} <span style="font-size:9px;color:#6b7280;">(${item.ukuran})</span>
                      ${item.catatan ? `<div style="font-size:9px;color:#888;">📝 ${item.catatan}</div>` : ''}
                    </td>
                    <td style="padding:6px;text-align:center;">${item.qty}</td>
                    <td style="padding:6px;text-align:right;font-weight:600;">Rp ${(item.qty * item.harga).toLocaleString('id-ID')}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
          <div style="font-size:11px;line-height:1.6;color:#1f2937;">
            <div style="display:flex;justify-content:space-between;"><span>Subtotal:</span><span>Rp ${receiptData.subtotal.toLocaleString('id-ID')}</span></div>
            ${receiptData.diskonAmount > 0 ? `<div style="display:flex;justify-content:space-between;color:#dc2626;"><span>Diskon (${receiptData.diskonPct}%):</span><span>-Rp ${receiptData.diskonAmount.toLocaleString('id-ID')}</span></div>` : ''}
            <div style="display:flex;justify-content:space-between;"><span>Ongkir:</span><span>Rp ${receiptData.ongkir.toLocaleString('id-ID')}</span></div>
            <div style="display:flex;justify-content:space-between;"><span>Biaya Tambahan:</span><span>Rp ${receiptData.tambahan.toLocaleString('id-ID')}</span></div>
            <div style="border-top:1.5px solid #111827;margin:6px 0;"></div>
            <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:800;color:#111827;"><span>TOTAL TAGIHAN:</span><span>Rp ${receiptData.total.toLocaleString('id-ID')}</span></div>
            <div style="margin-top:6px;color:#4b5563;">💳 Metode: <strong>${receiptData.metode === 'DP' ? '🏷️ DP (Uang Muka)' : receiptData.metode}</strong></div>
            ${
              receiptData.metode === 'Belum Dibayar'
                ? `<div style="margin-top:6px;padding:6px;background:#fffbeb;border:1px solid #fef3c7;border-radius:4px;color:#b45309;text-align:center;">⏳ Pembayaran saat pengambilan</div>`
                : `
              <div style="display:flex;justify-content:space-between;margin-top:4px;"><span>Uang Diterima:</span><span>Rp ${receiptData.uangDiterima.toLocaleString('id-ID')}</span></div>
              <div style="display:flex;justify-content:space-between;font-weight:700;margin-top:2px;">
                <span>${receiptData.metode === 'DP' ? 'Sisa Tagihan:' : 'Kembalian:'}</span>
                <span style="color:${receiptData.change >= 0 ? '#16a34a' : '#dc2626'}">Rp ${Math.abs(receiptData.change).toLocaleString('id-ID')}</span>
              </div>
            `
            }
          </div>
          <div style="text-align:center;margin-top:20px;padding-top:12px;border-top:1.5px dashed #d1d5db;font-size:9px;color:#6b7280;">
            <p style="margin:2px 0;">🙏 Terima kasih atas kepercayaan Anda</p>
            <p style="margin:2px 0;font-weight:600;color:#374151;text-transform:uppercase;">· ${storeNameState} ·</p>
            <p style="margin:2px 0;">${storeAlamatState}</p>
          </div>
        </div>
      `;
      rootDiv.innerHTML = elementHtml;

      // Allow image loading sequences
      await new Promise((resolve) => setTimeout(resolve, 500));

      const canvas = await html2canvas(rootDiv, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });

      return new Promise((resolve) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({
                blob,
                filename: `Nota_${storeNameState.replace(/\s+/g, '_')}_${receiptData.noTransaksi}.jpg`,
              });
            } else {
              resolve(null);
            }
          },
          'image/jpeg',
          0.95
        );
      });
    } catch (e) {
      console.error('Canvas capture failed:', e);
      return null;
    } finally {
      document.body.removeChild(container);
    }
  };

  const downloadNotaJPG = async () => {
    const result = await executeCapture();
    if (!result) {
      triggerToast('Gagal memproses nota!', 'error');
      return;
    }
    const { blob, filename } = result;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    triggerToast('Nota sukses diunduh sebagai gambar!', 'success');
  };

  const shareNota = async () => {
    const result = await executeCapture();
    if (!result) {
      triggerToast('Gagal memproses nota!', 'error');
      return;
    }
    const { blob, filename } = result;
    const file = new File([blob], filename, { type: 'image/jpeg' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `Nota ${storeNameState}`,
          text: `Berikut adalah nota transaksi ${storeNameState}.`,
          files: [file],
        });
        triggerToast('Nota dibagikan!', 'success');
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          // Fallback download if user canceled share menu but supported otherwise
          downloadNotaJPG();
        }
      }
    } else {
      // Direct fallback to downloder
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      triggerToast('Berbagi tidak didukung browser ini. Mengunduh JPG...', 'info');
    }
  };

  // Reset workstates to defaults
  const resetAll = () => {
    if (cart.length > 0 && !confirm('Reset seluruh transaksi aktif?')) return;
    setCart([]);
    setNama('');
    setAlamat('');
    setKontak('');
    setEstimasi('');
    setOngkir(0);
    setTambahan(0);
    setDiskon(0);
    setMetode('Tunai');
    setUangDiterima(0);
    setDpDiterima(0);
    setSearchQuery('');
    setSelectedCategory('all');
    triggerToast('Seluruh kolom disetel ulang!', 'success');
  };

  // ==================== CUSTOM STORE CONFIGURATION ====================
  const [activeTab, setActiveTab ] = useState<'pos' | 'products' | 'reports' | 'settings'>('pos');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [storeNameState, setStoreNameState] = useState<string>('KASIR PINTAR');
  const [storeSloganState, setStoreSloganState] = useState<string>('Sistem Kasir Fleksibel Multi-Fungsi');
  const [storeAlamatState, setStoreAlamatState] = useState<string>('🌐 santridev.github.io | 📞 0812-3456-7890');
  const [storeLogoState, setStoreLogoState] = useState<string>('store.png');

  // Product CRUD states
  const [showProductForm, setShowProductForm] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodFormNama, setProdFormNama] = useState<string>('');
  const [prodFormUkuran, setProdFormUkuran] = useState<string>('');
  const [prodFormKategori, setProdFormKategori] = useState<string>('Umum');
  const [prodFormHarga, setProdFormHarga] = useState<number>(0);
  const [prodFormFoto, setProdFormFoto] = useState<string>('');
  const [prodFormStok, setProdFormStok] = useState<number>(100);

  // Custom IFrame-safe Dialog Modals for deletion and debug alert logging
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<Product | null>(null);
  const [deleteDebugHeader, setDeleteDebugHeader] = useState<string>('');
  const [deleteDebugLog, setDeleteDebugLog] = useState<string | null>(null);

  // Custom states for interactive reports charts
  const [chartHoverIdx, setChartHoverIdx] = useState<number | null>(null);

  // Form states for Settings page
  const [tempName, setTempName] = useState<string>('KASIR PINTAR');
  const [tempSlogan, setTempSlogan] = useState<string>('Sistem Kasir Fleksibel Multi-Fungsi');
  const [tempAlamat, setTempAlamat] = useState<string>('🌐 santridev.github.io | 📞 0812-3456-7890');
  const [tempLogo, setTempLogo] = useState<string>('store.png');

  // Sync temp variables with saved states on first load or changes
  useEffect(() => {
    setTempName(storeNameState);
    setTempSlogan(storeSloganState);
    setTempAlamat(storeAlamatState);
    setTempLogo(storeLogoState);
  }, [storeNameState, storeSloganState, storeAlamatState, storeLogoState]);

  useEffect(() => {
    try {
      const configStr = localStorage.getItem('ts_sangkar_store_config');
      if (configStr) {
        const config = JSON.parse(configStr);
        if (config.namaToko) setStoreNameState(config.namaToko);
        if (config.sloganToko) setStoreSloganState(config.sloganToko);
        if (config.alamatToko) setStoreAlamatState(config.alamatToko);
        if (config.logoToko) setStoreLogoState(config.logoToko);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleSaveStoreConfig = (name: string, slogan: string, alamat: string, logo: string) => {
    try {
      const config = { namaToko: name, sloganToko: slogan, alamatToko: alamat, logoToko: logo };
      localStorage.setItem('ts_sangkar_store_config', JSON.stringify(config));
      setStoreNameState(name);
      setStoreSloganState(slogan);
      setStoreAlamatState(alamat);
      setStoreLogoState(logo);
      triggerToast('Pengaturan toko berhasil disimpan!', 'success');
    } catch (e) {
      triggerToast('Gagal menyimpan pengaturan', 'error');
    }
  };

  // ==================== GOOGLE SHEET REPORT SYSTEM ====================
  const [sheetRows, setSheetRows] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState<boolean>(false);
  const [reportsError, setReportsError] = useState<string>('');
  const [reportsSearchQuery, setReportsSearchQuery] = useState<string>('');

  const parseCSV = (csvText: string) => {
    const lines: string[] = [];
    let currentLine = '';
    let insideQuote = false;

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === '\n' && !insideQuote) {
        lines.push(currentLine);
        currentLine = '';
      } else if (char === '\r' && !insideQuote) {
        // ignore
      } else {
        currentLine += char;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    if (lines.length === 0) return [];

    const parseRow = (lineStr: string) => {
      const fields: string[] = [];
      let currentField = '';
      let inQuote = false;
      for (let i = 0; i < lineStr.length; i++) {
        const char = lineStr[i];
        if (char === '"') {
          inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
          fields.push(currentField);
          currentField = '';
        } else {
          currentField += char;
        }
      }
      fields.push(currentField);
      return fields;
    };

    const headers = parseRow(lines[0]).map(h => h.trim().toLowerCase());
    
    const parsedRows = [];
    for (let i = 1; i < lines.length; i++) {
      const fields = parseRow(lines[i]);
      if (fields.length < headers.length) continue;
      
      const rowObj: Record<string, string> = {};
      headers.forEach((header, idx) => {
        rowObj[header] = fields[idx]?.trim() || '';
      });
      parsedRows.push(rowObj);
    }
    return parsedRows;
  };

  const fetchGoogleSheetReports = async () => {
    setReportsLoading(true);
    setReportsError('');
    try {
      const spreadsheetId = '19981hn179EkrhmnlGCBPl5ZVhx84O1KMaglrq9RKVCI';
      const range = "'Pesanan'!A1:Z10000";
      const apiKey = 'AIzaSyA8x0yI8zCPUgZktmGNvQVTzhm1fdZ0K74';
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Gagal mengunduh data (Status: ${response.status}). Hubungi administrator atau periksa visibilitas file Spreadsheet.`);
      }
      
      const data = await response.json();
      if (!data.values || data.values.length === 0) {
        setSheetRows([]);
        triggerToast('Data Google Sheet kosong!', 'info');
        return;
      }
      
      const headers = data.values[0].map((h: any) => String(h).trim().toLowerCase());
      const parsedRows = [];
      
      for (let i = 1; i < data.values.length; i++) {
        const rowValues = data.values[i];
        if (!rowValues || rowValues.length === 0) continue;
        const rowObj: Record<string, string> = {};
        headers.forEach((header: string, idx: number) => {
          rowObj[header] = rowValues[idx] !== undefined ? String(rowValues[idx]).trim() : '';
        });
        parsedRows.push(rowObj);
      }
      
      setSheetRows(parsedRows);
      triggerToast('Sinkronisasi data Google Sheets berhasil!', 'success');
    } catch (err: any) {
      console.error('Failed to load sheets report via API:', err);
      setReportsError(err.message || 'Gagal sinkronisasi data via Google Sheets v4 API.');
      triggerToast('Gagal memuat laporan transaksi', 'error');
    } finally {
      setReportsLoading(false);
    }
  };

  // Fetch report on tab switch
  useEffect(() => {
    if (activeTab === 'reports') {
      fetchGoogleSheetReports();
    }
  }, [activeTab]);

  const parseCurrency = (val: any): number => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const cleaned = String(val).replace(/[^0-9]/g, '');
    return parseInt(cleaned, 10) || 0;
  };

  // Smart column value resolver with priority: Exact case-insensitive match > Fallback keywords
  const getSheetColValue = (row: any, columnName: string, fallbackKeywords: string[] = []): string => {
    if (!row) return '';
    const lowerCol = columnName.toLowerCase();
    const keys = Object.keys(row);
    
    // 1. Exact case-insensitive check
    const exactKey = keys.find(k => k.toLowerCase() === lowerCol);
    if (exactKey) {
      return String(row[exactKey]);
    }
    
    // 2. Extra word match checks with underscores (e.g. _total)
    const underscoreKey = keys.find(k => {
      const lk = k.toLowerCase();
      return lk === `_${lowerCol}` || lk === `${lowerCol}_` || lk === `_${lowerCol}_`;
    });
    if (underscoreKey) {
      return String(row[underscoreKey]);
    }

    // 3. Fallback keywords checking, but explicitly safeguarding 'subtotal' matching 'total'
    for (const kw of fallbackKeywords) {
      const lowerKw = kw.toLowerCase();
      const matchedKey = keys.find(k => {
        const lk = k.toLowerCase();
        // Skip matching 'subtotal' if the keyword we look for is 'total'
        if (lowerKw === 'total' && lk.includes('subtotal')) {
          return false;
        }
        return lk.includes(lowerKw);
      });
      if (matchedKey) return String(row[matchedKey]);
    }

    return '';
  };

  // Dedicated Google Sheet column getters
  const getNoTransaksi = (row: any) => getSheetColValue(row, 'noTransaksi', ['transaksi', 'invoice', 'id_pesanan', 'no']);
  const getTanggal = (row: any) => getSheetColValue(row, 'tanggal', ['date', 'tgl']);
  const getNama = (row: any) => getSheetColValue(row, 'nama', ['pelanggan', 'customer']);
  const getAlamat = (row: any) => getSheetColValue(row, 'alamat');
  const getKontak = (row: any) => getSheetColValue(row, 'kontak');
  const getEstimasi = (row: any) => getSheetColValue(row, 'estimasi');
  const getItems = (row: any) => getSheetColValue(row, 'items', ['item', 'produk', 'barang']);
  const getSubtotalVal = (row: any) => getSheetColValue(row, 'subtotal');
  const getDiskonPctVal = (row: any) => getSheetColValue(row, 'diskonPct', ['diskonpct']);
  const getDiskonAmountVal = (row: any) => getSheetColValue(row, 'diskonAmount', ['diskonamount']);
  const getOngkirVal = (row: any) => getSheetColValue(row, 'ongkir');
  const getTambahanVal = (row: any) => getSheetColValue(row, 'tambahan');
  const getTotalVal = (row: any) => getSheetColValue(row, 'total');
  const getUangDiterimaVal = (row: any) => getSheetColValue(row, 'uangDiterima', ['uangditerima']);
  const getChangeVal = (row: any) => getSheetColValue(row, 'change');
  const getMetode = (row: any) => getSheetColValue(row, 'metode', ['pembayaran', 'payment']);
  const getWaktu = (row: any) => getSheetColValue(row, 'waktu', ['timestamp']);

  // Format JSON array or string of list of items cleanly
  const formatItemsList = (itemsRaw: string): string => {
    if (!itemsRaw) return '';
    try {
      const trimmed = itemsRaw.trim();
      if (trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((it: any) => `${it.nama || it.name || ''} (${it.qty || 1}x)`).join(', ');
        }
      }
    } catch (e) {
      // Just return raw if fail
    }
    return itemsRaw;
  };

  // Parse Indonesian and English dates to absolute numbers for sorting
  const parseDateToComparable = (dateStr: string): number => {
    try {
      if (!dateStr || dateStr === 'Unknown') return 0;
      const monthsMap: Record<string, number> = {
        jan: 1, januari: 1, january: 1,
        feb: 2, februari: 2, february: 2,
        mar: 3, maret: 3, march: 3,
        apr: 4, april: 4, ifor: 4,
        mei: 5, may: 5,
        jun: 6, juni: 6, june: 6,
        jul: 7, juli: 7, july: 7,
        agu: 8, agustus: 8, august: 8, ags: 8,
        sep: 9, september: 9,
        okt: 10, oktober: 10, october: 10,
        nov: 11, november: 11,
        des: 12, desember: 12, december: 12
      };

      const parts = dateStr.trim().split(/\s+/);
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10) || 1;
        const monthStr = parts[1].toLowerCase().replace(/[^a-z]/g, '');
        const month = monthsMap[monthStr] || 1;
        const year = parseInt(parts[2], 10) || 2026;
        return year * 10000 + month * 100 + day;
      }

      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
      }
    } catch (e) {
      // Ignore
    }
    return 0;
  };

  // Calculation of sheet reports statistics
  const getReportsStats = () => {
    let totalSales = 0;
    const transactionCount = sheetRows.length;
    const paymentMethodsMap: Record<string, number> = {};
    const dateSalesMap: Record<string, number> = {};
    const productSalesMap: Record<string, { name: string; count: number; revenue: number }> = {};

    sheetRows.forEach((row) => {
      const totalStr = getTotalVal(row);
      const totalNum = parseCurrency(totalStr);
      totalSales += totalNum;

      const methodStr = getMetode(row) || 'Tunai';
      paymentMethodsMap[methodStr] = (paymentMethodsMap[methodStr] || 0) + 1;

      const dateStr = getTanggal(row) || 'Unknown';
      dateSalesMap[dateStr] = (dateSalesMap[dateStr] || 0) + totalNum;

      // Hubungkan data item / produk dari list JSON untuk menghitung yang terlaris
      const itemsRaw = getItems(row);
      if (itemsRaw) {
        try {
          const trimmed = itemsRaw.trim();
          if (trimmed.startsWith('[')) {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
              parsed.forEach((it: any) => {
                const pName = String(it.nama || it.name || '').trim();
                if (pName) {
                  const q = Number(it.qty) || 1;
                  const h = Number(it.harga || it.price) || 0;
                  if (!productSalesMap[pName]) {
                    productSalesMap[pName] = { name: pName, count: 0, revenue: 0 };
                  }
                  productSalesMap[pName].count += q;
                  productSalesMap[pName].revenue += (h * q);
                }
              });
            }
          }
        } catch (e) {
          // Gagal uraikan JSON, abaikan
        }
      }
    });

    const averageOrder = transactionCount > 0 ? Math.round(totalSales / transactionCount) : 0;

    const paymentStats = Object.keys(paymentMethodsMap).map((method) => ({
      method,
      count: paymentMethodsMap[method],
    })).sort((a, b) => b.count - a.count);

    const productStats = Object.keys(productSalesMap).map((name) => ({
      name,
      count: productSalesMap[name].count,
      revenue: productSalesMap[name].revenue,
    })).sort((a, b) => b.count - a.count).slice(0, 10);

    const dailyTrends = Object.keys(dateSalesMap).map((date) => ({
      date,
      sales: dateSalesMap[date],
    })).sort((a, b) => {
      return parseDateToComparable(b.date) - parseDateToComparable(a.date);
    }).slice(0, 10);

    return {
      totalSales,
      transactionCount,
      averageOrder,
      paymentStats,
      productStats,
      dailyTrends,
    };
  };

  const stats = getReportsStats();

  // Reverse so newest entries display first, then filter by search query
  const filteredSheetRows = [...sheetRows].reverse().filter((row) => {
    const q = reportsSearchQuery.toLowerCase();
    if (!q) return true;
    return Object.values(row).some((val) => 
      String(val).toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen flex flex-col bg-panel-bg text-slate-800 font-sans selection:bg-accent/25 selection:text-slate-900">
      {/* HEADER SECTION */}
      <header className="relative bg-gradient-to-br from-primary to-secondary text-white shadow-md sticky top-0 z-40 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {storeLogoState && storeLogoState !== 'ts.png' && storeLogoState.startsWith('data:') ? (
              <img
                src={storeLogoState}
                alt="Logo"
                className="w-10 h-10 rounded-full object-cover shadow-md border border-white/10 bg-white"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center font-bold text-lg font-display tracking-tight shadow-md">
                {storeNameState.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="font-display font-bold text-lg md:text-xl tracking-wide leading-none select-none text-transparent bg-clip-text bg-gradient-to-r from-white via-accent-light to-accent uppercase">
                {storeNameState}
              </h1>
              <span className="text-[10px] text-slate-300 tracking-wider uppercase font-semibold block mt-1 select-none opacity-85 text-ellipsis overflow-hidden max-w-[150px] md:max-w-none whitespace-nowrap">
                {storeSloganState}
              </span>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center">
            <button
              onClick={() => setIsMobileMenuOpen(prev => !prev)}
              className="inline-flex items-center justify-center p-2 rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/70"
              aria-label="Buka menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="hidden md:flex items-center gap-1 bg-white/10 p-1 rounded-full border border-white/5 backdrop-blur-xs text-[10px] md:text-xs">
            <button
              onClick={() => setActiveTab('pos')}
              className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-3.5 py-1.5 rounded-full font-semibold transition-all duration-200 cursor-pointer ${
                activeTab === 'pos'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-slate-205 hover:text-white hover:bg-white/5'
              }`}
            >
              <ShoppingCart className="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span>Kasir</span>
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-3.5 py-1.5 rounded-full font-semibold transition-all duration-200 cursor-pointer ${
                activeTab === 'products'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-slate-205 hover:text-white hover:bg-white/5'
              }`}
            >
              <ShoppingBag className="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span>Produk &amp; Stok</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('reports');
                fetchGoogleSheetReports(); // Auto sync report data on click!
              }}
              className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-3.5 py-1.5 rounded-full font-semibold transition-all duration-200 cursor-pointer ${
                activeTab === 'reports'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-slate-205 hover:text-white hover:bg-white/5'
              }`}
            >
              <BarChart3 className="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span>Laporan</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-3.5 py-1.5 rounded-full font-semibold transition-all duration-200 cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-slate-205 hover:text-white hover:bg-white/5'
              }`}
            >
              <Settings className="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span>Pengaturan</span>
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/5 shadow-sm text-slate-200">
              <Clock className="w-3.5 h-3.5 text-accent-light" />
              <span className="font-mono font-medium tracking-wide">{currentTime || '--:--:--'}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/5 shadow-sm text-slate-200">
              <Calendar className="w-3.5 h-3.5 text-accent-light" />
              <span>{currentDate || 'Tanggal'}</span>
            </div>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        <div className={`md:hidden bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-sm transition-all duration-200 overflow-hidden ${isMobileMenuOpen ? 'max-h-[320px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="px-4 py-3 space-y-2">
            <button
              onClick={() => { setActiveTab('pos'); setIsMobileMenuOpen(false); }}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl transition-colors duration-200 ${activeTab === 'pos' ? 'bg-accent text-white' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              <ShoppingCart className="w-4 h-4" />
              Kasir
            </button>
            <button
              onClick={() => { setActiveTab('products'); setIsMobileMenuOpen(false); }}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl transition-colors duration-200 ${activeTab === 'products' ? 'bg-accent text-white' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              <ShoppingBag className="w-4 h-4" />
              Produk & Stok
            </button>
            <button
              onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); fetchGoogleSheetReports(); }}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl transition-colors duration-200 ${activeTab === 'reports' ? 'bg-accent text-white' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              <BarChart3 className="w-4 h-4" />
              Laporan
            </button>
            <button
              onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl transition-colors duration-200 ${activeTab === 'settings' ? 'bg-accent text-white' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              <Settings className="w-4 h-4" />
              Pengaturan
            </button>
          </div>
        </div>
      </header>

      {/* CORE FRAME CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 overflow-hidden">
        {activeTab === 'pos' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT COLUMN: PRODUCTS CATALOG (5/12 widths) */}
        <section className="lg:col-span-5 flex flex-col bg-white rounded-2xl border border-slate-250 shadow-sm overflow-hidden min-h-[500px] max-h-[850px]">
          {/* CATALOG HEADER WITH FILTERS */}
          <div className="p-4 md:p-5 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-slate-900 tracking-tight text-base flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-primary" />
                Katalog Produk Kami
              </h3>
              <span className="text-xs text-slate-400 font-mono font-semibold">
                {filteredProducts.length} Item
              </span>
            </div>

            {/* SEARCHING */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama, ukuran, atau kategori..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full py-2 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-full text-sm transition-all focus:outline-none focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/15 placeholder:text-slate-400 text-slate-700"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200/50"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* CATEGORY SELECTOR CHIPS */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none scroll-smooth">
              {[{ key: 'all', label: 'Semua' }, ...Array.from(new Set(products.map(p => p.kategori).filter(Boolean))).map(cat => ({ key: cat, label: cat }))].map((category) => (
                <button
                  key={category.key}
                  onClick={() => setSelectedCategory(category.key)}
                  className={`text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-all duration-250 cursor-pointer whitespace-nowrap active:scale-95 ${
                    selectedCategory === category.key
                      ? 'bg-accent text-white border-accent shadow-sm font-bold'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          {/* DYNAMIC PRODUCTS GRID (with scroll boundaries) */}
          <div className="flex-1 overflow-y-auto p-4 md:p-5 bg-slate-50/50">
            {loading ? (
              <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
                <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                <span>Memuat database cloud...</span>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-sm p-4 text-center">
                <Search className="w-10 h-10 mb-2 opacity-30 text-slate-400" />
                <span className="font-semibold">Produk tidak ditemukan</span>
                <span className="text-xs text-slate-400">Coba ubah filter pencarian Anda</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-2 gap-3.5">
                {filteredProducts.map((p, idx) => (
                  <div
                     key={idx}
                     onClick={() => addToCart(p)}
                     className="group bg-white rounded-xl border border-slate-200 p-3 flex flex-col cursor-pointer transition-all duration-300 hover:shadow-md hover:border-accent active:scale-95"
                  >
                    <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-slate-50 mb-3 border border-slate-100">
                      <span className="absolute top-1.5 left-1.5 text-[9px] bg-slate-950/80 text-white font-bold tracking-wider uppercase px-2 py-0.5 rounded-full backdrop-blur-sm z-10 font-sans shadow-sm select-none">
                        {p.kategori}
                      </span>
                      <span className={`absolute top-1.5 right-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm z-10 font-sans shadow-sm select-none ${
                        p.stok !== undefined && p.stok <= 0
                          ? 'bg-rose-600 text-white font-black'
                          : p.stok !== undefined && p.stok < 10
                          ? 'bg-amber-550 text-white font-black'
                          : 'bg-emerald-600/90 text-white'
                      }`}>
                        {p.stok !== undefined ? (p.stok <= 0 ? 'HABIS' : `Stok: ${p.stok}`) : 'Stok: 99+'}
                      </span>
                      <img
                        src={p.foto}
                        alt={p.nama}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          // Clean fallback for broken image URLs
                          (e.currentTarget as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1626331307374-ba220ae10793?auto=format&fit=crop&q=80&w=300';
                        }}
                        className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${p.stok !== undefined && p.stok <= 0 ? 'grayscale opacity-50' : ''}`}
                      />
                    </div>
                    <div className="flex-1 flex flex-col">
                      <h4 className="font-bold text-slate-800 text-xs md:text-sm group-hover:text-accent transition-colors leading-tight line-clamp-2">
                        {p.nama}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-medium mt-1 inline-flex items-center gap-1 select-none">
                        📐 Ukuran: {p.ukuran}
                      </span>
                      <div className="mt-auto pt-2 flex items-center justify-between">
                        <span className="font-extrabold text-xs md:text-sm text-emerald-600">
                          Rp {p.harga.toLocaleString('id-ID')}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md transition-colors ${
                          p.stok !== undefined && p.stok <= 0
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white'
                        }`}>
                          {p.stok !== undefined && p.stok <= 0 ? 'Habis' : 'Tambah'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* MIDDLE COLUMN: BASKET CART LIST (3/12 widths) */}
        <section className="lg:col-span-3 flex flex-col bg-white rounded-2xl border border-slate-250 shadow-sm overflow-hidden min-h-[400px] max-h-[850px]">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10 shadow-3xs">
            <h3 className="font-display font-bold text-slate-900 tracking-tight text-sm flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-primary" />
              Keranjang Belanja
            </h3>
            <button
              onClick={clearCart}
              className="text-[11px] text-slate-400 hover:text-rose-600 font-semibold px-2.5 py-1 rounded-full border border-slate-205 hover:border-rose-200 hover:bg-rose-50/50 transition-colors"
            >
              Kosongkan
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/20">
            {cart.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-xs gap-1.5 text-center p-4">
                <ShoppingCart className="w-8 h-8 opacity-20 text-slate-400" />
                <span className="font-semibold">Keranjang Kosong</span>
                <span className="text-slate-400 select-none">Klik produk sebelah kiri untuk menambahkan barang</span>
              </div>
            ) : (
              cart.map((item, index) => (
                <div
                  key={index}
                  className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 text-xs relative hover:shadow-xs transition-shadow"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h5 className="font-extrabold text-slate-800 leading-tight">{item.nama}</h5>
                      <span className="text-[10px] text-slate-400 block mt-0.5 select-none font-medium">
                        Ukuran: {item.ukuran}
                      </span>
                    </div>
                    <button
                      onClick={() => removeCartItem(index)}
                      className="text-slate-300 hover:text-rose-600 hover:bg-slate-100/50 p-1 rounded-full transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* QTY TRIGGER & INDIVIDUAL PRICE */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    {/* BUTTON GROUP */}
                    <div className="inline-flex items-center border border-slate-200 rounded-lg overflow-hidden h-8">
                      <button
                        onClick={() => updateQty(index, item.qty - 1)}
                        className="px-2 bg-slate-50 text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors h-full"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => updateQty(index, parseInt(e.target.value))}
                        className="w-10 text-center font-bold text-slate-800 text-xs border-none focus:outline-none focus:ring-0 bg-white h-full"
                      />
                      <button
                        onClick={() => updateQty(index, item.qty + 1)}
                        className="px-2 bg-slate-50 text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors h-full"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block line-clamp-1">
                        @{item.harga.toLocaleString('id-ID')}
                      </span>
                      <strong className="text-emerald-600 text-[13px]">
                        Rp {(item.qty * item.harga).toLocaleString('id-ID')}
                      </strong>
                    </div>
                  </div>

                  {/* USER NOTE INSERTION */}
                  <input
                    type="text"
                    placeholder="📝 Catatan item (opsional)"
                    value={item.note}
                    onChange={(e) => {
                      const updated = [...cart];
                      updated[index].note = e.target.value;
                      setCart(updated);
                    }}
                    className="w-full text-[11px] px-2 py-1 bg-slate-50 border border-slate-150 rounded-md focus:outline-none focus:border-accent focus:bg-white text-slate-700 placeholder:text-slate-400 transition-all font-sans"
                  />
                </div>
              ))
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: CASHIER WORKSPACE / FORM (4/12 widths) */}
        <section className="lg:col-span-4 bg-white rounded-2xl border border-slate-250 shadow-sm p-4 md:p-5 flex flex-col gap-4 overflow-y-auto min-h-[500px] max-h-[850px]">
          <h3 className="font-display font-bold text-slate-900 tracking-tight text-base flex items-center gap-2 border-b border-slate-100 pb-3">
            <Coins className="w-5 h-5 text-primary" />
            Detail Transaksi
          </h3>

          {/* CUSTOMER PROFILE FIELDS */}
          <div className="space-y-3.5">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1 select-none">
                <User className="w-3 h-3 text-slate-400" /> Nama Pelanggan
              </label>
              <input
                type="text"
                placeholder="Masukkan nama pelanggan..."
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                className="text-xs w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-accent focus:bg-white transition-all text-slate-700 font-sans"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1 select-none">
                <MapPin className="w-3 h-3 text-slate-400" /> Alamat Pengiriman
              </label>
              <textarea
                placeholder="Masukkan alamat lengkap..."
                rows={1.5}
                value={alamat}
                onChange={(e) => setAlamat(e.target.value)}
                className="text-xs w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-accent focus:bg-white transition-all text-slate-700 resize-none h-14 font-sans"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1 select-none">
                  <Phone className="w-3 h-3 text-slate-400" /> Kontak / HP
                </label>
                <input
                  type="text"
                  placeholder="No. HP / WA"
                  value={kontak}
                  onChange={(e) => setKontak(e.target.value)}
                  className="text-xs w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-accent focus:bg-white transition-all text-slate-700 font-sans"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1 select-none">
                  <CalendarDays className="w-3 h-3 text-slate-400" /> Estimasi PO
                </label>
                <input
                  type="date"
                  value={estimasi}
                  onChange={(e) => setEstimasi(e.target.value)}
                  className="text-xs w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-accent focus:bg-white transition-all text-slate-700 block-calendar font-sans"
                />
              </div>
            </div>

            {/* ADDTIONAL BILLING */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block select-none">
                  📦 Ongkir
                </label>
                <input
                  type="number"
                  min="0"
                  value={ongkir || ''}
                  onChange={(e) => setOngkir(Math.max(0, parseInt(e.target.value) || 0))}
                  className="text-xs w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-accent focus:bg-white text-slate-700 font-sans"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block select-none">
                  ➕ Tambahan
                </label>
                <input
                  type="number"
                  min="0"
                  value={tambahan || ''}
                  onChange={(e) => setTambahan(Math.max(0, parseInt(e.target.value) || 0))}
                  className="text-xs w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-accent focus:bg-white text-slate-700 font-sans"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block select-none">
                  🏷️ Diskon (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={diskon || ''}
                  onChange={(e) => setDiskon(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="text-xs w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-accent focus:bg-white text-slate-700 font-sans"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-dashed border-slate-200 my-1"></div>

          {/* NET PRICE LARGE DISPLAY BLOCK */}
          <div className="bg-[#fffbeb] border-1.5 border-[#fef3c7] p-4 rounded-xl flex flex-col items-center justify-center text-center shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest select-none">
              Total Tagihan Pembayaran
            </span>
            <span className="text-2xl font-black font-display text-primary mt-1">
              Rp {getTotal().toLocaleString('id-ID')}
            </span>
          </div>

          {/* INCOMING PAYMENT INPUTS */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 block select-none">
                  💳 Metode Bayar
                </label>
                <select
                  value={metode}
                  onChange={(e) => {
                    setMetode(e.target.value);
                    setUangDiterima(0);
                    setDpDiterima(0);
                  }}
                  className="text-xs w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-accent focus:bg-white transition-all text-slate-700 font-sans"
                >
                  <option value="Tunai">💵 Tunai</option>
                  <option value="Transfer">📱 Transfer</option>
                  <option value="QRIS">📲 QRIS</option>
                  <option value="Kartu Debit">💳 Kartu Debit</option>
                  <option value="Kartu Kredit">💎 Kartu Kredit</option>
                  <option value="DP">🏷️ DP (Uang Muka)</option>
                  <option value="Belum Dibayar">⏳ Belum Dibayar</option>
                </select>
              </div>

              {metode !== 'Belum Dibayar' && (
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 block select-none">
                    {metode === 'DP' ? '💵 Jumlah DP Diterima' : '💵 Uang Diterima'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Nilai uang received..."
                    value={metode === 'DP' ? dpDiterima || '' : uangDiterima || ''}
                    onChange={(e) => {
                      const v = Math.max(0, parseInt(e.target.value) || 0);
                      if (metode === 'DP') setDpDiterima(v);
                      else setUangDiterima(v);
                    }}
                    className="text-xs w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-accent focus:bg-white text-slate-700 font-sans"
                  />
                </div>
              )}
            </div>

            {/* REACTIVE CHANGE & STATUS TAGS DISPLAY */}
            {metode !== 'Belum Dibayar' && currentUangDiterima > 0 && (
              <div
                className={`py-2.5 px-3 border rounded-xl text-center font-bold text-xs flex items-center justify-center gap-2 transform transition-all duration-300 ${
                  netChangeOrDue >= 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                {netChangeOrDue >= 0 ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      {metode === 'DP' ? 'Sisa Tagihan Lunas (Kembalian Pas):' : 'Kembalian:'}{' '}
                      <b className="font-mono text-sm">Rp {netChangeOrDue.toLocaleString('id-ID')}</b>
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>
                      {metode === 'DP' ? 'Sisa Pembayaran Pre-Order:' : 'Kurang Berbayar:'}{' '}
                      <b className="font-mono text-sm">Rp {Math.abs(netChangeOrDue).toLocaleString('id-ID')}</b>
                    </span>
                  </>
                )}
              </div>
            )}

            {metode === 'Belum Dibayar' && (
              <div className="py-2.5 px-3 border border-indigo-100 bg-indigo-50/50 rounded-xl text-indigo-700 text-center font-semibold text-xs flex items-center justify-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-500" />
                <span>Pelunasan dilakukan saat pengambilan barang / pesanan selesai</span>
              </div>
            )}
          </div>

          <div className="space-y-2 mt-2">
            {/* ACTION CHECKOUT */}
            <button
              onClick={checkout}
              className="w-full py-3 bg-[#10b981] hover:bg-[#10b981]/90 text-white rounded-full text-xs md:text-sm font-bold shadow-md cursor-pointer tracking-wider transition-all uppercase flex items-center justify-center gap-2 active:scale-98"
            >
              <ShoppingCart className="w-4 h-4" />
              Selesaikan &amp; Cetak Nota
            </button>

            {/* ACCESSIBLE EXTRAS ROW */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={downloadNotaJPG}
                className="py-2.5 bg-white border-2 border-[#2563eb] hover:bg-slate-50 text-[#2563eb] font-bold text-xs rounded-full shadow-3xs cursor-pointer transition-colors flex items-center justify-center gap-1.5 active:scale-98"
              >
                <Download className="w-3.5 h-3.5" />
                Download JPG
              </button>
              <button
                onClick={shareNota}
                className="py-2.5 bg-white border-2 border-[#7c3aed] hover:bg-slate-50 text-[#7c3aed] font-bold text-xs rounded-full shadow-3xs cursor-pointer transition-colors flex items-center justify-center gap-1.5 active:scale-98"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share WA/Nota
              </button>
            </div>

            {/* RESET BUTTON */}
            <button
              onClick={resetAll}
              className="w-full py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 font-semibold text-xs rounded-full cursor-pointer transition-colors flex items-center justify-center gap-1.5 active:scale-98"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Transaksi Baru
            </button>
          </div>
        </section>
        </div>
        )}

        {activeTab === 'products' && (
          <div className="animate-fadeIn pb-12 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-display font-bold text-slate-900 tracking-tight text-lg flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-primary animate-pulse" />
                  Manajemen Produk &amp; Stok Gudang
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Tambahkan, edit, dan hapus rincian produk serta stok fisik langsung terpantul ke Google Sheets.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => loadProducts(false)}
                  disabled={loading}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-full flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer select-none"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Segarkan Data
                </button>
                <button
                  onClick={() => {
                    setEditingProduct(null);
                    setProdFormNama('');
                    setProdFormUkuran('');
                    setProdFormKategori('Umum');
                    setProdFormHarga(0);
                    setProdFormFoto('');
                    setProdFormStok(100);
                    setShowProductForm(true);
                  }}
                  className="py-2.5 px-5 bg-primary hover:bg-secondary text-white font-bold text-xs rounded-full flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer select-none"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Produk Baru
                </button>
              </div>
            </div>

            {/* PRODUCT FORM CARD */}
            {showProductForm && (
              <div className="bg-slate-50 rounded-2xl border-2 border-primary/20 p-5 shadow-xs animate-fadeIn space-y-4">
                <div className="flex justify-between items-center pb-2 border-b">
                  <h4 className="font-display font-semibold text-slate-950 text-sm flex items-center gap-1.5">
                    {editingProduct ? '📝 Edit Data Produk' : '✨ Tambah Katalog Produk'}
                  </h4>
                  <button 
                    onClick={() => {
                      setShowProductForm(false);
                      setEditingProduct(null);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-650 rounded-full hover:bg-slate-150 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {/* Nama */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-550 uppercase tracking-wider block">Nama Produk</label>
                    <input
                      type="text"
                      placeholder="Contoh: Replika Besar, Kosan Bulat..."
                      value={prodFormNama}
                      onChange={(e) => setProdFormNama(e.target.value)}
                      className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-accent"
                    />
                  </div>
                  {/* Ukuran */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-550 uppercase tracking-wider block">Spesifikasi Ukuran</label>
                    <input
                      type="text"
                      placeholder="Contoh: 40x40, Set, 47x42..."
                      value={prodFormUkuran}
                      onChange={(e) => setProdFormUkuran(e.target.value)}
                      className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-accent"
                    />
                  </div>
                  {/* Kategori */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-550 uppercase tracking-wider block">Kategori</label>
                    <input
                      type="text"
                      list="category-suggestions"
                      placeholder="Contoh: Makanan, Minuman, Pakaian, dll..."
                      value={prodFormKategori}
                      onChange={(e) => setProdFormKategori(e.target.value)}
                      className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-accent font-semibold text-slate-800"
                    />
                    <datalist id="category-suggestions">
                      {Array.from(new Set([
                        ...products.map(p => p.kategori).filter(Boolean),
                        'Makanan', 'Minuman', 'Pakaian', 'Aksesoris', 'Elektronik', 'Jasa'
                      ])).map((cat, i) => (
                        <option key={i} value={cat} />
                      ))}
                    </datalist>
                  </div>
                  {/* Harga */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-550 uppercase tracking-wider block">Harga Jual (Rp)</label>
                    <input
                      type="number"
                      placeholder="Contoh: 90000"
                      value={prodFormHarga || ''}
                      onChange={(e) => setProdFormHarga(Number(e.target.value))}
                      className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-accent"
                    />
                  </div>
                  {/* Stok */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-550 uppercase tracking-wider block">Stok Gudang (Pcs)</label>
                    <input
                      type="number"
                      placeholder="Contoh: 50"
                      value={prodFormStok !== undefined ? prodFormStok : ''}
                      onChange={(e) => setProdFormStok(Number(e.target.value))}
                      className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-accent"
                    />
                  </div>
                  {/* Link Foto */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-550 uppercase tracking-wider block">URL Tautan Gambar</label>
                    <input
                      type="text"
                      placeholder="Contoh: https://drive.google.com/uc?export=view&id=..."
                      value={prodFormFoto}
                      onChange={(e) => setProdFormFoto(e.target.value)}
                      className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t">
                  <button
                    onClick={() => {
                      setShowProductForm(false);
                      setEditingProduct(null);
                    }}
                    className="py-1.5 px-4 bg-white border border-slate-200 rounded-full text-xs font-semibold text-slate-500 hover:bg-slate-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    onClick={async () => {
                      const namaVal = String(prodFormNama || '').trim();
                      const ukuranVal = String(prodFormUkuran || '').trim();
                      if (!namaVal || !ukuranVal) {
                        triggerToast('Nama produk & ukuran wajib diisi!', 'warning');
                        return;
                      }
                      const payload = {
                        nama: namaVal,
                        ukuran: ukuranVal,
                        kategori: String(prodFormKategori || ''),
                        harga: Number(prodFormHarga),
                        foto: prodFormFoto || 'https://images.unsplash.com/photo-1582139329536-e7284fece509?q=80&w=300',
                        stok: Number(prodFormStok),
                      };

                      let success = false;
                      if (editingProduct) {
                        success = await editProductInSheet({
                          ...editingProduct,
                          ...payload
                        });
                      } else {
                        success = await addProductToSheet(payload);
                      }

                      if (success) {
                        setShowProductForm(false);
                        setEditingProduct(null);
                      }
                    }}
                    className="py-1.5 px-5 bg-primary text-white font-bold rounded-full text-xs hover:bg-secondary active:scale-95 transition-all cursor-pointer"
                  >
                    {editingProduct ? 'Perbarui Produk' : 'Simpan Produk'}
                  </button>
                </div>
              </div>
            )}

            {/* DATA TABLE */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 bg-slate-50/50 border-b flex justify-between items-center">
                <span className="font-semibold text-slate-800 text-xs">Total Data Katalog: {products.length} Items</span>
                {(!SHEET_API_URL || SHEET_API_URL.trim() === '' || SHEET_API_URL.includes('PASTE_YOUR_URL')) && (
                  <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-100 font-bold px-2 py-0.5 rounded-full uppercase">
                    Model Offline / Lokal
                  </span>
                )}
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/50 text-slate-500 font-bold border-b select-none whitespace-nowrap">
                      <th className="p-3 text-center w-14">Preview</th>
                      <th className="p-3">Nama Produk</th>
                      <th className="p-3">Kategori</th>
                      <th className="p-3">Ukuran</th>
                      <th className="p-3 text-right">Harga Jual</th>
                      <th className="p-3 text-center">Stok Fisik</th>
                      <th className="p-3 text-center">Aksi Operasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          Tidak ada produk di sini. Daftarkan produk baru atau beralih ke Mode Excel.
                        </td>
                      </tr>
                    ) : (
                      products.map((p, index) => (
                        <tr key={index} className="hover:bg-slate-50/80 border-b text-slate-700">
                          <td className="p-3 text-center">
                            <img
                              src={p.foto}
                              alt={p.nama}
                              className="w-9 h-9 object-cover rounded-lg border inline bg-slate-50"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1582139329536-e7284fece509?q=80&w=300';
                              }}
                            />
                          </td>
                          <td className="p-3 font-semibold text-slate-900">{p.nama}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border text-[10px] font-sans font-medium">
                              {p.kategori}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-500">{p.ukuran}</td>
                          <td className="p-3 text-right font-bold text-emerald-600 font-mono">
                            Rp {p.harga.toLocaleString('id-ID')}
                          </td>
                          <td className="p-3 text-center font-bold">
                            <span className={`px-2.5 py-1 rounded-md text-[11px] font-mono leading-none inline-block ${
                              p.stok !== undefined && p.stok <= 0
                                ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                : p.stok !== undefined && p.stok < 10
                                ? 'bg-amber-50 text-amber-700 border border-amber-100 animate-pulse'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            }`}>
                              {p.stok !== undefined ? `${p.stok} Pcs` : '100 Pcs'}
                            </span>
                          </td>
                          <td className="p-3 text-center space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setEditingProduct(p);
                                setProdFormNama(p.nama !== undefined && p.nama !== null ? String(p.nama) : '');
                                setProdFormUkuran(p.ukuran !== undefined && p.ukuran !== null ? String(p.ukuran) : '');
                                setProdFormKategori(p.kategori !== undefined && p.kategori !== null ? String(p.kategori) : 'Umum');
                                setProdFormHarga(p.harga !== undefined && p.harga !== null ? Number(p.harga) : 0);
                                setProdFormFoto(p.foto !== undefined && p.foto !== null ? String(p.foto) : '');
                                setProdFormStok(p.stok !== undefined && p.stok !== null ? Number(p.stok) : 100);
                                setShowProductForm(true);
                              }}
                              className="px-2.5 py-1 rounded-full border border-amber-250 text-amber-750 bg-amber-50 hover:bg-amber-100 cursor-pointer inline-flex items-center text-[10px] font-bold active:scale-95 transition-all"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteProductFromSheet(p)}
                              className="px-2.5 py-1 rounded-full border border-rose-250 text-rose-750 bg-rose-50 hover:bg-rose-100 cursor-pointer inline-flex items-center text-[10px] font-bold active:scale-95 transition-all"
                            >
                              Hapus
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="animate-fadeIn pb-12 space-y-6">
            {/* Header / Actions Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-display font-bold text-slate-900 tracking-tight text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Laporan &amp; Analisis Real-Time Google Sheets
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Data disinkronisasikan langsung dari tautan lembar sebar publik Google Sheets Anda.
                </p>
              </div>
              <button
                onClick={fetchGoogleSheetReports}
                disabled={reportsLoading}
                className="py-2.5 px-5 bg-primary hover:bg-secondary text-white font-bold text-xs rounded-full flex items-center justify-center gap-2 active:scale-95 transition-all self-start md:self-auto cursor-pointer"
              >
                {reportsLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                Sinkronkan Laporan
              </button>
            </div>

            {reportsLoading && sheetRows.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm gap-2 bg-white rounded-2xl border border-slate-200 shadow-3xs">
                <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                <span>Mengunduh data Google Sheet...</span>
              </div>
            ) : reportsError && sheetRows.length === 0 ? (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-6 text-center space-y-3">
                <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto animate-bounce" />
                <h4 className="font-bold text-sm">Gagal Sinkronisasi</h4>
                <p className="text-xs max-w-md mx-auto">{reportsError}</p>
                <div className="text-[11px] text-slate-500">
                  Pastikan tautan Google Sheet Anda sudah diatur ke Publik (File &gt; Bagikan &gt; Siapa saja dapat melihat dengan link).
                </div>
              </div>
            ) : (
              <>
                {/* METRICS Bento Grid Block */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Total Sales (Omset) */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-3xs flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-650 flex items-center justify-center text-xl shadow-xs">💵</div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block select-none">Omset Penjualan</span>
                      <span className="text-base font-black font-display text-slate-900">
                        Rp {stats.totalSales.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  {/* Transaction Counts */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-3xs flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-650 flex items-center justify-center text-xl shadow-xs">📦</div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block select-none">Total Transaksi</span>
                      <span className="text-lg font-black font-display text-slate-900">
                        {stats.transactionCount} Transaksi
                      </span>
                    </div>
                  </div>

                  {/* Avg Order Values */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-3xs flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-650 flex items-center justify-center text-xl shadow-xs">📈</div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block select-none">Rata-Rata Nota</span>
                      <span className="text-base font-black font-display text-slate-900">
                        Rp {stats.averageOrder.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  {/* Produk Terlaris Stats Card */}
                  <div className="bg-white rounded-2xl border border-slate-205 p-5 shadow-3xs flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-650 flex items-center justify-center text-xl shadow-xs">🏆</div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block select-none">Produk Terlaris</span>
                      <span className="text-sm font-black font-display text-slate-900 truncate max-w-[125px] block" title={stats.productStats[0]?.name}>
                        {stats.productStats[0]?.name || '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* CHARTS CONTAINER GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Sales trend chart using interactive and beautiful pure SVGs */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                    <h4 className="font-display font-bold text-slate-900 text-sm flex items-center justify-between border-b border-slate-50 pb-2">
                      <span className="flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-emerald-550" />
                        Tren Penjualan Harian (Line Chart)
                      </span>
                      {chartHoverIdx !== null && stats.dailyTrends.length > 0 && (
                        <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-150 animate-fadeIn">
                          { [...stats.dailyTrends].reverse()[chartHoverIdx]?.date }: <b>Rp { [...stats.dailyTrends].reverse()[chartHoverIdx]?.sales.toLocaleString('id-ID') }</b>
                        </span>
                      )}
                    </h4>
                    {stats.dailyTrends.length === 0 ? (
                      <div className="h-56 flex items-center justify-center text-xs text-slate-400">Tidak ada data tren</div>
                    ) : (
                      <div className="pt-2 relative">
                        {/* Interactive Responsive SVG Line Chart */}
                        <div className="w-full h-56">
                          {(() => {
                            const chronTrends = [...stats.dailyTrends].reverse();
                            const maxSalesVal = Math.max(...chronTrends.map(t => t.sales)) || 10000;
                            const yAxisMax = Math.ceil((maxSalesVal * 1.15) / 10000) * 10000 || 10000;
                            
                            const paddingLeft = 60;
                            const paddingRight = 15;
                            const paddingTop = 15;
                            const paddingBottom = 40;
                            const innerWidth = 500 - paddingLeft - paddingRight;
                            const innerHeight = 220 - paddingTop - paddingBottom;

                            const points = chronTrends.map((trend, idx) => {
                              const x = paddingLeft + (idx / (chronTrends.length - 1 || 1)) * innerWidth;
                              const y = paddingTop + innerHeight - (trend.sales / yAxisMax) * innerHeight;
                              return { x, y, date: trend.date, sales: trend.sales };
                            });

                            const linePathD = points.length > 0
                              ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
                              : '';
                            
                            const areaPathD = points.length > 0
                              ? `${linePathD} L ${points[points.length - 1].x} ${paddingTop + innerHeight} L ${points[0].x} ${paddingTop + innerHeight} Z`
                              : '';

                            const gridLevels = [0, 0.25, 0.5, 0.75, 1];

                            return (
                              <svg viewBox="0 0 500 220" className="w-full h-full overflow-visible select-none" style={{ minHeight: '220px' }}>
                                <defs>
                                  <linearGradient id="salesTrendGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                                  </linearGradient>
                                </defs>

                                {/* Gridlines and Y-Axis Labels */}
                                {gridLevels.map((lvl, index) => {
                                  const gridY = paddingTop + innerHeight - lvl * innerHeight;
                                  const gridVal = lvl * yAxisMax;
                                  let formattedVal = '';
                                  if (gridVal >= 1000000) {
                                    formattedVal = `${(gridVal / 1000000).toFixed(1).replace('.0', '')}jt`;
                                  } else if (gridVal >= 1000) {
                                    formattedVal = `${(gridVal / 1000).toFixed(0)}rb`;
                                  } else {
                                    formattedVal = `${gridVal}`;
                                  }
                                  
                                  return (
                                    <g key={index}>
                                      <line 
                                        x1={paddingLeft} 
                                        y1={gridY} 
                                        x2={500 - paddingRight} 
                                        y2={gridY} 
                                        stroke="#f1f5f9" 
                                        strokeWidth="1.5"
                                        strokeDasharray={index === 0 ? "none" : "3 3"}
                                      />
                                      <text 
                                        x={paddingLeft - 8} 
                                        y={gridY + 3.5} 
                                        textAnchor="end" 
                                        className="fill-slate-400 font-mono text-[9px] font-medium"
                                      >
                                        Rp {formattedVal}
                                      </text>
                                    </g>
                                  );
                                })}

                                {/* Area Fill */}
                                {areaPathD && (
                                  <path d={areaPathD} fill="url(#salesTrendGradient)" className="transition-all duration-300" />
                                )}

                                {/* Line Path */}
                                {linePathD && (
                                  <path 
                                    d={linePathD} 
                                    fill="none" 
                                    stroke="#10b981" 
                                    strokeWidth="2.5" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round"
                                    className="transition-all duration-300"
                                  />
                                )}

                                {/* X-Axis date labels */}
                                {chronTrends.map((trend, idx) => {
                                  const x = paddingLeft + (idx / (chronTrends.length - 1 || 1)) * innerWidth;
                                  const y = paddingTop + innerHeight;
                                  const labelText = trend.date.split(/\s+/).slice(0, 2).join(' '); // simplify tag, e.g. "23 Mei"
                                  return (
                                    <g key={idx}>
                                      <line x1={x} y1={y} x2={x} y2={y + 4} stroke="#e2e8f0" strokeWidth="1.5" />
                                      <text 
                                        x={x} 
                                        y={y + 12} 
                                        textAnchor="middle" 
                                        className="fill-slate-500 font-sans text-[8px] font-semibold"
                                        transform={`rotate(-28, ${x}, ${y + 12})`}
                                      >
                                        {labelText}
                                      </text>
                                    </g>
                                  );
                                })}

                                {/* Interactive Hovers */}
                                {points.map((pt, idx) => {
                                  const isCurrentlyHovered = chartHoverIdx === idx;
                                  return (
                                    <g 
                                      key={idx}
                                      onMouseEnter={() => setChartHoverIdx(idx)}
                                      onMouseLeave={() => setChartHoverIdx(null)}
                                      className="cursor-pointer"
                                    >
                                      {isCurrentlyHovered && (
                                        <>
                                          {/* Vertical projection guideline */}
                                          <line 
                                            x1={pt.x} 
                                            y1={paddingTop} 
                                            x2={pt.x} 
                                            y2={paddingTop + innerHeight} 
                                            stroke="#10b981" 
                                            strokeOpacity="0.25"
                                            strokeWidth="1" 
                                            strokeDasharray="2 2"
                                          />
                                          {/* Active pulse aura */}
                                          <circle cx={pt.x} cy={pt.y} r="8" className="fill-emerald-400/25 transition-all duration-150" />
                                        </>
                                      )}
                                      {/* Point Marker */}
                                      <circle 
                                        cx={pt.x} 
                                        cy={pt.y} 
                                        r={isCurrentlyHovered ? "5" : "3.5"} 
                                        className="fill-white stroke-emerald-500 stroke-2 transition-all duration-150" 
                                      />
                                      {/* Broad invisible touch/hover hit box */}
                                      <circle cx={pt.x} cy={pt.y} r="14" className="fill-transparent stroke-none" />
                                    </g>
                                  );
                                })}
                              </svg>
                            );
                          })()}
                        </div>
                        <div className="flex justify-center gap-4 text-[10px] text-slate-400 font-semibold select-none pt-2.5">
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Sumbu Vertikal: Omset (Rupiah)</span>
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-emerald-500 inline-block border-t border-dashed" /> Sorot titik untuk melihat nilai detail</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Popular items distribution using visual statistics rails */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                    <h4 className="font-display font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-50 pb-2">
                      <ShoppingBag className="w-4 h-4 text-primary" />
                      Produk Terlaris & Populer
                    </h4>
                    {stats.productStats.length === 0 ? (
                      <div className="h-56 flex items-center justify-center text-xs text-slate-400">Tidak ada data produk terjual</div>
                    ) : (
                      <div className="space-y-4 pt-1 max-h-[250px] overflow-y-auto pr-1">
                        {stats.productStats.map((item, index) => {
                          const maxCount = Math.max(...stats.productStats.map(p => p.count)) || 1;
                          const percentage = (item.count / maxCount) * 100;
                          return (
                            <div key={index} className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs font-semibold">
                                <div className="flex items-center gap-2">
                                  <span className="w-4 h-4 rounded-full bg-slate-100 border border-slate-200 text-[10px] text-slate-600 flex items-center justify-center font-bold">{index + 1}</span>
                                  <span className="text-slate-800 font-bold truncate max-w-[190px]" title={item.name}>{item.name}</span>
                                </div>
                                <span className="text-primary font-black flex-shrink-0 text-right">
                                  {item.count} pcs <span className="text-slate-400 text-[10px] font-medium ml-1.5">(Rp {item.revenue.toLocaleString('id-ID')})</span>
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                <div 
                                  className="bg-primary h-full rounded-full transition-all duration-1000" 
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* HISTORICAL TRANSACTIONS TABLE GRID */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  {/* Table title with clean search option */}
                  <div className="p-4 md:p-5 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h3 className="font-display font-bold text-slate-900 tracking-tight text-sm flex items-center gap-2">
                      <Search className="w-4 h-4 text-primary animate-pulse" />
                      Rincian Transaksi Tersimpan ({filteredSheetRows.length} Baris)
                    </h3>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Cari transaksi, pelanggan, dll..."
                        value={reportsSearchQuery}
                        onChange={(e) => setReportsSearchQuery(e.target.value)}
                        className="w-full py-1.5 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-full text-xs transition-colors focus:outline-none focus:border-accent focus:bg-white focus:ring-1 focus:ring-accent font-sans"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-55 border-b border-slate-200 text-slate-500 font-bold select-none whitespace-nowrap">
                          <th className="p-3">No Transaksi</th>
                          <th className="p-3">Tanggal</th>
                          <th className="p-3">Nama Pelanggan</th>
                          <th className="p-3">Metode</th>
                          <th className="p-3">Items / Produk</th>
                          <th className="p-3 text-right">Total Tagihan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSheetRows.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-slate-400">Tidak ada transaksi yang ditemukan</td>
                          </tr>
                        ) : (
                          filteredSheetRows.map((row, index) => {
                            const transactionNo = getNoTransaksi(row);
                            const tgl = getTanggal(row);
                            const customerName = getNama(row);
                            const payMethod = getMetode(row);
                            const totalVal = getTotalVal(row);
                            const productsList = getItems(row);
                            const formattedItems = formatItemsList(productsList);

                            return (
                              <tr key={index} className="hover:bg-slate-50 border-b border-slate-100 text-slate-705">
                                <td className="p-3 font-mono font-bold text-primary">{transactionNo || `-`}</td>
                                <td className="p-3 font-mono">{tgl}</td>
                                <td className="p-3 font-bold text-slate-800">{customerName || `-`}</td>
                                <td className="p-3">
                                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                                    {payMethod || `Tunai`}
                                  </span>
                                </td>
                                <td className="p-3 max-w-[200px] truncate" title={formattedItems}>
                                  {formattedItems || `-`}
                                </td>
                                <td className="p-3 text-right font-black text-slate-900 font-mono">
                                  Rp {parseCurrency(totalVal).toLocaleString('id-ID')}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="animate-fadeIn pb-12">
            <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="font-display font-bold text-slate-900 tracking-tight text-lg flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  Pengaturan Kustomisasi Toko
                </h3>
                <p className="text-xs text-slate-505 mt-1">
                  Atur informasi identitas toko Anda. Data ini akan ditampilkan pada Nota Pembayaran / Cetakan.
                </p>
              </div>

              <div className="space-y-4">
                {/* Logo Toko */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-2 font-sans select-none">Logo Toko</label>
                  <div className="flex items-center gap-4">
                    {tempLogo && tempLogo !== 'ts.png' ? (
                      <img src={tempLogo} alt="Logo" className="w-16 h-16 rounded-full object-cover border-2 border-accent shadow-xs bg-slate-50" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xl border font-sans select-none shadow-3xs">{tempName.substring(0, 2).toUpperCase()}</div>
                    )}
                    <div className="flex-1">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setTempLogo(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-accent/10 file:text-accent hover:file:bg-accent/20 cursor-pointer"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Format gambar JPG, PNG. Maksimal 1MB.</p>
                    </div>
                  </div>
                </div>

                {/* Nama Toko */}
                <div>
                  <label className="text-xs font-bold text-slate-705 block mb-1 font-sans">Nama Toko</label>
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="w-full text-xs p-3 bg-slate-50 border border-slate-205 rounded-xl focus:outline-none focus:border-accent focus:bg-white text-slate-800 font-bold uppercase"
                    placeholder="Contoh: TS SANGKAR"
                  />
                </div>

                {/* Slogan Toko */}
                <div>
                  <label className="text-xs font-bold text-slate-705 block mb-1 font-sans">Slogan Toko</label>
                  <input
                    type="text"
                    value={tempSlogan}
                    onChange={(e) => setTempSlogan(e.target.value)}
                    className="w-full text-xs p-3 bg-slate-50 border border-slate-205 rounded-xl focus:outline-none focus:border-accent focus:bg-white text-slate-700 font-medium"
                    placeholder="Contoh: Ahlinya Sangkar Burung Mentah Berkualitas"
                  />
                </div>

                {/* Alamat & Kontak Toko */}
                <div>
                  <label className="text-xs font-bold text-slate-705 block mb-1 font-sans">Alamat & Nomor Telepon</label>
                  <input
                    type="text"
                    value={tempAlamat}
                    onChange={(e) => setTempAlamat(e.target.value)}
                    className="w-full text-xs p-3 bg-slate-50 border border-slate-205 rounded-xl focus:outline-none focus:border-accent focus:bg-white text-slate-705 font-medium"
                    placeholder="Contoh: tssangkar.github.io | 0851-1960-6906"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    handleSaveStoreConfig(tempName, tempSlogan, tempAlamat, tempLogo);
                  }}
                  className="flex-1 py-3 bg-accent hover:bg-accent/90 text-white font-bold text-xs rounded-full transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer hover:shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Simpan Perubahan
                </button>
                <button
                  onClick={() => {
                    setTempName('KASIR PINTAR');
                    setTempSlogan('Sistem Kasir Fleksibel Multi-Fungsi');
                    setTempAlamat('🌐 santridev.github.io | 📞 0812-3456-7890');
                    setTempLogo('store.png');
                    handleSaveStoreConfig('KASIR PINTAR', 'Sistem Kasir Fleksibel Multi-Fungsi', '🌐 santridev.github.io | 📞 0812-3456-7890', 'store.png');
                  }}
                  className="py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-full transition-all cursor-pointer"
                >
                  Set Default
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER BAR */}
      <footer className="bg-slate-900 text-slate-500 py-4 text-center text-xs border-t border-slate-850 select-none">
        <p>Copyright &copy; 2026 {storeNameState}. Developed by Santri Dev. All rights reserved.</p>
        <p className="text-[10px] text-slate-600 mt-1">Made with premium modern technologies &amp; responsive grids.</p>
      </footer>

      {/* TOAST SYSTEM */}
      {showToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white py-3 px-5 rounded-full shadow-xl flex items-center gap-2 text-xs font-semibold animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-accent" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS PRODUK (AMAN DARI IFRAME SANDBOX) */}
      {deleteConfirmProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center gap-3.5 pb-2 border-b border-rose-100">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="font-display font-bold text-slate-900 text-sm">
                  Konfirmasi Hapus Produk
                </h3>
                <p className="text-[11px] text-slate-450 mt-0.5">
                  Tindakan ini tidak dapat dibatalkan di Google Sheets.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-xs space-y-2 font-medium">
              <div className="flex justify-between">
                <span className="text-slate-400">ID Produk:</span>
                <span className="font-mono font-bold text-slate-800">{deleteConfirmProduct.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Nama Produk:</span>
                <span className="font-bold text-slate-800">{deleteConfirmProduct.nama}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Spesifikasi Ukuran:</span>
                <span className="font-semibold text-slate-705">{deleteConfirmProduct.ukuran || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Kategori:</span>
                <span className="font-semibold text-slate-705">{deleteConfirmProduct.kategori || '-'}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Apakah Anda yakin ingin menghapus produk ini secara permanen dari database?
            </p>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => {
                  setDeleteConfirmProduct(null);
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-full transition-all cursor-pointer active:scale-95"
              >
                Batal
              </button>
              <button
                onClick={() => executeDeleteProduct(deleteConfirmProduct)}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-full transition-all flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Ya, Hapus Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DIALOG PREVIEW DEBUGGING ALERT (GANTI WINDOW.ALERT DI IFRAME) */}
      {deleteDebugLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-150">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg text-[10px] font-bold leading-none ${
                  deleteDebugHeader.includes('SUKSES') 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : deleteDebugHeader.includes('BATAL')
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {deleteDebugHeader}
                </div>
                <h3 className="font-display font-bold text-slate-900 text-sm">
                  Log Informasi Aktivitas
                </h3>
              </div>
              <button
                onClick={() => setDeleteDebugLog(null)}
                className="p-1 text-slate-400 hover:text-slate-650 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Metode Debug Tracker:</p>
              <pre className="bg-slate-950 text-slate-100 text-[10px] p-4 rounded-xl border border-slate-800 overflow-x-auto whitespace-pre-wrap font-mono max-h-72 leading-relaxed shadow-inner">
                {deleteDebugLog}
              </pre>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setDeleteDebugLog(null)}
                className="py-2 px-6 bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs rounded-full transition-all cursor-pointer active:scale-95"
              >
                Tutup Debug
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
