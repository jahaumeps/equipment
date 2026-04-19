import { test, expect } from '@playwright/test';

test.describe('MEPS 設備借用系統基礎測試', () => {
  test('頁面應該正確載入並顯示標題', async ({ page }) => {
    await page.goto('/');
    
    // 檢查主標題
    await expect(page.locator('h1.title-text')).toContainText('MEPS');
    await expect(page.locator('.meta-label')).toContainText('設備借用系統');
  });

  test('預設應該顯示搜尋欄與設備列表', async ({ page }) => {
    await page.goto('/');
    
    // 檢查搜尋欄
    const searchInput = page.getByPlaceholder('搜尋設備名稱', { exact: false });
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    
    // 等待設備列表網格出現
    const grid = page.locator('.grid');
    await expect(grid).toBeVisible();
  });

  test('切換分頁功能（未登入狀態）', async ({ page }) => {
    await page.goto('/');
    
    // 檢查是否有「總覽」按鈕且為啟用狀態
    const overviewTab = page.getByRole('button', { name: '總覽' });
    await expect(overviewTab).toBeVisible();
    
    // 未登入時不應看到「我的借用」與「管理後台」
    await expect(page.getByRole('button', { name: '我的借用' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: '管理後台' })).not.toBeVisible();
  });

  test('點擊借用按鈕應該提示登入', async ({ page }) => {
    await page.goto('/');
    
    // 找到第一個借用按鈕並點擊
    const borrowButton = page.getByRole('button', { name: /我要借用|登入後借用/ }).first();
    
    // 攔截 alert
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('請先登入');
      await dialog.dismiss();
    });

    if (await borrowButton.isVisible()) {
      await borrowButton.click();
    }
  });
});
