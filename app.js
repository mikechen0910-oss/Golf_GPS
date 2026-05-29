    window.addEventListener('click', function(event) {
        const historyModal = document.getElementById('historyModal');
        const detailModal = document.getElementById('historyDetailModal');
        if (event.target == historyModal) {
            historyModal.style.display = 'none';
        }
        if (event.target == detailModal) {
            detailModal.style.display = 'none';
        }
    });

    async function initPage() {
        try {
            await loadCourseData();
        } catch (e) {
            console.error('球場資料載入失敗:', e);
            setInfo('球場資料載入失敗，請重新整理頁面');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPage);
    } else {
        initPage();
    }
