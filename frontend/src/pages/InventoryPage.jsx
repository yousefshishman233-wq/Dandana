import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { inventoryAPI, expensesAPI } from '../services/api';

const DISCOUNT = 0.25;

const ICE_CREAM_PRODUCTS = [
  { name: 'بوله واحدة', price: 20, emoji: '🍦' },
  { name: 'بوله اتنين', price: 35, emoji: '🍦🍦' },
  { name: 'بوله تلاتة', price: 60, emoji: '🍧' },
  { name: 'بوله أربعة', price: 75, emoji: '🍨' },
  { name: 'نص كيلو', price: 110, emoji: '🧊' },
  { name: 'بسكوته فاضية', price: 3, emoji: '🍪' },
];

const InventoryPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' | 'factory' | 'pos'
  const [auditCategory, setAuditCategory] = useState('all'); // 'all' | 'ice_cream' | 'supplies'

  const [products, setProducts] = useState([]);
  const [auditItems, setAuditItems] = useState([]);
  const [auditCounts, setAuditCounts] = useState({}); // { itemName: number }
  const [factoryOrderQty, setFactoryOrderQty] = useState({}); // { itemName: number }
  const [factoryOrderNote, setFactoryOrderNote] = useState('');
  const [submittedOrderText, setSubmittedOrderText] = useState('');
  const [pastAudits, setPastAudits] = useState([]);
  const [factoryOrders, setFactoryOrders] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saveAuditLoading, setSaveAuditLoading] = useState(false);
  const [saveAuditMessage, setSaveAuditMessage] = useState('');

  const [factoryLoading, setFactoryLoading] = useState(false);
  const [factoryMessage, setFactoryMessage] = useState('');

  const [cart, setCart] = useState({});
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const [editProduct, setEditProduct] = useState(null);
  const [editPrice, setEditPrice] = useState('');

  // Cashier Drawer & Expenses
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseReason, setExpenseReason] = useState('');
  
  const [salesAmount, setSalesAmount] = useState('');
  const [salesLoading, setSalesLoading] = useState(false);
  
  const [shiftSummary, setShiftSummary] = useState(null);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseMessage, setExpenseMessage] = useState('');

  // Add new audit item state
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('ice_cream');
  const [newItemUnit, setNewItemUnit] = useState('جالون');
  const [addItemLoading, setAddItemLoading] = useState(false);
  const [addItemMessage, setAddItemMessage] = useState('');

  // Factory order recipient state
  const [orderRecipient, setOrderRecipient] = useState('driver');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [prodRes, itemRes, auditRes, orderRes] = await Promise.allSettled([
        inventoryAPI.getProducts(),
        inventoryAPI.getAuditItems(),
        inventoryAPI.getAudits(),
        inventoryAPI.getFactoryOrders(),
      ]);

      if (prodRes.status === 'fulfilled' && prodRes.value.data.success) {
        setProducts(prodRes.value.data.products || []);
      }
      if (itemRes.status === 'fulfilled' && itemRes.value.data.success) {
        const fetchedItems = itemRes.value.data.items || [];
        setAuditItems(fetchedItems);

        // Pre-fill initial audit counts with current_stock
        const initialCounts = {};
        fetchedItems.forEach(item => {
          initialCounts[item.name] = item.current_stock || 0;
        });
        setAuditCounts(initialCounts);
      }
      if (auditRes.status === 'fulfilled' && auditRes.value.data.success) {
        setPastAudits(auditRes.value.data.audits || []);
      }
      if (orderRes.status === 'fulfilled' && orderRes.value.data.success) {
        setFactoryOrders(orderRes.value.data.orders || []);
      }

      if (user?.role === 'cashier') {
        const expensesRes = await expensesAPI.getShiftSummary();
        if (expensesRes.data.success) {
          setShiftSummary(expensesRes.data);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // ─── Cashier Add Expense ───
  const handleAddExpense = async () => {
    if (!expenseAmount || !expenseReason) {
      setExpenseMessage('⚠️ يرجى إدخال المبلغ والسبب');
      return;
    }
    setExpenseLoading(true);
    try {
      const res = await expensesAPI.addExpense(expenseAmount, expenseReason);
      if (res.data.success) {
        setExpenseMessage('✅ تم تسجيل المصروف بنجاح');
        setExpenseAmount('');
        setExpenseReason('');
        await fetchAllData();
        setTimeout(() => setExpenseMessage(''), 3000);
      }
    } catch (e) {
      setExpenseMessage('⚠️ فشل تسجيل المصروف');
    }
    setExpenseLoading(false);
  };

  // ─── Cashier Add Sales ───
  const handleAddSales = async () => {
    if (!salesAmount) {
      setExpenseMessage('⚠️ يرجى إدخال مبلغ المبيعات');
      return;
    }
    setSalesLoading(true);
    try {
      const res = await expensesAPI.addShiftSales(salesAmount);
      if (res.data.success) {
        setExpenseMessage('✅ تم تسجيل مبيعات الوردية بنجاح');
        setSalesAmount('');
        await fetchAllData();
        setTimeout(() => setExpenseMessage(''), 3000);
      }
    } catch (e) {
      setExpenseMessage('⚠️ فشل تسجيل المبيعات');
    }
    setSalesLoading(false);
  };

  // ─── Create New Inventory Item ───
  const handleCreateAuditItem = async (e) => {
    if (e) e.preventDefault();
    if (!newItemName.trim()) {
      setAddItemMessage('⚠️ يرجى إدخال اسم الصنف');
      return;
    }
    setAddItemLoading(true);
    setAddItemMessage('');
    try {
      const res = await inventoryAPI.addAuditItem({
        name: newItemName.trim(),
        category: newItemCategory,
        unit: newItemUnit.trim() || (newItemCategory === 'ice_cream' ? 'جالون' : 'لفة')
      });
      if (res.data.success) {
        setAddItemMessage('✅ تم إضافة الصنف بنجاح وبشكل دائم!');
        setNewItemName('');
        setShowAddItemForm(false);
        await fetchAllData();
        setTimeout(() => setAddItemMessage(''), 4000);
      }
    } catch (err) {
      setAddItemMessage('⚠️ ' + (err.response?.data?.message || 'حدث خطأ أثناء إضافة الصنف'));
    }
    setAddItemLoading(false);
  };

  // ─── Save Inventory Audit ───
  const handleSaveAudit = async () => {
    setSaveAuditMessage('');
    const itemsToSave = auditItems.map(item => ({
      name: item.name,
      category: item.category,
      counted_qty: Number(auditCounts[item.name]) || 0,
      unit: item.unit,
    }));

    setSaveAuditLoading(true);
    try {
      const res = await inventoryAPI.saveAudit(itemsToSave);
      if (res.data.success) {
        setSaveAuditMessage('✅ تم تسجيل جرد المحل بنجاح وتحديث كميات المخزن!');
        setTimeout(() => setSaveAuditMessage(''), 3000);
        await fetchAllData();
      }
    } catch (e) {
      setSaveAuditMessage('⚠️ ' + (e.response?.data?.message || 'حدث خطأ أثناء الحفظ'));
    }
    setSaveAuditLoading(false);
  };

  // ─── Submit Factory Order ───
  const handleCreateFactoryOrder = async () => {
    setFactoryMessage('');
    const itemsToOrder = Object.entries(factoryOrderQty)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([name, qty]) => {
        const item = auditItems.find(i => i.name === name);
        return {
          item_name: name,
          available_stock: item?.current_stock || 0,
          requested_qty: Number(qty),
          unit: item?.unit || 'كيلو',
        };
      });

    if (itemsToOrder.length === 0) {
      setFactoryMessage('⚠️ يرجى أدخال الكميات المطلوبة من المصنع لأحد الأصناف');
      return;
    }

    setFactoryLoading(true);
    try {
      const res = await inventoryAPI.createFactoryOrder(itemsToOrder, factoryOrderNote, orderRecipient, user?.branch_id);
      if (res.data.success) {
        setFactoryMessage(res.data.message || '✅ تم إرسال طلبية المصنع بنجاح!');
        
        let orderText = `📋 طلبية المصنع (${orderRecipient === 'driver' ? 'موجهة للسائق 🚗' : 'موجهة للمدير 👑'})\n`;
        orderText += `📍 الفرع: ${user?.branch_name || 'الفرع الحالي'}\n`;
        orderText += `👤 الموظف: ${user?.full_name}\n`;
        orderText += `📅 التاريخ والوقت: ${new Date().toLocaleString('ar-EG')}\n\n`;
        itemsToOrder.forEach(i => {
          orderText += `- ${i.item_name}: ${i.requested_qty} ${i.unit}\n`;
        });
        if (factoryOrderNote) orderText += `\nملاحظات: ${factoryOrderNote}`;
        setSubmittedOrderText(orderText);

        setFactoryOrderQty({});
        setFactoryOrderNote('');
        setTimeout(() => setFactoryMessage(''), 4000);
        await fetchAllData();
      }
    } catch (e) {
      setFactoryMessage('⚠️ ' + (e.response?.data?.message || 'فشل إرسال الطلبية'));
    }
    setFactoryLoading(false);
  };

  // ─── Factory Order Status Update (Manager) ───
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      const res = await inventoryAPI.updateFactoryOrderStatus(orderId, newStatus);
      if (res.data.success) {
        await fetchAllData();
      }
    } catch (e) { console.error(e); }
  };

  // ─── POS Sales Order ───
  const cartTotal = Object.entries(cart).reduce((sum, [name, qty]) => {
    const p = ICE_CREAM_PRODUCTS.find(pr => pr.name === name);
    return sum + (p?.price || 0) * qty;
  }, 0);
  const cartAfterDiscount = cartTotal * (1 - DISCOUNT);
  const cartSaving = cartTotal - cartAfterDiscount;

  const handlePlaceOrder = async () => {
    const items = Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([name, qty]) => {
        const p = ICE_CREAM_PRODUCTS.find(pr => pr.name === name);
        return { name, qty, price: p?.price || 0 };
      });
    if (items.length === 0) return;
    setOrderLoading(true);
    try {
      await inventoryAPI.placeOrder(user.id, items);
      setCart({});
      setOrderSuccess(true);
      setTimeout(() => setOrderSuccess(false), 3000);
    } catch (e) { console.error(e); }
    setOrderLoading(false);
  };

  const handleUpdatePrice = async (id) => {
    if (!editPrice || isNaN(editPrice)) return;
    try {
      await inventoryAPI.updateProduct(id, { price: Number(editPrice) });
      setEditProduct(null);
      setEditPrice('');
      await fetchAllData();
    } catch (e) { console.error(e); }
  };

  // Filtered audit items
  const filteredAuditItems = auditItems.filter(item => {
    if (auditCategory === 'ice_cream') return item.category === 'ice_cream';
    if (auditCategory === 'supplies') return item.category === 'supplies';
    return true;
  });

  const iceCreamCount = auditItems.filter(i => i.category === 'ice_cream').length;
  const suppliesCount = auditItems.filter(i => i.category === 'supplies').length;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="animate-fadeInUp flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">📋 جرد المحل وطلبيات المصنع</h1>
          <p style={{ color: 'var(--text-muted)' }} className="text-sm">
            جرد أصناف الآيس كريم والمستلزمات، وربط الجرد بطلب النواقص من المصنع
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex p-1 rounded-2xl gap-1" style={{ background: 'rgba(26,26,53,0.8)', border: '1px solid var(--dark-border)' }}>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'audit' ? 'btn-primary text-white' : ''}`}
            style={activeTab !== 'audit' ? { color: 'var(--text-secondary)' } : {}}
            id="tab-audit"
          >
            📊 جرد المحل
          </button>
          <button
            onClick={() => setActiveTab('factory')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'factory' ? 'btn-primary text-white' : ''}`}
            style={activeTab !== 'factory' ? { color: 'var(--text-secondary)' } : {}}
            id="tab-factory"
          >
            🏭 طلبية المصنع
          </button>
            <button
              onClick={() => setActiveTab('pos')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'pos' ? 'btn-primary text-white' : ''}`}
              style={activeTab !== 'pos' ? { color: 'var(--text-secondary)' } : {}}
              id="tab-pos"
            >
              🍦 قائمة المبيعات (25% خصم)
            </button>
            {user?.role === 'cashier' && (
              <button
                onClick={() => setActiveTab('drawer')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'drawer' ? 'btn-primary text-white' : ''}`}
                style={activeTab !== 'drawer' ? { color: 'var(--text-secondary)' } : {}}
                id="tab-drawer"
              >
                💰 درج الكاشير والمصروفات
              </button>
            )}
          </div>
        </div>

      {/* ─── TAB 1: جرد المحل (SHOP AUDIT) ─── */}
      {activeTab === 'audit' && (
        <div className="space-y-6 animate-fadeInUp">
          {/* Sub-category filter */}
          <div className="flex items-center justify-between flex-wrap gap-3 glass-card-static p-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAuditCategory('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${auditCategory === 'all' ? 'btn-primary text-white' : 'btn-secondary'}`}
              >
                الكل ({auditItems.length})
              </button>
              <button
                onClick={() => setAuditCategory('ice_cream')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${auditCategory === 'ice_cream' ? 'btn-primary text-white' : 'btn-secondary'}`}
              >
                🍨 أصناف الآيس كريم ({iceCreamCount})
              </button>
              <button
                onClick={() => setAuditCategory('supplies')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${auditCategory === 'supplies' ? 'btn-primary text-white' : 'btn-secondary'}`}
              >
                📦 المستلزمات والعلب ({suppliesCount})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddItemForm(!showAddItemForm)}
                className="btn-secondary py-2 px-4 text-xs font-bold flex items-center gap-1.5 border border-accent text-accent hover:bg-accent/10 transition"
              >
                <span>➕</span> {showAddItemForm ? 'إلغاء الإضافة' : 'إضافة صنف جديد'}
              </button>
              <button
                onClick={handleSaveAudit}
                disabled={saveAuditLoading}
                className="btn-primary py-2 px-6 text-sm font-bold flex items-center gap-2"
                id="save-audit-btn"
              >
                <span>💾</span> {saveAuditLoading ? 'جاري حفظ الجرد...' : 'تسجيل وحفظ الجرد'}
              </button>
            </div>
          </div>

          {/* Form for adding a new item */}
          {showAddItemForm && (
            <div className="glass-card-static p-5 border border-accent/40 animate-scaleIn">
              <h3 className="text-sm font-bold mb-3 text-accent flex items-center gap-2">
                <span>➕</span> إضافة صنف جديد للجرد (سيحفظ دائماً بالسيستم)
              </h3>
              
              <form onSubmit={handleCreateAuditItem} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="text-xs font-semibold mb-1 block text-text-secondary">اسم الصنف الجديدة *</label>
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="مثال: بستاشيو كرانشي"
                    className="w-full glass-input p-2.5 text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold mb-1 block text-text-secondary">القسم *</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => {
                      const cat = e.target.value;
                      setNewItemCategory(cat);
                      if (cat === 'ice_cream') setNewItemUnit('جالون');
                      else setNewItemUnit('لفة');
                    }}
                    className="w-full glass-input p-2.5 text-xs bg-dark-bg text-primary"
                  >
                    <option value="ice_cream">🍨 أصناف الآيس كريم</option>
                    <option value="supplies">📦 المستلزمات والعلب والعلب</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold mb-1 block text-text-secondary">وحدة القياس *</label>
                  <input
                    type="text"
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    placeholder="مثال: جالون، لفة، حبة، باكيت"
                    className="w-full glass-input p-2.5 text-xs"
                    required
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={addItemLoading || !newItemName.trim()}
                    className="btn-primary w-full py-2.5 text-xs font-bold"
                  >
                    {addItemLoading ? 'جاري الحفظ...' : 'حفظ الصنف الجديد'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {addItemMessage && (
            <div className="p-3 rounded-xl text-sm font-bold text-center animate-scaleIn"
              style={{
                background: addItemMessage.startsWith('✅') ? 'rgba(0,212,170,0.15)' : 'rgba(255,71,87,0.15)',
                color: addItemMessage.startsWith('✅') ? 'var(--accent)' : '#FF4757',
                border: `1px solid ${addItemMessage.startsWith('✅') ? 'rgba(0,212,170,0.3)' : 'rgba(255,71,87,0.3)'}`
              }}>
              {addItemMessage}
            </div>
          )}

          {saveAuditMessage && (
            <div className="p-3 rounded-xl text-sm font-bold text-center animate-scaleIn"
              style={{
                background: saveAuditMessage.startsWith('✅') ? 'rgba(0,212,170,0.15)' : 'rgba(255,71,87,0.15)',
                color: saveAuditMessage.startsWith('✅') ? 'var(--accent)' : '#FF4757',
                border: `1px solid ${saveAuditMessage.startsWith('✅') ? 'rgba(0,212,170,0.3)' : 'rgba(255,71,87,0.3)'}`
              }}>
              {saveAuditMessage}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16"><div className="spinner" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAuditItems.map((item, i) => {
                const qty = auditCounts[item.name] ?? 0;
                const isIceCream = item.category === 'ice_cream';
                const isAvailable = Number(qty) > 0;

                return (
                  <div key={item.id || item.name}
                    className="glass-card p-4 flex flex-col justify-between transition-all hover:scale-102"
                    style={{
                      border: isAvailable
                        ? '1px solid rgba(0,212,170,0.25)'
                        : '1px solid rgba(255,71,87,0.3)',
                      background: isAvailable
                        ? 'rgba(26,26,53,0.7)'
                        : 'rgba(255,71,87,0.06)'
                    }}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{isIceCream ? '🍧' : '📦'}</span>
                        <div>
                          <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {isIceCream ? 'آيس كريم' : 'مستلزمات'} • بالـ {item.unit}
                          </span>
                        </div>
                      </div>

                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                        style={{
                          background: isAvailable ? 'rgba(0,212,170,0.15)' : 'rgba(255,71,87,0.15)',
                          color: isAvailable ? 'var(--accent)' : '#FF4757'
                        }}>
                        {isAvailable ? `متوفر: ${qty} ${item.unit}` : '⚠️ ناقص / غير متوفر'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2 pt-2 border-t" style={{ borderColor: 'var(--dark-border)' }}>
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>العدد المجرود:</span>
                      <input
                        type="number"
                        value={qty}
                        onChange={e => setAuditCounts(prev => ({ ...prev, [item.name]: e.target.value }))}
                        className="input-dark flex-1 text-center font-bold"
                        style={{ direction: 'ltr', padding: '6px' }}
                        min="0"
                        step="0.5"
                      />
                      <span className="text-xs text-muted font-bold">{item.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Past Audits History */}
          <div className="glass-card-static p-6 mt-8">
            <h2 className="section-header">📜 سجل الجرد السابق</h2>
            {pastAudits.length === 0 ? (
              <p className="text-xs text-muted py-4 text-center">لا يوجد عمليات جرد مسجلة بعد</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto scroll-area">
                {pastAudits.map(a => (
                  <div key={a.id} className="flex justify-between items-center p-3 rounded-xl" style={{ background: 'rgba(26,26,53,0.5)', border: '1px solid var(--dark-border)' }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        📋 جرد بواسطة: {a.user_name} ({a.user_role === 'cashier' ? 'كاشير' : 'موظف'})
                      </p>
                      <p className="text-xs text-muted">📍 الفرع: {a.branch_name || 'الفرع المحدد'}</p>
                    </div>
                    <span className="text-xs text-muted font-mono">{a.created_at}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: طلبية المصنع (FACTORY SUPPLY ORDER) ─── */}
      {activeTab === 'factory' && (
        <div className="space-y-6 animate-fadeInUp">
          <div className="glass-card-static p-6"
            style={{ background: 'linear-gradient(135deg, rgba(108,99,255,0.12), rgba(0,212,170,0.08))', border: '1px solid rgba(108,99,255,0.3)' }}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                  🏭 طلبية المصنع (مربوطة بكميات الجرد الحالية)
                </h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  اطلع على كمية الجرد المتوفرة في المحل حالياً واطلب الكميات الناقصة من المصنع مباشرة
                </p>
              </div>

              <button
                onClick={handleCreateFactoryOrder}
                disabled={factoryLoading}
                className="btn-primary py-2 px-6 text-sm font-bold flex items-center gap-2"
                id="submit-factory-order-btn"
              >
                <span>🚀</span> {factoryLoading ? 'جاري إرسال الطلبية...' : 'إرسال طلبية للمصنع'}
              </button>
            </div>

            {factoryMessage && (
              <div className="mb-4 p-3 rounded-xl text-sm font-bold text-center animate-scaleIn"
                style={{
                  background: factoryMessage.startsWith('✅') ? 'rgba(0,212,170,0.15)' : 'rgba(255,71,87,0.15)',
                  color: factoryMessage.startsWith('✅') ? 'var(--accent)' : '#FF4757',
                  border: `1px solid ${factoryMessage.startsWith('✅') ? 'rgba(0,212,170,0.3)' : 'rgba(255,71,87,0.3)'}`
                }}>
                {factoryMessage}
              </div>
            )}

            {submittedOrderText && (
              <div className="mb-4 p-4 rounded-xl animate-scaleIn" style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid var(--dark-border)' }}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-accent">📄 ملخص الطلبية (جاهز للنسخ):</span>
                  <button 
                    onClick={() => { navigator.clipboard.writeText(submittedOrderText); alert('تم النسخ بنجاح!'); }}
                    className="text-xs px-3 py-1 rounded-lg bg-primary text-white hover:opacity-80 transition"
                  >
                    📋 نسخ الرسالة
                  </button>
                </div>
                <textarea 
                  readOnly 
                  value={submittedOrderText} 
                  className="w-full bg-transparent text-sm text-primary p-2 outline-none resize-none" 
                  rows={submittedOrderText.split('\n').length + 1}
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
            )}

            {/* Recipient & Note input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                  إرسال الطلبية إلى *
                </label>
                <select
                  value={orderRecipient}
                  onChange={e => setOrderRecipient(e.target.value)}
                  className="input-dark w-full font-bold"
                  style={{ border: '1px solid var(--accent)', background: 'rgba(0,212,170,0.08)' }}
                >
                  <option value="driver">🚗 السائق (مباشرة للتوصيل والتنفيذ)</option>
                  <option value="manager">👑 المدير (للاعتماد والتحويل)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                  ملاحظات للطلبية (اختياري)
                </label>
                <input
                  type="text"
                  value={factoryOrderNote}
                  onChange={e => setFactoryOrderNote(e.target.value)}
                  placeholder="مثال: مطلوب التسليم فجر غداً قبل الشيفت الصباحي"
                  className="input-dark w-full"
                />
              </div>
            </div>

            {/* Items list linked to audit stock */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto scroll-area">
              {auditItems.map(item => {
                const avail = item.current_stock || 0;
                const reqQty = factoryOrderQty[item.name] || '';

                return (
                  <div key={item.name} className="p-3 rounded-xl flex flex-col justify-between"
                    style={{ background: 'rgba(26,26,53,0.7)', border: '1px solid var(--dark-border)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{
                          background: avail > 0 ? 'rgba(0,212,170,0.15)' : 'rgba(255,71,87,0.15)',
                          color: avail > 0 ? 'var(--accent)' : '#FF4757'
                        }}>
                        المتوفر بالجرد: {avail} {item.unit}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted">المطلوب من المصنع:</span>
                      <input
                        type="number"
                        value={reqQty}
                        onChange={e => setFactoryOrderQty(prev => ({ ...prev, [item.name]: e.target.value }))}
                        placeholder="0"
                        className="input-dark flex-1 text-center font-bold"
                        style={{ direction: 'ltr', padding: '4px 8px' }}
                        min="0"
                      />
                      <span className="text-xs font-bold text-muted">{item.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Past Factory Orders History */}
          <div className="glass-card-static p-6">
            <h2 className="section-header">📦 سجل طلبيات المصنع ({factoryOrders.length})</h2>

            {factoryOrders.length === 0 ? (
              <p className="text-xs text-muted text-center py-6">لا يوجد طلبيات مصنع سابقة</p>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto scroll-area">
                {factoryOrders.map(fo => {
                  const statusConfig = {
                    pending: { label: '⏳ معلقة بانتظار التنفيذ', color: '#FFB347', bg: 'rgba(255,179,71,0.15)' },
                    approved: { label: '✅ تم الاعتماد وجاري التجهيز', color: 'var(--accent)', bg: 'rgba(0,212,170,0.15)' },
                    delivered: { label: '🚚 تم الاستلام والتوصيل للمحل', color: 'var(--primary-light)', bg: 'rgba(108,99,255,0.15)' },
                    rejected: { label: '❌ مرفوضة', color: '#FF4757', bg: 'rgba(255,71,87,0.15)' },
                  }[fo.status] || { label: fo.status, color: 'white', bg: 'transparent' };

                  const isTargetForDriver = fo.recipient === 'driver';

                  return (
                    <div key={fo.id} className="p-4 rounded-xl space-y-3"
                      style={{ background: 'rgba(26,26,53,0.7)', border: isTargetForDriver ? '1px solid rgba(0,212,170,0.3)' : '1px solid var(--dark-border)' }}>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                              🏭 طلبية # {fo.id} • بواسطة: {fo.user_name}
                            </span>
                            <span className="px-2 py-0.5 rounded text-xs font-bold"
                              style={{
                                background: isTargetForDriver ? 'rgba(0,212,170,0.15)' : 'rgba(255,71,87,0.15)',
                                color: isTargetForDriver ? 'var(--accent)' : '#FF4757'
                              }}>
                              {isTargetForDriver ? '🚗 موجهة للسائق' : '👑 موجهة للمدير'}
                            </span>
                          </div>
                          <p className="text-xs text-muted">
                            📍 الفرع: <strong className="text-accent">{fo.branch_name || 'بدون فرع'}</strong> • 📅 {fo.created_at}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 rounded-full text-xs font-bold"
                            style={{ background: statusConfig.bg, color: statusConfig.color }}>
                            {statusConfig.label}
                          </span>

                          {(user?.role === 'manager' || user?.role === 'driver') && fo.status !== 'delivered' && (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleUpdateOrderStatus(fo.id, 'delivered')}
                                className="px-3 py-1 rounded-lg text-xs font-bold transition"
                                style={{ background: 'rgba(108,99,255,0.25)', color: 'var(--primary-light)', border: '1px solid rgba(108,99,255,0.4)' }}
                              >
                                🚚 تم التوصيل
                              </button>
                              {user?.role === 'manager' && fo.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleUpdateOrderStatus(fo.id, 'approved')}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold"
                                    style={{ background: 'rgba(0,212,170,0.2)', color: 'var(--accent)' }}
                                  >
                                    موافقة
                                  </button>
                                  <button
                                    onClick={() => handleUpdateOrderStatus(fo.id, 'rejected')}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold"
                                    style={{ background: 'rgba(255,71,87,0.2)', color: '#FF4757' }}
                                  >
                                    رفض
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {fo.note && (
                        <p className="text-xs p-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-secondary)' }}>
                          💬 ملاحظة: {fo.note}
                        </p>
                      )}

                      {/* Items table */}
                      {fo.items && fo.items.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-2 border-t" style={{ borderColor: 'var(--dark-border)' }}>
                          {fo.items.map((it, idx) => (
                            <div key={idx} className="p-2 rounded-lg text-xs" style={{ background: 'rgba(108,99,255,0.08)' }}>
                              <p className="font-semibold text-primary">{it.item_name}</p>
                              <p className="text-muted">المتوفر كان: {it.available_stock} {it.unit}</p>
                              <p className="font-bold text-accent">المطلوب: {it.requested_qty} {it.unit}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: قائمة المبيعات والأسعار (POS & SALES) ─── */}
      {activeTab === 'pos' && (
        <div className="space-y-6 animate-fadeInUp">
          {/* Discount Banner */}
          <div className="glass-card-static p-4 flex items-center gap-4"
            style={{ background: 'linear-gradient(135deg, rgba(0,212,170,0.1), rgba(108,99,255,0.1))', border: '1px solid rgba(0,212,170,0.3)' }}>
            <div className="text-4xl animate-float">🏷️</div>
            <div>
              <p className="font-bold text-lg" style={{ color: 'var(--accent)' }}>خصم 25% للموظفين 🎉</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>على جميع أصناف الآيس كريم — يتخصم تلقائي من مرتبك</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Product Grid */}
            <div className="lg:col-span-2">
              <h2 className="section-header">قائمة المنتجات</h2>
              {loading ? (
                <div className="flex justify-center py-16"><div className="spinner" /></div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {ICE_CREAM_PRODUCTS.map((p, i) => {
                    const qty = cart[p.name] || 0;
                    const dbProd = products.find(dp => dp.name === p.name);
                    const actualPrice = dbProd?.price ?? p.price;
                    const actualDiscounted = actualPrice * (1 - DISCOUNT);
                    return (
                      <div key={p.name} className="glass-card p-5 text-center relative group">
                        {user?.role === 'manager' && (
                          <button
                            onClick={() => { setEditProduct(dbProd); setEditPrice(String(actualPrice)); }}
                            className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity text-sm px-2 py-0.5 rounded-lg"
                            style={{ background: 'rgba(108,99,255,0.2)', color: 'var(--primary-light)' }}
                            id={`edit-product-${dbProd?.id}`}
                          >
                            ✏️
                          </button>
                        )}

                        <div className="text-5xl mb-3 animate-float2">
                          {p.emoji}
                        </div>
                        <p className="font-bold text-sm mb-2" style={{ color: 'var(--text-primary)' }}>{p.name}</p>

                        <div className="space-y-1 mb-4">
                          <p className="text-xs line-through" style={{ color: 'var(--text-muted)', fontFamily: 'Inter' }}>
                            {actualPrice} جنيه
                          </p>
                          <p className="text-xl font-black" style={{ color: 'var(--accent)', fontFamily: 'Inter' }}>
                            {actualDiscounted.toFixed(0)} جنيه
                          </p>
                        </div>

                        {user?.role !== 'manager' && (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setCart(c => ({ ...c, [p.name]: Math.max(0, (c[p.name] || 0) - 1) }))}
                              className="w-8 h-8 rounded-xl font-bold transition-all hover:scale-110"
                              style={{ background: 'rgba(255,71,87,0.15)', color: '#FF4757' }}
                            >−</button>
                            <span className="w-8 text-center font-black text-lg" style={{ color: 'var(--text-primary)', fontFamily: 'Inter' }}>
                              {qty}
                            </span>
                            <button
                              onClick={() => setCart(c => ({ ...c, [p.name]: (c[p.name] || 0) + 1 }))}
                              className="w-8 h-8 rounded-xl font-bold transition-all hover:scale-110"
                              style={{ background: 'rgba(0,212,170,0.15)', color: 'var(--accent)' }}
                            >+</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cart / Order Summary */}
            {user?.role !== 'manager' && (
              <div className="space-y-4">
                <div className="glass-card-static p-5 sticky top-4">
                  <h2 className="section-header">🛒 طلبك الشخصي</h2>

                  {orderSuccess && (
                    <div className="mb-4 p-3 rounded-xl text-sm text-center animate-scaleIn"
                      style={{ background: 'rgba(0,212,170,0.15)', color: 'var(--accent)', border: '1px solid rgba(0,212,170,0.3)' }}>
                      ✅ تم تسجيل طلبك بنجاح!
                    </div>
                  )}

                  {Object.keys(cart).filter(k => cart[k] > 0).length === 0 ? (
                    <div className="text-center py-8 opacity-40">
                      <p className="text-4xl mb-2">🛒</p>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>اختار من القائمة</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 mb-4">
                        {Object.entries(cart).filter(([, qty]) => qty > 0).map(([name, qty]) => {
                          const p = ICE_CREAM_PRODUCTS.find(pr => pr.name === name);
                          return (
                            <div key={name} className="flex justify-between items-center p-2 rounded-lg"
                              style={{ background: 'rgba(108,99,255,0.06)' }}>
                              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{name} ×{qty}</span>
                              <span className="text-sm font-semibold" style={{ color: 'var(--accent)', fontFamily: 'Inter' }}>
                                {(p.price * qty * (1 - DISCOUNT)).toFixed(0)} جنيه
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="border-t pt-3 space-y-2" style={{ borderColor: 'var(--dark-border)' }}>
                        <div className="flex justify-between font-black text-lg">
                          <span style={{ color: 'var(--text-primary)' }}>الإجمالي</span>
                          <span style={{ color: 'var(--primary-light)', fontFamily: 'Inter' }}>{cartAfterDiscount.toFixed(0)} جنيه</span>
                        </div>
                      </div>

                      <button
                        onClick={handlePlaceOrder}
                        disabled={orderLoading}
                        className="btn-primary w-full mt-4 text-center disabled:opacity-50"
                        id="place-order-btn"
                      >
                        {orderLoading ? 'جاري...' : '✅ تأكيد الطلب'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Price Modal (Manager) */}
      {editProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card-static p-6 w-full max-w-sm animate-scaleIn">
            <h3 className="font-bold text-lg mb-4" style={{ color: 'var(--text-primary)' }}>
              ✏️ تعديل سعر {editProduct.name}
            </h3>
            <input
              id="edit-price-input"
              type="number"
              value={editPrice}
              onChange={e => setEditPrice(e.target.value)}
              className="input-dark mb-4"
              placeholder="السعر الجديد"
              min="1"
            />
            <div className="flex gap-3">
              <button onClick={() => handleUpdatePrice(editProduct.id)} className="btn-primary flex-1 text-center" id="save-price">حفظ</button>
              <button onClick={() => { setEditProduct(null); setEditPrice(''); }} className="btn-secondary flex-1 text-center" id="cancel-edit">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: درج الكاشير والمصروفات (CASHIER DRAWER) ─── */}
      {activeTab === 'drawer' && user?.role === 'cashier' && (
        <div className="space-y-6 animate-fadeInUp">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* تسجيل مصروف أو مبيعات جديد */}
            <div className="glass-card-static p-6 flex flex-col gap-6">
              
              {/* رسائل النجاح أو الخطأ */}
              {expenseMessage && (
                <div className="p-3 rounded-xl text-sm font-bold text-center animate-scaleIn"
                  style={{
                    background: expenseMessage.startsWith('✅') ? 'rgba(0,212,170,0.15)' : 'rgba(255,71,87,0.15)',
                    color: expenseMessage.startsWith('✅') ? 'var(--accent)' : '#FF4757',
                    border: `1px solid ${expenseMessage.startsWith('✅') ? 'rgba(0,212,170,0.3)' : 'rgba(255,71,87,0.3)'}`
                  }}>
                  {expenseMessage}
                </div>
              )}

              {/* قسم إضافة المبيعات */}
              <div className="p-4 rounded-xl" style={{ background: 'rgba(0,212,170,0.05)', border: '1px solid rgba(0,212,170,0.2)' }}>
                <h3 className="text-md font-bold mb-3" style={{ color: 'var(--accent)' }}>🛒 إدخال إيراد الوردية (المبيعات)</h3>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={salesAmount}
                    onChange={(e) => setSalesAmount(e.target.value)}
                    className="flex-1 glass-input p-3"
                    placeholder="مبلغ الإيراد..."
                  />
                  <button
                    onClick={handleAddSales}
                    disabled={salesLoading || !salesAmount}
                    className="btn-primary font-bold px-4"
                  >
                    {salesLoading ? '⏳' : 'تسجيل الإيراد'}
                  </button>
                </div>
              </div>

              {/* قسم إضافة مصروف */}
              <div className="p-4 rounded-xl" style={{ background: 'rgba(255,71,87,0.05)', border: '1px solid rgba(255,71,87,0.2)' }}>
                <h3 className="text-md font-bold mb-3" style={{ color: '#FF4757' }}>💸 إضافة مصروف جديد</h3>
                <div className="space-y-3">
                  <input
                    type="number"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full glass-input p-3"
                    placeholder="المبلغ (جنيه)"
                  />
                  <input
                    type="text"
                    value={expenseReason}
                    onChange={(e) => setExpenseReason(e.target.value)}
                    className="w-full glass-input p-3"
                    placeholder="سبب المصروف"
                  />
                  <button
                    onClick={handleAddExpense}
                    disabled={expenseLoading || !expenseAmount || !expenseReason}
                    className="w-full py-3 rounded-xl font-bold transition-all text-white"
                    style={{ background: '#FF4757' }}
                  >
                    {expenseLoading ? 'جاري التسجيل...' : 'تسجيل المصروف'}
                  </button>
                </div>
              </div>

            </div>

            {/* ملخص الوردية وتوتال الدرج */}
            <div className="glass-card-static p-6 flex flex-col justify-center">
              <h3 className="text-lg font-bold mb-6 text-center" style={{ color: 'var(--primary-light)' }}>📋 ملخص الوردية (اليوم)</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <span className="font-bold">🛒 إجمالي مبيعاتك اليوم:</span>
                  <span className="font-bold text-accent">{shiftSummary?.summary?.total_sales || 0} ج.م</span>
                </div>
                
                <div className="flex justify-between items-center p-4 rounded-xl" style={{ background: 'rgba(255,71,87,0.1)' }}>
                  <span className="font-bold" style={{ color: '#FF4757' }}>💸 إجمالي المصروفات:</span>
                  <span className="font-bold" style={{ color: '#FF4757' }}>{shiftSummary?.summary?.total_expenses || 0} ج.م</span>
                </div>
                
                <div className="flex justify-between items-center p-5 rounded-xl border" style={{ background: 'rgba(0,212,170,0.15)', borderColor: 'rgba(0,212,170,0.3)' }}>
                  <span className="text-lg font-bold">💵 توتال الدرج المطلوب:</span>
                  <span className="text-2xl font-black text-accent">{shiftSummary?.summary?.net_drawer || 0} ج.م</span>
                </div>
              </div>
              <p className="text-xs text-center mt-4" style={{ color: 'var(--text-secondary)' }}>
                توتال الدرج = المبيعات - المصروفات.<br/>هذه الشاشة خاصة بوردية الكاشير الحالي فقط وتُحدَّث تلقائياً.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;