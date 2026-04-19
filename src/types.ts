export interface Equipment {
  id: string;
  name: string; // 品項名稱
  accessories: string; // 相關配件
  imageUrl: string; // 照片欄位
  thumbnailUrl?: string; // 縮圖欄位
  description: string; // 說明欄位
  remarks: string; // 備註
  category: string;
  status: 'available' | 'loaned' | 'maintenance';
  currentLoanId?: string | null;
  activeLoan?: {
    loanDate: any; // Timestamp
    dueDate: any; // Timestamp
    borrowerName: string;
    borrowerEmail: string;
    handlerName?: string; // 經手人
  } | null;
}

export interface Loan {
  id: string;
  equipmentId: string;
  equipmentName: string;
  userId: string;
  userName: string;
  userEmail: string;
  handlerName: string; // 經手人
  loanDate: any; 
  dueDate: any;
  returnDate?: any;
  status: 'active' | 'returned' | 'overdue';
}
