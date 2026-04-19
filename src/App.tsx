import React, { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import { auth, signIn, logOut, db, getUserProfile, registerUser, UserProfile } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, onSnapshot, query, where, addDoc, serverTimestamp, doc, updateDoc, deleteDoc,
  orderBy, Timestamp, getDocs
} from 'firebase/firestore';
import { Equipment, Loan } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Clock, History, Settings, LayoutGrid, ArrowRight,
  CheckCircle2, AlertCircle, Package, User as UserIcon, X, Plus, LogOut as LogOutIcon,
  Pencil, Trash2
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { zhTW } from 'date-fns/locale';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'inventory' | 'my-loans' | 'admin'>('inventory');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-fetch equipment for everyone (no login required for viewing)
  useEffect(() => {
    const q = query(collection(db, 'equipment'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Equipment));
      setEquipment(items);
    });
    return () => unsubscribe();
  }, []);

  // Auth Effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        if (!u.email?.endsWith('@tc.meps.tp.edu.tw')) {
          alert("限使用 @tc.meps.tp.edu.tw 機構信箱登入！");
          await logOut();
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        setUser(u);
        let p = await getUserProfile(u.uid);
        if (!p) {
          try {
            p = await registerUser(u);
          } catch (e) {
            console.error(e);
            alert("使用者資料建立失敗，請稍後再試。");
            await logOut();
            setUser(null);
            setProfile(null);
            setLoading(false);
            return;
          }
        }
        // Force upgrade bootstrap admin to admin role if they were registered earlier as teacher
        if (u.email === 'jahaulin@tc.meps.tp.edu.tw' && p.role !== 'admin') {
          try {
            await updateDoc(doc(db, 'users', u.uid), { role: 'admin' });
            p.role = 'admin';
          } catch (e) {
            console.error("Failed to upgrade bootstrap admin role", e);
          }
        }
        setProfile(p);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []); 

  // Redirect if restricted view and user logs out
  useEffect(() => {
    if (!loading && !user && view !== 'inventory') {
      setView('inventory');
    }
  }, [user, loading, view]);

  const handleBorrow = async (item: Equipment) => {
    if (!user) {
      alert("請先登入 (限機構信箱) 才能借用設備！");
      signIn();
      return;
    }
    if (item.status !== 'available') {
      alert("該設備目前不可借用");
      return;
    }
    
    try {
      const loanDate = new Date();
      const dueDate = addDays(loanDate, 14);
      
      const loanData = {
        equipmentId: item.id,
        equipmentName: item.name,
        userId: user.uid,
        userName: user.displayName || '使用者',
        userEmail: user.email,
        handlerName: user.displayName || '使用者',
        loanDate: serverTimestamp(),
        dueDate: Timestamp.fromDate(dueDate),
        status: 'active' as const
      };

      const loanRef = await addDoc(collection(db, 'loans'), loanData);
      
      await updateDoc(doc(db, 'equipment', item.id), {
        status: 'loaned',
        currentLoanId: loanRef.id,
        activeLoan: {
          loanDate: serverTimestamp(),
          dueDate: Timestamp.fromDate(dueDate),
          borrowerName: loanData.userName,
          borrowerEmail: loanData.userEmail,
          handlerName: loanData.handlerName
        }
      });
      alert('借用成功！請於兩週內歸還。');
    } catch (err) {
      console.error(err);
      alert('借用失敗，請稍後再試。');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-[#050505] border-b-2 border-[#52525b]">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="title-wrapper select-none pr-4 md:pr-6 border-r-2 border-[#3f3f46]">
              <h1 className="title-text text-3xl md:text-5xl text-[#F27D26]">MEPS</h1>
              <div className="meta-label">設備借用系統</div>
            </div>
            
            {/* Desktop Tabs */}
            <nav className="hidden md:flex items-center gap-2">
              <TabButton active={view === 'inventory'} onClick={() => setView('inventory')}>
                <LayoutGrid className="w-4 h-4" /> 總覽
              </TabButton>
              {user && (
                <TabButton active={view === 'my-loans'} onClick={() => setView('my-loans')}>
                  <Clock className="w-4 h-4" /> 我的借用
                </TabButton>
              )}
              {profile?.role === 'admin' && (
                <TabButton active={view === 'admin'} onClick={() => setView('admin')}>
                  <Settings className="w-4 h-4" /> 管理後台
                </TabButton>
              )}
            </nav>
          </div>
          
          <div className="flex items-center justify-between w-full md:w-auto gap-4">
             {/* Mobile Tabs */}
            <nav className="flex md:hidden items-center gap-2 overflow-x-auto flex-1 pb-1 scrollbar-hide">
              <TabButton active={view === 'inventory'} onClick={() => setView('inventory')}>總覽</TabButton>
              {user && <TabButton active={view === 'my-loans'} onClick={() => setView('my-loans')}>我的借用</TabButton>}
              {profile?.role === 'admin' && <TabButton active={view === 'admin'} onClick={() => setView('admin')}>管理後台</TabButton>}
            </nav>

            {!loading && (
              !user ? (
                <button 
                  onClick={signIn}
                  className="whitespace-nowrap px-4 py-2 bg-[#F27D26] text-[#050505] font-bold neo-brutal-container text-sm uppercase flex items-center gap-2 cursor-pointer"
                >
                  <img src="https://www.google.com/favicon.ico" className="w-4 h-4 bg-white rounded-full p-0.5" alt="G" />
                  登入
                </button>
              ) : (
                <button 
                  onClick={logOut}
                  className="whitespace-nowrap px-4 py-2 bg-[#18181b] neo-brutal-border hover:bg-[#3f3f46] text-[#f4f4f5] font-bold text-sm uppercase flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span className="hidden sm:inline">{profile?.displayName || user.email}</span>
                  <LogOutIcon className="w-4 h-4 text-[#F27D26]" />
                </button>
              )
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-screen-2xl mx-auto w-full p-4 md:p-8">
        <AnimatePresence mode="wait">
          {view === 'inventory' && (
            <motion.div
              key="inventory"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="mb-8 md:mb-12">
                <div className="flex items-center gap-4 bg-[#f4f4f5] border-2 border-[#18181b] shadow-[4px_4px_0_0_#F27D26] px-4 py-3 md:py-4">
                  <Search className="w-6 h-6 md:w-8 md:h-8 text-[#050505]" />
                  <input 
                    type="text" 
                    placeholder="SEARCH EQUIPMENT / 搜尋設備名稱..."
                    className="bg-transparent border-none w-full text-lg md:text-2xl font-bold uppercase focus:outline-none placeholder:text-[#a1a1aa] text-[#18181b]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 md:gap-8">
                {equipment
                  .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 (item.description || '').toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(item => (
                    <EquipmentCard 
                      key={item.id} 
                      item={item} 
                      onBorrow={() => handleBorrow(item)} 
                      isLoggedIn={!!user}
                    />
                  ))}
              </div>
            </motion.div>
          )}

          {view === 'my-loans' && user && (
            <MyLoansView key="my-loans" user={user} />
          )}

          {view === 'admin' && profile?.role === 'admin' && (
            <AdminPanelView key="admin" profile={profile} />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// Sub-components
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 sm:px-4 py-2 font-bold text-xs sm:text-sm uppercase tracking-wider neo-brutal-border flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
         active ? 'bg-[#F27D26] text-[#050505]' : 'bg-[#18181b] text-[#f4f4f5] hover:bg-[#27272a]'
      }`}
    >
      {children}
    </button>
  );
}

function EquipmentCard({ item, onBorrow, isLoggedIn }: { item: Equipment; onBorrow: () => void; isLoggedIn: boolean; [key: string]: any }) {
  const isAvailable = item.status === 'available';
  const [showDetails, setShowDetails] = useState(false);

  return (
    <>
      <div className="neo-brutal-container bg-[#18181b] flex flex-col cursor-pointer h-full text-left overflow-hidden" onClick={() => setShowDetails(true)}>
        <div className="aspect-video relative overflow-hidden border-b-2 border-[#3f3f46]">
          <img 
            src={item.thumbnailUrl || item.imageUrl || `https://picsum.photos/seed/${item.id}/400/225`} 
            alt={item.name} 
            className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-300"
            referrerPolicy="no-referrer"
          />
          <div className="absolute top-2 right-2">
            <Badge status={item.status} />
          </div>
        </div>
        <div className="p-4 md:p-5 flex-1 flex flex-col">
          <h3 className="font-bold text-xl mb-2 text-[#f4f4f5] line-clamp-1">{item.name}</h3>
          <p className="text-sm text-[#a1a1aa] line-clamp-2 mb-5 flex-1">{item.description}</p>
          
          <button 
            onClick={(e) => { e.stopPropagation(); onBorrow(); }}
            disabled={!isAvailable}
            className={`w-full py-3 neo-brutal-border flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-sm transition-all cursor-pointer ${
              isAvailable
                ? 'bg-[#F27D26] text-[#050505] hover:bg-[#ff8f39] hover:-translate-y-1'
                : 'bg-[#27272a] text-[#52525b] cursor-not-allowed'
            }`}
          >
            {isAvailable ? (isLoggedIn ? '我要借用' : '登入後借用') : '已被借用'}
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="fixed inset-0 z-50 bg-[#050505]/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-8 overflow-y-auto w-full" onClick={() => setShowDetails(false)}>
          <div className="bg-[#18181b] neo-brutal-container w-full max-w-4xl my-4 sm:my-8 relative overflow-hidden text-left" onClick={e => e.stopPropagation()}>
            <div className="w-full h-48 sm:h-64 md:h-80 relative border-b-4 border-[#F27D26]">
              <img 
                src={item.imageUrl || `https://picsum.photos/seed/${item.id}/800/450`} 
                alt={item.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <button onClick={() => setShowDetails(false)} className="absolute top-4 right-4 bg-[#050505] neo-brutal-border text-white p-2 hover:bg-[#F27D26] hover:text-[#050505] transition-colors z-10 cursor-pointer">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 sm:p-8">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
                <div>
                   <h2 className="title-text text-3xl sm:text-5xl text-[#F27D26] mb-2">{item.name}</h2>
                   <div className="meta-label">{item.category || '資訊設備'}</div>
                </div>
                <Badge status={item.status} size="lg" />
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="space-y-6">
                  <div>
                    <h4 className="meta-label mb-2 border-b-2 border-[#3f3f46] pb-1">設備說明</h4>
                    {item.description ? (
                      <div className="markdown-body">
                        <Markdown>{item.description}</Markdown>
                      </div>
                    ) : (
                      <p className="text-[#a1a1aa] text-sm">無詳細說明</p>
                    )}
                  </div>
                  <div>
                    <h4 className="meta-label mb-2 border-b-2 border-[#3f3f46] pb-1">相關配件</h4>
                    <p className="text-[#f4f4f5] text-sm sm:text-base">{item.accessories || '無配件'}</p>
                  </div>
                  <div>
                    <h4 className="meta-label mb-2 border-b-2 border-[#3f3f46] pb-1">備註</h4>
                    <p className="text-[#f4f4f5] text-sm sm:text-base">{item.remarks || '無'}</p>
                  </div>
                </div>

                <div className="bg-[#050505] neo-brutal-border p-6 h-fit">
                  <h4 className="meta-label mb-4 flex items-center gap-2 text-[#F27D26]">
                    <Clock className="w-4 h-4" /> 借用狀態資訊
                  </h4>
                  {item.status === 'loaned' && item.activeLoan ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-sm border-b border-[#27272a] pb-2">
                        <span className="text-[#a1a1aa] uppercase tracking-wider">借用日期</span>
                        <span className="font-bold text-[#f4f4f5]">
                          {item.activeLoan.loanDate ? format(item.activeLoan.loanDate.toDate(), 'yyyy/MM/dd', { locale: zhTW }) : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-b border-[#27272a] pb-2">
                        <span className="text-[#a1a1aa] uppercase tracking-wider">預計歸還</span>
                        <span className="font-bold text-red-500">
                          {item.activeLoan.dueDate ? format(item.activeLoan.dueDate.toDate(), 'yyyy/MM/dd', { locale: zhTW }) : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-b border-[#27272a] pb-2">
                        <span className="text-[#a1a1aa] uppercase tracking-wider">借用人</span>
                        <span className="font-bold text-[#f4f4f5]">{item.activeLoan.borrowerName}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[#a1a1aa] uppercase tracking-wider">經手人</span>
                        <span className="font-bold text-[#f4f4f5]">{item.activeLoan.handlerName || item.activeLoan.borrowerName}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <span className="inline-block bg-[#F27D26] text-[#050505] font-bold px-4 py-2 text-sm uppercase tracking-wider neo-brutal-border mb-3">
                        目前可供借用
                      </span>
                      <p className="text-xs text-[#a1a1aa] font-bold uppercase tracking-wider">借用期限一律為兩週（14 天）</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t-2 border-[#3f3f46] flex flex-col sm:flex-row justify-end gap-4">
                <button 
                  onClick={() => setShowDetails(false)}
                  className="px-6 py-3 font-bold uppercase tracking-wide bg-[#27272a] text-[#f4f4f5] neo-brutal-border hover:bg-[#3f3f46] transition-colors cursor-pointer w-full sm:w-auto"
                >
                  關閉
                </button>
                <button 
                  onClick={() => { setShowDetails(false); onBorrow(); }}
                  disabled={!isAvailable}
                  className={`px-8 py-3 font-bold uppercase tracking-wide flex items-center justify-center gap-2 neo-brutal-border transition-all cursor-pointer w-full sm:w-auto ${
                    isAvailable
                      ? 'bg-[#F27D26] text-[#050505] hover:bg-[#ff8f39]'
                      : 'bg-[#27272a] text-[#52525b] cursor-not-allowed'
                  }`}
                >
                  {isAvailable ? <>{isLoggedIn ? '立即借用' : '登入後借用'} <ArrowRight className="w-5 h-5" /></> : '已被借用'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Badge({ status, size = 'sm' }: { status: Equipment['status'], size?: 'sm' | 'lg' }) {
  const configs = {
    available: { label: '可借用', class: 'bg-[#10B981] text-[#050505]' },
    loaned: { label: '借出中', class: 'bg-[#ef4444] text-[#f4f4f5] border-[#ef4444]' },
    maintenance: { label: '維修中', class: 'bg-[#F59E0B] text-[#050505]' },
  };
  const config = configs[status];
  const sizeClass = size === 'lg' ? 'px-4 py-2 text-sm md:text-base border-2' : 'px-2 py-1 text-[10px] sm:text-xs border';
  
  return (
    <span className={`${sizeClass} font-bold ${size === 'lg' ? 'neo-brutal-border' : ''} uppercase tracking-widest ${config.class}`}>
      {config.label}
    </span>
  );
}

function MyLoansView({ user }: { user: User; [key: string]: any }) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [returningLoan, setReturningLoan] = useState<Loan | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'loans'), 
      where('userId', '==', user.uid),
      orderBy('loanDate', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setLoans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan)));
    });
  }, [user]);

  const handleReturn = async () => {
    if (!returningLoan) return;
    
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'loans', returningLoan.id), {
        status: 'returned',
        returnDate: serverTimestamp()
      });

      await updateDoc(doc(db, 'equipment', returningLoan.equipmentId), {
        status: 'available',
        currentLoanId: null,
        activeLoan: null
      });

      setReturningLoan(null);
    } catch (err) {
      console.error(err);
      alert('歸還失敗，請稍後再試。');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <header className="mb-8">
        <h2 className="title-text text-3xl font-bold text-[#f4f4f5]">我的借用</h2>
        <p className="meta-label mt-2">追蹤您的借用記錄與歸還期限</p>
      </header>

      {loans.length === 0 ? (
        <div className="bg-[#18181b] border-2 border-dashed border-[#52525b] p-12 md:p-20 text-center">
          <History className="w-12 h-12 text-[#52525b] mx-auto mb-4" />
          <h3 className="text-lg font-bold text-[#f4f4f5] uppercase tracking-wider">尚無借用紀錄</h3>
        </div>
      ) : (
        <div className="space-y-4">
          {loans.map(loan => (
            <div key={loan.id} className="bg-[#18181b] p-4 md:p-6 neo-brutal-container flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex gap-4 items-center">
                <div className={`p-3 neo-brutal-border ${loan.status === 'active' ? 'bg-[#F27D26] text-[#050505]' : 'bg-[#3f3f46] text-[#a1a1aa]'}`}>
                  {loan.status === 'active' ? <Clock className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                </div>
                <div>
                  <h4 className="font-bold text-xl text-[#f4f4f5] uppercase tracking-wider mb-2">{(loan as any).equipmentName || '未命名設備'}</h4>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 text-xs text-[#a1a1aa] uppercase tracking-wider font-bold">
                    <span>借出日期：{loan.loanDate ? format(loan.loanDate.toDate(), 'yyyy/MM/dd', { locale: zhTW }) : '處理中'}</span>
                    <span className={loan.status === 'active' ? 'text-red-500' : ''}>
                      應還日期：{loan.dueDate ? format(loan.dueDate.toDate(), 'yyyy/MM/dd', { locale: zhTW }) : '處理完畢'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {loan.status === 'active' && (
                  <button 
                    onClick={() => setReturningLoan(loan)}
                    className="w-full md:w-auto px-6 py-3 bg-[#F27D26] text-[#050505] neo-brutal-border font-bold hover:bg-[#ff8f39] transition-colors cursor-pointer uppercase tracking-wider"
                  >
                    立即歸還
                  </button>
                )}
                {loan.status === 'returned' && (
                  <span className="text-[#10B981] font-bold flex items-center gap-2 uppercase tracking-wider neo-brutal-border px-4 py-2 border-[#10B981]">
                    <CheckCircle2 className="w-5 h-5" /> 已歸還
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {returningLoan && (
          <div className="fixed inset-0 bg-[#050505]/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#18181b] w-full max-w-md neo-brutal-container p-8"
            >
              <h3 className="title-text text-2xl text-[#F27D26] mb-4">確認歸還</h3>
              <p className="text-[#f4f4f5] mb-8 font-bold leading-relaxed">
                您確定要歸還 <span className="text-[#F27D26]">{(returningLoan as any).equipmentName}</span> 嗎？<br/>
                歸還後如需再次使用，請重新進行申請。
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleReturn}
                  disabled={isProcessing}
                  className="py-4 bg-[#F27D26] text-[#050505] neo-brutal-border font-bold uppercase tracking-wider hover:bg-[#ff8f39] cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? '歸還處理中...' : '確認歸還'}
                </button>
                <button 
                  onClick={() => setReturningLoan(null)}
                  disabled={isProcessing}
                  className="py-4 bg-[#27272a] text-[#f4f4f5] neo-brutal-border font-bold uppercase tracking-wider hover:bg-[#3f3f46] cursor-pointer disabled:opacity-50"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AdminPanelView({ profile }: { profile: UserProfile | null; [key: string]: any }) {
  const [items, setItems] = useState<Equipment[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Equipment | null>(null);

  useEffect(() => {
    const unsubEquip = onSnapshot(collection(db, 'equipment'), (snap) => {
      setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Equipment)));
    });
    const unsubLoans = onSnapshot(query(collection(db, 'loans'), where('status', '==', 'active')), (snap) => {
      setActiveLoans(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan)));
    });
    return () => { unsubEquip(); unsubLoans(); };
  }, []);

  const handleClearAll = async () => {
    setIsClearing(true);
    setShowClearConfirm(false);
    try {
      // Clear equipment
      const equipSnap = await getDocs(collection(db, 'equipment'));
      const equipDeletes = equipSnap.docs.map(d => deleteDoc(d.ref));
      
      // Clear loans
      const loanSnap = await getDocs(collection(db, 'loans'));
      const loanDeletes = loanSnap.docs.map(d => deleteDoc(d.ref));

      await Promise.all([...equipDeletes, ...loanDeletes]);
      alert('所有資料已成功清空！');
    } catch (err) {
      console.error(err);
      alert('清空失敗，請檢查權限。');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <header className="mb-8 flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="title-text text-3xl font-bold text-[#f4f4f5]">管理後台</h2>
            {profile && (
              <span className="bg-[#F27D26] text-[#050505] text-[10px] font-black px-2 py-0.5 uppercase neo-brutal-border">
                {profile.role}
              </span>
            )}
          </div>
          <p className="meta-label mt-2">維護設備清單與監控外借狀況</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={() => setShowClearConfirm(true)}
            disabled={isClearing}
            className="flex items-center justify-center gap-2 bg-[#ef4444] text-[#050505] px-6 py-3 font-bold uppercase tracking-wider neo-brutal-container hover:bg-[#ff5555] active:translate-y-1 transition-all cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-5 h-5" /> {isClearing ? '正在清空...' : '清空所有資料'}
          </button>
          <button 
            onClick={() => setShowAdd(true)}
            disabled={isClearing}
            className="flex items-center justify-center gap-2 bg-[#F27D26] text-[#050505] px-6 py-3 font-bold uppercase tracking-wider neo-brutal-container hover:-translate-y-1 active:translate-y-0 transition-transform cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-5 h-5" /> 新增設備
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h3 className="meta-label flex items-center gap-2 text-lg text-[#F27D26]"><Package className="w-5 h-5"/> 設備庫存 ({items.length})</h3>
          <div className="bg-[#18181b] neo-brutal-border overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left min-w-[600px]">
                <thead>
                  <tr className="bg-[#27272a] border-b-2 border-[#52525b]">
                    <th className="px-6 py-4 meta-label">設備名稱</th>
                    <th className="px-6 py-4 meta-label">類別</th>
                    <th className="px-6 py-4 meta-label">狀態</th>
                    <th className="px-6 py-4 meta-label text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#3f3f46]">
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-[#27272a] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 neo-brutal-border bg-[#050505] overflow-hidden">
                            <img src={item.thumbnailUrl || item.imageUrl || `https://picsum.photos/seed/${item.id}/100`} className="w-full h-full object-cover grayscale" alt="" referrerPolicy="no-referrer" />
                          </div>
                          <span className="font-bold uppercase tracking-wider">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#a1a1aa] uppercase">{item.category}</td>
                      <td className="px-6 py-4"><Badge status={item.status} /></td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => setEditingItem(item)}
                            className="text-[#f4f4f5] bg-[#3f3f46] hover:bg-[#F27D26] hover:text-[#050505] p-2 neo-brutal-border transition-colors cursor-pointer"
                            title="編輯設備"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              if (item.status === 'loaned') {
                                alert('該設備目前借出中，無法直接刪除。請先完成歸還手續。');
                                return;
                              }
                              setItemToDelete(item);
                            }}
                            className="text-[#f4f4f5] bg-[#3f3f46] hover:bg-[#ef4444] hover:text-[#050505] p-2 neo-brutal-border transition-colors cursor-pointer"
                            title="刪除設備"
                          >
                             <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="meta-label flex items-center gap-2 text-lg text-[#F27D26]"><Clock className="w-5 h-5"/> 借出中 ({activeLoans.length})</h3>
          <div className="space-y-3">
            {activeLoans.map(loan => (
              <div key={loan.id} className="bg-[#18181b] p-4 neo-brutal-border flex flex-col">
                <p className="font-bold text-[#f4f4f5] uppercase tracking-wider">{(loan as any).equipmentName}</p>
                <div className="flex items-center gap-2 text-xs text-[#a1a1aa] mt-2 tracking-wider">
                  <UserIcon className="w-3 h-3" />
                  <span>{loan.userName}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-red-500 mt-2 font-bold tracking-wider pt-2 border-t-2 border-[#27272a]">
                  <AlertCircle className="w-3 h-3" />
                  <span>到期：{loan.dueDate ? format(loan.dueDate.toDate(), 'MM/dd') : '-'}</span>
                </div>
              </div>
            ))}
            {activeLoans.length === 0 && (
              <div className="text-[#a1a1aa] text-sm uppercase tracking-wider py-4">目前沒有借出的設備</div>
            )}
          </div>
        </div>
      </div>

      {showAdd && <EquipmentModal onClose={() => setShowAdd(false)} />}
      {editingItem && <EquipmentModal item={editingItem} onClose={() => setEditingItem(null)} />}

      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 bg-[#050505]/90 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#18181b] w-full max-w-sm neo-brutal-container p-8 border-red-500"
            >
              <h3 className="title-text text-2xl text-red-500 mb-4 uppercase">刪除確認</h3>
              <p className="text-[#f4f4f5] mb-8 font-bold leading-relaxed">
                確定要永久刪除 <span className="text-red-400">{itemToDelete.name}</span> 的所有資料嗎？此動作不可復原。
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={async () => {
                    if (!itemToDelete) return;
                    try {
                      await deleteDoc(doc(db, 'equipment', itemToDelete.id));
                      setItemToDelete(null);
                    } catch (e: any) {
                      alert('刪除失敗：' + (e.message || '請檢查網路連線'));
                    }
                  }}
                  className="py-4 bg-red-600 text-white font-bold uppercase tracking-wider neo-brutal-border hover:bg-red-500 cursor-pointer"
                >
                  確認刪除
                </button>
                <button 
                  onClick={() => setItemToDelete(null)}
                  className="py-4 bg-[#27272a] text-[#f4f4f5] neo-brutal-border font-bold uppercase tracking-wider hover:bg-[#3f3f46] cursor-pointer"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showClearConfirm && (
          <div className="fixed inset-0 bg-[#050505]/95 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[#18181b] max-w-md w-full p-8 neo-brutal-container border-red-500"
            >
              <div className="flex items-center gap-4 text-red-500 mb-6 font-black italic text-2xl uppercase italic">
                <AlertCircle className="w-10 h-10" /> 警告 / WARNING
              </div>
              <p className="text-[#f4f4f5] font-bold mb-8 text-lg leading-relaxed">
                您確定要<span className="text-red-500 border-b-4 border-red-500 mx-1">永久清空</span>所有設備庫存與借用記錄嗎？此動作將會刪除整組資料庫內容，資料一旦刪除即無法復原。
              </p>
              <div className="flex flex-col gap-4">
                <button 
                  onClick={handleClearAll}
                  className="w-full py-4 bg-red-600 text-white font-black uppercase tracking-widest neo-brutal-border hover:bg-red-500 cursor-pointer"
                >
                  確認強制清空所有資料
                </button>
                <button 
                  onClick={() => setShowClearConfirm(false)}
                  className="w-full py-4 bg-[#27272a] text-[#f4f4f5] font-black uppercase tracking-widest neo-brutal-border hover:bg-[#3f3f46] cursor-pointer"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function EquipmentModal({ onClose, item }: { onClose: () => void; item?: Equipment }) {
  const [formData, setFormData] = useState({
    name: item?.name || '',
    description: item?.description || '',
    accessories: item?.accessories || '',
    remarks: item?.remarks || '',
    category: item?.category || '平板電腦',
    imageUrl: item?.imageUrl || '',
    thumbnailUrl: item?.thumbnailUrl || ''
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorLog, setErrorLog] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [step, setStep] = useState<string>('');

  const resizeImageToDataUrl = (file: File, maxWidth: number, maxHeight: number, quality: number = 0.82): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Return base64 string directly
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('圖片載入失敗'));
      };
      reader.onerror = () => reject(new Error('檔案讀取失敗'));
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorLog(null);
    setUploadProgress(null);
    
    try {
      let finalImageUrl = formData.imageUrl;
      let finalThumbUrl = formData.thumbnailUrl;

      if (imageFile) {
        setStep('正在優化圖片並準備儲存...');
        
        // Heavy compression to fit perfectly inside Firestore natively 
        // Bypassing Firebase Storage config/iframe issues entirely
        finalThumbUrl = await resizeImageToDataUrl(imageFile, 300, 300, 0.6);
        finalImageUrl = await resizeImageToDataUrl(imageFile, 800, 800, 0.7);
      }

      setStep('正在寫入資料到資料庫...');
      const payload = {
        ...formData,
        imageUrl: finalImageUrl,
        thumbnailUrl: finalThumbUrl,
        category: formData.category || '平板電腦',
      };

      if (item) {
        await updateDoc(doc(db, 'equipment', item.id), {
          ...payload,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'equipment'), {
          ...payload,
          status: 'available',
          createdAt: serverTimestamp()
        });
      }
      
      setStep('成功！');
      setTimeout(() => onClose(), 800);
    } catch (err: any) {
      console.error("HandleSubmit Error:", err);
      setErrorLog(err.message || '儲存失敗，請重試。');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#050505]/95 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-[200] overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#18181b] w-full max-w-xl neo-brutal-container p-4 sm:p-8 my-8 relative"
      >
        {isSubmitting && (
          <div className="absolute inset-0 bg-[#050505]/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 border-4 border-[#F27D26] border-t-transparent animate-spin mb-6"></div>
            <h4 className="text-2xl font-black italic uppercase text-[#F27D26] mb-2">{step}</h4>
            {uploadProgress !== null && (
              <div className="w-full max-w-xs bg-[#27272a] h-4 mt-4 neo-brutal-border overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  className="h-full bg-[#F27D26]"
                />
              </div>
            )}
            <p className="text-[#a1a1aa] mt-4 font-bold animate-pulse">請勿關閉視窗，正在為您處理...</p>
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <h3 className="title-text text-2xl sm:text-3xl text-[#F27D26]">{item ? '編輯設備' : '新增設備'}</h3>
          <button onClick={onClose} disabled={isSubmitting} className="p-2 bg-[#050505] neo-brutal-border text-white hover:bg-[#F27D26] hover:text-[#050505] transition-colors disabled:opacity-50"><X className="w-5 h-5" /></button>
        </div>

        {errorLog && (
          <div className="bg-red-900/50 border-2 border-red-500 p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
            <div>
              <p className="font-bold text-red-500 uppercase tracking-widest text-sm">發生錯誤 / ERROR</p>
              <p className="text-white text-sm mt-1">{errorLog}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-[#f4f4f5] uppercase tracking-wider mb-2">設備名稱</label>
            <input 
              required
              type="text" 
              className="w-full bg-[#f4f4f5] neo-brutal-border p-3 focus:outline-none focus:ring-2 focus:ring-[#F27D26] text-[#18181b] font-bold"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-[#f4f4f5] uppercase tracking-wider mb-2">設備說明</label>
            <textarea 
              required
              rows={2}
              className="w-full bg-[#f4f4f5] neo-brutal-border p-3 focus:outline-none focus:ring-2 focus:ring-[#F27D26] text-[#18181b] font-bold"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-[#f4f4f5] uppercase tracking-wider mb-2">相關配件</label>
            <input 
              type="text" 
              placeholder="例如：充電器 x1、保護套 x1"
              className="w-full bg-[#f4f4f5] neo-brutal-border p-3 focus:outline-none focus:ring-2 focus:ring-[#F27D26] text-[#18181b] font-bold"
              value={formData.accessories}
              onChange={e => setFormData({ ...formData, accessories: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-[#f4f4f5] uppercase tracking-wider mb-2">備註</label>
            <input 
              type="text" 
              className="w-full bg-[#f4f4f5] neo-brutal-border p-3 focus:outline-none focus:ring-2 focus:ring-[#F27D26] text-[#18181b] font-bold"
              value={formData.remarks}
              onChange={e => setFormData({ ...formData, remarks: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-[#f4f4f5] uppercase tracking-wider mb-2">設備圖片 (從電腦上傳或填寫網址)</label>
            <div className="flex flex-col gap-3">
              <input 
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setImageFile(e.target.files[0]);
                  }
                }}
                className="w-full bg-[#f4f4f5] neo-brutal-border p-3 focus:outline-none focus:ring-2 focus:ring-[#F27D26] text-[#18181b] font-bold file:mr-4 file:py-2 file:px-4 file:rounded-none file:border-0 file:text-sm file:font-semibold file:bg-[#18181b] file:text-white hover:file:bg-[#3f3f46]"
              />
              <div className="text-[#a1a1aa] text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2">
                <span className="flex-1 h-[2px] bg-[#3f3f46]"></span> 或使用圖片網址 <span className="flex-1 h-[2px] bg-[#3f3f46]"></span>
              </div>
              <input 
                 type="url" 
                className="w-full bg-[#f4f4f5] neo-brutal-border p-3 focus:outline-none focus:ring-2 focus:ring-[#F27D26] text-[#18181b] font-bold"
                placeholder="https://... (若上傳檔案則會忽略此網址)"
                value={formData.imageUrl}
                onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            <button 
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="py-4 bg-[#27272a] text-[#f4f4f5] neo-brutal-border font-bold uppercase tracking-wider hover:bg-[#3f3f46] cursor-pointer disabled:opacity-50"
            >
              取消
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="py-4 bg-[#F27D26] text-[#050505] neo-brutal-border font-bold uppercase tracking-wider hover:bg-[#ff8f39] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>儲存中...</>
              ) : (
                item ? '儲存變更' : '建立設備'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
