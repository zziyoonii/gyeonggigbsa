// 전역 품목 정보
const ITEM_INFO = {
    envelope: '봉투',
    rag: '걸레',
    bleach: '락스',
    detergent: '세제',
    tissue: '휴지',
    trashbag: '쓰레기봉투',
    gloves: '장갑',
    broom: '빗자루',
    mop: '대걸레',
    bucket: '양동이',
    sponge: '수세미',
    dishsoap: '주방세제',
    disinfectant: '소독제',
    glassclean: '유리세정제',
    toiletpaper: '화장지',
    handsoap: '손세정제',
    towel: '수건',
    brush: '솔',
    dustpan: '쓰레받기',
    vacuum: '진공청소기 필터',
    airfresh: '방향제',
    floorclean: '바닥세정제',
    wipes: '물티슈',
    mask: '마스크',
    apron: '앞치마',
    scraper: '스크래퍼',
    spray: '스프레이통'
};

const ITEM_UNITS = {
    envelope: '개',
    rag: '개',
    bleach: '병',
    detergent: '병',
    tissue: '롤',
    trashbag: '개',
    gloves: '켤레',
    broom: '개',
    mop: '개',
    bucket: '개',
    sponge: '개',
    dishsoap: '병',
    disinfectant: '병',
    glassclean: '병',
    toiletpaper: '롤',
    handsoap: '병',
    towel: '개',
    brush: '개',
    dustpan: '개',
    vacuum: '개',
    airfresh: '개',
    floorclean: '병',
    wipes: '팩',
    mask: '박스',
    apron: '개',
    scraper: '개',
    spray: '개'
};

const ITEM_KEYS = Object.keys(ITEM_INFO);

// Google Sheets Web App URL (Apps Script 배포 URL을 넣으세요)
// 예: const SHEETS_API_URL = 'https://script.google.com/macros/s/xxxxxxxx/exec';
const SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycby15Wi4bepKRhREU0L1Cjn-6CHRRcF_qUJbnB6C1ZgbQNczM3BdLKesPVy_37IzJqvC-Q/exec';

// Sheets API helpers
async function sheetsCreateSubmission(data) {
  // Apps Script에 명시적으로 action=create 전달
  const form = new URLSearchParams();
  form.append('action','create');
  Object.entries(data).forEach(([k, v]) => form.append(k, String(v ?? '')));
  const resp = await fetch(SHEETS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: form.toString(),
  });
  if (!resp.ok) throw new Error('Sheets POST failed');
  const result = await resp.json().catch(() => ({ success: true }));
  return result;
}

async function sheetsLoadSubmissions(month) {
  const url = month ? `${SHEETS_API_URL}?month=${encodeURIComponent(month)}` : SHEETS_API_URL;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Sheets GET failed');
  const { submissions = [] } = await resp.json();
  return submissions;
}

async function sheetsUpdateSubmission(id, partial) {
  const form = new URLSearchParams();
  form.append('action','update');
  form.append('id', id);
  Object.entries(partial).forEach(([k, v]) => form.append(k, String(v ?? '')));
  const resp = await fetch(SHEETS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: form.toString(),
  });
  if (!resp.ok) throw new Error('Sheets PUT failed');
  return resp.json().catch(() => ({ success: true }));
}

async function sheetsDeleteSubmission(id) {
  const form = new URLSearchParams();
  form.append('action','delete');
  form.append('id', id);
  const resp = await fetch(SHEETS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: form.toString(),
  });
  if (!resp.ok) throw new Error('Sheets DELETE failed');
  return resp.json().catch(() => ({ success: true }));
}

// 데이터베이스 함수들
async function saveSubmissionToDatabase(data) {
    // 1) Sheets 사용 시
    if (SHEETS_API_URL) {
        try {
            const submission = {
                ...data,
                // 서버에서 month 계산하지만, 클라이언트에서도 맞춰 전달(문제없음)
                month: (data.date || '').slice(0, 7)
            };
            await sheetsCreateSubmission(submission);
            return submission;
        } catch (e) {
            console.warn('Sheets 저장 실패, localStorage로 fallback:', e);
            return saveToLocalStorage(data);
        }
    }
    // 2) Firebase가 세팅돼 있다면 (기존)
    if (window.db) {
        try {
            const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
            const submissionData = { ...data, submittedAt: serverTimestamp(), id: Date.now().toString() };
            await addDoc(collection(window.db, 'submissions'), submissionData);
            return submissionData;
        } catch (error) {
            console.error('Firebase 저장 실패:', error);
            return saveToLocalStorage(data);
        }
    }
    // 3) 최종 fallback: localStorage
    return saveToLocalStorage(data);
}

async function loadSubmissionsFromDatabase() {
    // Sheets 우선
    if (SHEETS_API_URL) {
        try {
            const submissions = await sheetsLoadSubmissions();
            return submissions;
        } catch (e) {
            console.warn('Sheets 로드 실패, localStorage로 fallback:', e);
            return JSON.parse(localStorage.getItem('cleaningSubmissions') || '[]');
        }
    }
    if (window.db) {
        try {
            const { collection, getDocs, orderBy, query } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
            const q = query(collection(window.db, 'submissions'), orderBy('submittedAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const submissions = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                submissions.push({ ...data, firebaseId: doc.id });
            });
            return submissions;
        } catch (error) {
            console.error('Firebase 로드 실패:', error);
            return JSON.parse(localStorage.getItem('cleaningSubmissions') || '[]');
        }
    }
    return JSON.parse(localStorage.getItem('cleaningSubmissions') || '[]');
}

async function updateSubmissionInDatabase(data, index, firebaseId) {
    if (SHEETS_API_URL) {
        try {
            // index 기반이던 기존 로직 → id 기반으로 업데이트 필요
            const submissions = await loadSubmissionsFromDatabase();
            const target = submissions[index];
            if (target && target.id) {
                await sheetsUpdateSubmission(target.id, { ...data, month: (data.date||'').slice(0,7) });
                return true;
            }
        } catch (e) {
            console.warn('Sheets 업데이트 실패, localStorage로 fallback:', e);
            updateLocalStorage(data, index);
            return false;
        }
        updateLocalStorage(data, index);
        return false;
    }
    if (window.db && firebaseId) {
        try {
            const { doc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
            await updateDoc(doc(window.db, 'submissions', firebaseId), { ...data, updatedAt: serverTimestamp() });
            return true;
        } catch (error) {
            console.error('Firebase 업데이트 실패:', error);
            updateLocalStorage(data, index);
            return false;
        }
    }
    updateLocalStorage(data, index);
    return true;
}

async function deleteSubmissionFromDatabase(index, firebaseId) {
    if (window.db && firebaseId) {
        // Firebase Firestore 사용
        try {
            const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
            
            await deleteDoc(doc(window.db, 'submissions', firebaseId));
            return true;
        } catch (error) {
            console.error('Firebase 삭제 실패:', error);
            // Firebase 실패시 localStorage로 fallback
            deleteFromLocalStorage(index);
            return false;
        }
    } else {
        // localStorage 사용
        deleteFromLocalStorage(index);
        return true;
    }
}

// localStorage 함수들 (fallback용)
function saveToLocalStorage(data) {
    const submissions = JSON.parse(localStorage.getItem('cleaningSubmissions') || '[]');
    const newSubmission = {
        ...data,
        id: Date.now().toString(),
        submittedAt: new Date().toISOString()
    };
    submissions.unshift(newSubmission);
    localStorage.setItem('cleaningSubmissions', JSON.stringify(submissions));
    return newSubmission;
}

function updateLocalStorage(data, index) {
    const submissions = JSON.parse(localStorage.getItem('cleaningSubmissions') || '[]');
    if (submissions[index]) {
        submissions[index] = {
            ...submissions[index],
            ...data,
            updatedAt: new Date().toISOString()
        };
        localStorage.setItem('cleaningSubmissions', JSON.stringify(submissions));
    }
}

function deleteFromLocalStorage(index) {
    const submissions = JSON.parse(localStorage.getItem('cleaningSubmissions') || '[]');
    submissions.splice(index, 1);
    localStorage.setItem('cleaningSubmissions', JSON.stringify(submissions));
}

// 페이지 로드 시 오늘 날짜를 기본값으로 설정
document.addEventListener('DOMContentLoaded', function() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
    // 초기 화면 상태: 요약/성공/목록/마이/월별 섹션 강제 숨김 보장
    ['summary','successSection','listPage','myPage','monthlyPage'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            el.setAttribute('aria-hidden','true');
        }
    });
    
    // 폼 제출 이벤트 리스너 추가
    document.getElementById('itemForm').addEventListener('submit', handleFormSubmit);
    
    // 수량 입력 필드에 이벤트 리스너 추가
    const quantityInputs = document.querySelectorAll('.quantity-input');
    quantityInputs.forEach(input => {
        input.addEventListener('input', validateQuantity);
        // 모바일에서 숫자 키패드 최적화
        input.addEventListener('focus', function() {
            this.select();
        });
    });
    
    // 모바일 최적화: 터치 이벤트 처리
    setupMobileOptimizations();
});

// 모바일 최적화 설정
function setupMobileOptimizations() {
    // 터치 디바이스 감지
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    if (isTouchDevice) {
        // 버튼 터치 피드백 개선
        const buttons = document.querySelectorAll('.btn');
        buttons.forEach(button => {
            button.addEventListener('touchstart', function() {
                this.style.transform = 'scale(0.98)';
            });
            
            button.addEventListener('touchend', function() {
                this.style.transform = '';
            });
        });
        
        // 입력 필드 터치 최적화
        const inputs = document.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.addEventListener('focus', function() {
                // 모바일에서 입력 필드가 키보드에 가려지지 않도록 스크롤
                setTimeout(() => {
                    this.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            });
        });
    }
}

// 모바일 친화적인 알림 함수
function showMobileAlert(message, type = 'info') {
    // 기존 알림 제거
    const existingAlert = document.querySelector('.mobile-alert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    // 새로운 알림 생성
    const alert = document.createElement('div');
    alert.className = `mobile-alert mobile-alert-${type}`;
    alert.innerHTML = `
        <div class="alert-content">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()">확인</button>
        </div>
    `;
    
    document.body.appendChild(alert);
    
    // 3초 후 자동 제거
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 3000);
}

// 수량 유효성 검사
function validateQuantity(event) {
    const value = parseInt(event.target.value);
    if (value < 0) {
        event.target.value = 0;
    }
    
    // 모바일에서 실시간 피드백
    if (value > 0) {
        event.target.style.backgroundColor = '#e8f5e8';
    } else {
        event.target.style.backgroundColor = '#fafafa';
    }
}

// 폼 제출 처리
function handleFormSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData);
    
    // 필수 필드 검증
    if (!data.name.trim()) {
        showMobileAlert('이름을 입력해주세요.', 'error');
        document.getElementById('name').focus();
        return;
    }
    
    if (!data.department.trim()) {
        showMobileAlert('부서/팀을 입력해주세요.', 'error');
        document.getElementById('department').focus();
        return;
    }
    
    // 최소 하나의 품목이 선택되었는지 확인
    const hasItems = ITEM_KEYS.some(item => parseInt(data[item]) > 0);
    
    if (!hasItems) {
        showMobileAlert('최소 하나의 품목을 선택해주세요.', 'error');
        return;
    }
    
    // 수정 모드인지 확인
    if (window.editMode && window.editIndex !== undefined) {
        // 수정 모드: 기존 데이터 업데이트
        updateSubmission(data, window.editIndex);
        return;
    }
    
    // 제출 내용 확인 화면 표시
    showSummary(data);
}

// 신청 수정 업데이트
function updateSubmission(data, index) {
    const submissions = JSON.parse(localStorage.getItem('cleaningSubmissions') || '[]');
    
    if (submissions[index]) {
        // 기존 데이터 업데이트
        submissions[index] = {
            ...submissions[index],
            ...data,
            updatedAt: new Date().toISOString()
        };
        
        localStorage.setItem('cleaningSubmissions', JSON.stringify(submissions));
        
        // 수정 모드 해제
        window.editMode = false;
        window.editIndex = undefined;
        
        // 제출 버튼 텍스트 복원
        document.querySelector('button[type="submit"]').textContent = '제출하기';
        
        showMobileAlert('수정이 완료되었습니다.', 'success');
        
        // 목록 페이지로 이동
        goToListPage();
    }
}

// 제출 내용 확인 화면 표시
function showSummary(data) {
    const summary = document.getElementById('summary');
    const summaryContent = document.getElementById('summaryContent');
    
    // 기본 정보
    let html = `
        <div class="summary-item">
            <span class="summary-label">신청자:</span>
            <span class="summary-value">${data.name}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">부서/팀:</span>
            <span class="summary-value">${data.department}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">신청 날짜:</span>
            <span class="summary-value">${formatDate(data.date)}</span>
        </div>
    `;
    
    // 품목 정보는 전역 변수 ITEM_INFO 사용
    
    // 품목 단위 정보는 전역 변수 ITEM_UNITS 사용
    
    html += '<div class="items-summary">';
    html += '<h4 style="margin-bottom: 10px; color: #2E7D32;">신청 품목</h4>';
    
    let hasItems = false;
    ITEM_KEYS.forEach(itemKey => {
        const quantity = parseInt(data[itemKey] || 0);
        if (quantity > 0) {
            hasItems = true;
            html += `
                <div class="item-summary">
                    <span>${ITEM_INFO[itemKey]}:</span>
                    <span style="font-weight: bold; color: #2E7D32;">${quantity}${ITEM_UNITS[itemKey]}</span>
                </div>
            `;
        }
    });
    
    if (!hasItems) {
        html += '<p style="color: #666; font-style: italic;">선택된 품목이 없습니다.</p>';
    }
    
    html += '</div>';
    
    // 비고
    if (data.memo && data.memo.trim()) {
        html += `
            <div class="summary-item">
                <span class="summary-label">비고:</span>
                <span class="summary-value">${data.memo}</span>
            </div>
        `;
    }
    
    summaryContent.innerHTML = html;
    
    // 폼 숨기고 요약 화면 표시
    document.getElementById('itemForm').style.display = 'none';
    summary.classList.remove('hidden');
}

// 날짜 포맷팅
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// 확인 제출
async function confirmSubmit() {
    const formData = new FormData(document.getElementById('itemForm'));
    const data = Object.fromEntries(formData);
    
    try {
        // 데이터베이스에 저장
        await saveSubmissionToDatabase(data);
        
        // 성공 섹션 표시
        document.getElementById('summary').classList.add('hidden');
        document.getElementById('successSection').classList.remove('hidden');
        
        // 성공 정보 업데이트
        document.getElementById('successInfo').innerHTML = `
            신청자: ${data.name}<br>
            부서: ${data.department}<br>
            신청 날짜: ${formatDate(data.date)}
        `;
    } catch (error) {
        console.error('제출 실패:', error);
        showMobileAlert('제출 중 오류가 발생했습니다. 다시 시도해주세요.', 'error');
    }
}

// 로컬 스토리지에 저장
function saveToLocalStorage(data) {
    const submissions = JSON.parse(localStorage.getItem('cleaningSubmissions') || '[]');
    const submission = {
        ...data,
        id: Date.now(),
        submittedAt: new Date().toISOString()
    };
    submissions.push(submission);
    localStorage.setItem('cleaningSubmissions', JSON.stringify(submissions));
}

// 폼 수정하기
function editForm() {
    document.getElementById('summary').classList.add('hidden');
    document.getElementById('itemForm').style.display = 'block';
}

// 폼 초기화
function resetForm() {
    document.getElementById('itemForm').reset();
    document.getElementById('summary').classList.add('hidden');
    document.getElementById('successSection').classList.add('hidden');
    document.getElementById('itemForm').style.display = 'block';
    
    // 오늘 날짜로 다시 설정
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
    
    // 모든 수량을 0으로 초기화
    const quantityInputs = document.querySelectorAll('.quantity-input');
    quantityInputs.forEach(input => {
        input.value = 0;
    });
}

// 목록 페이지로 이동
function goToListPage() {
    document.querySelector('.container').style.display = 'none';
    document.getElementById('listPage').classList.add('show');
    loadSubmissions();
}

// 폼 페이지로 이동
function goToFormPage() {
    document.getElementById('listPage').classList.remove('show');
    document.querySelector('.container').style.display = 'block';
    resetForm();
}

// 신청 목록 로드
async function loadSubmissions() {
    try {
        const submissions = await loadSubmissionsFromDatabase();
        const container = document.getElementById('listContainer');
        
        if (submissions.length === 0) {
            container.innerHTML = '<p style="text-align: center; font-size: 18px; color: #666;">아직 신청된 내역이 없습니다.</p>';
            updateTotalSummary({});
            return;
        }
        
        // 최신순으로 정렬 (Firebase는 이미 정렬되어 있지만 localStorage는 필요)
        submissions.sort((a, b) => {
            const dateA = new Date(a.submittedAt);
            const dateB = new Date(b.submittedAt);
            return dateB - dateA;
        });
        
        let html = '';
        submissions.forEach((submission, index) => {
            html += createSubmissionHTML(submission, index);
        });
        
        container.innerHTML = html;
        updateTotalSummary(submissions);
    } catch (error) {
        console.error('목록 로드 실패:', error);
        const container = document.getElementById('listContainer');
        container.innerHTML = '<p style="text-align: center; font-size: 18px; color: #f44336;">목록을 불러오는 중 오류가 발생했습니다.</p>';
    }
}

// 신청 항목 HTML 생성
function createSubmissionHTML(submission, index) {
    const ITEM_INFO = {
        envelope: '봉투',
        rag: '걸레',
        bleach: '락스',
        detergent: '세제',
        tissue: '휴지',
        trashbag: '쓰레기봉투',
        gloves: '장갑',
        broom: '빗자루'
    };
    
    // 품목 단위 정보는 전역 변수 ITEM_UNITS 사용
    
    let itemsHtml = '';
    const items = ['envelope', 'rag', 'bleach', 'detergent', 'tissue', 'trashbag', 'gloves', 'broom'];
    items.forEach(item => {
        const quantity = parseInt(submission[item]);
        if (quantity > 0) {
            itemsHtml += `
                <div class="item-display">
                    <div class="item-name">${ITEM_INFO[item]}</div>
                    <div class="item-quantity">${quantity}${ITEM_UNITS[item]}</div>
                </div>
            `;
        }
    });
    
    const memoHtml = submission.memo && submission.memo.trim() ? 
        `<div class="submission-memo"><p><strong>비고:</strong> ${submission.memo}</p></div>` : '';
    
    return `
        <div class="submission-item">
            <div class="submission-header">
                <div class="submission-info">
                    <span>신청자: ${submission.name}</span>
                    <span>부서: ${submission.department}</span>
                    <span>신청일: ${formatDate(submission.date)}</span>
                </div>
                <div class="submission-actions">
                    <button type="button" class="btn btn-secondary" onclick="editSubmission(${index})">수정</button>
                    <button type="button" class="btn btn-print" onclick="printSubmission(${index})">인쇄</button>
                    <button type="button" class="btn btn-primary" onclick="deleteSubmission(${index})">삭제</button>
                </div>
            </div>
            <div class="submission-items">
                ${itemsHtml}
            </div>
            ${memoHtml}
        </div>
    `;
}

// 전체 요약 업데이트
function updateTotalSummary(submissions) {
    const ITEM_INFO = {
        envelope: '봉투',
        rag: '걸레',
        bleach: '락스',
        detergent: '세제',
        tissue: '휴지',
        trashbag: '쓰레기봉투',
        gloves: '장갑',
        broom: '빗자루'
    };
    
    // 품목 단위 정보는 전역 변수 ITEM_UNITS 사용
    
    const totals = {};
    const items = ['envelope', 'rag', 'bleach', 'detergent', 'tissue', 'trashbag', 'gloves', 'broom'];
    
    items.forEach(item => {
        totals[item] = 0;
    });
    
    submissions.forEach(submission => {
        items.forEach(item => {
            totals[item] += parseInt(submission[item]) || 0;
        });
    });
    
    let summaryHtml = '<div class="total-summary-grid">';
    items.forEach(item => {
        if (totals[item] > 0) {
            summaryHtml += `
                <div class="total-item">
                    <div class="item-name">${ITEM_INFO[item]}</div>
                    <div class="item-total">${totals[item]}${ITEM_UNITS[item]}</div>
                </div>
            `;
        }
    });
    summaryHtml += '</div>';
    
    document.getElementById('totalSummary').innerHTML = summaryHtml;
}

// 검색 필터링
function filterList() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const submissions = JSON.parse(localStorage.getItem('cleaningSubmissions') || '[]');
    const filtered = submissions.filter(submission => 
        submission.name.toLowerCase().includes(searchTerm) ||
        submission.department.toLowerCase().includes(searchTerm)
    );
    
    const container = document.getElementById('listContainer');
    if (filtered.length === 0) {
        container.innerHTML = '<p style="text-align: center; font-size: 18px; color: #666;">검색 결과가 없습니다.</p>';
        updateTotalSummary([]);
        return;
    }
    
    let html = '';
    filtered.forEach((submission, index) => {
        const originalIndex = submissions.findIndex(s => s.id === submission.id);
        html += createSubmissionHTML(submission, originalIndex);
    });
    
    container.innerHTML = html;
    updateTotalSummary(filtered);
}

// 필터 초기화
function clearFilter() {
    document.getElementById('searchInput').value = '';
    loadSubmissions();
}

// 신청 수정
function editSubmission(index) {
    const submissions = JSON.parse(localStorage.getItem('cleaningSubmissions') || '[]');
    const submission = submissions[index];
    
    if (!submission) return;
    
    // 폼 페이지로 이동
    goToFormPage();
    
    // 폼에 데이터 채우기
    document.getElementById('name').value = submission.name;
    document.getElementById('department').value = submission.department;
    document.getElementById('date').value = submission.date;
    document.getElementById('memo').value = submission.memo || '';
    
    const items = ['envelope', 'rag', 'bleach', 'detergent', 'tissue', 'trashbag', 'gloves', 'broom'];
    items.forEach(item => {
        document.getElementById(item).value = submission[item] || 0;
    });
    
    // 수정 모드 설정
    window.editMode = true;
    window.editIndex = index;
    
    // 제출 버튼 텍스트 변경
    document.querySelector('button[type="submit"]').textContent = '수정 완료';
}

// 신청 삭제
async function deleteSubmission(index) {
    if (!confirm('정말로 이 신청을 삭제하시겠습니까?')) return;

    // Sheets 사용 시: id로 삭제
    if (SHEETS_API_URL) {
        try {
            const submissions = await loadSubmissionsFromDatabase();
            const target = submissions[index];
            if (target && target.id) {
                await sheetsDeleteSubmission(target.id);
            }
        } catch (e) {
            console.warn('Sheets 삭제 실패, localStorage로 fallback:', e);
            const submissions = JSON.parse(localStorage.getItem('cleaningSubmissions') || '[]');
            submissions.splice(index, 1);
            localStorage.setItem('cleaningSubmissions', JSON.stringify(submissions));
        }
        loadSubmissions();
        return;
    }

    // 기존 localStorage 방식
    const submissions = JSON.parse(localStorage.getItem('cleaningSubmissions') || '[]');
    submissions.splice(index, 1);
    localStorage.setItem('cleaningSubmissions', JSON.stringify(submissions));
    loadSubmissions();
}

// 개별 신청 인쇄
function printSubmission(index) {
    const submissions = JSON.parse(localStorage.getItem('cleaningSubmissions') || '[]');
    const submission = submissions[index];
    
    if (!submission) return;
    
    const printWindow = window.open('', '_blank');
    const ITEM_INFO = {
        envelope: '봉투',
        rag: '걸레',
        bleach: '락스',
        detergent: '세제',
        tissue: '휴지',
        trashbag: '쓰레기봉투',
        gloves: '장갑',
        broom: '빗자루'
    };
    
    // 품목 단위 정보는 전역 변수 ITEM_UNITS 사용
    
    let itemsHtml = '';
    const items = ['envelope', 'rag', 'bleach', 'detergent', 'tissue', 'trashbag', 'gloves', 'broom'];
    items.forEach(item => {
        const quantity = parseInt(submission[item]);
        if (quantity > 0) {
            itemsHtml += `
                <tr>
                    <td style="border: 1px solid #000; padding: 8px; text-align: center;">${ITEM_INFO[item]}</td>
                    <td style="border: 1px solid #000; padding: 8px; text-align: center;">${quantity}${ITEM_UNITS[item]}</td>
                </tr>
            `;
        }
    });
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>미화 품목 신청서</title>
            <style>
                body { font-family: 'Malgun Gothic', sans-serif; font-size: 14px; }
                table { border-collapse: collapse; width: 100%; margin: 20px 0; }
                th { border: 1px solid #000; padding: 10px; background-color: #f0f0f0; }
                .header { text-align: center; margin-bottom: 30px; }
                .info-table { margin-bottom: 20px; }
                .info-table td { padding: 5px 10px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>미화 품목 신청서</h1>
            </div>
            
            <table class="info-table">
                <tr>
                    <td><strong>신청자:</strong> ${submission.name}</td>
                    <td><strong>부서/팀:</strong> ${submission.department}</td>
                </tr>
                <tr>
                    <td><strong>신청 날짜:</strong> ${formatDate(submission.date)}</td>
                    <td><strong>제출 일시:</strong> ${new Date(submission.submittedAt).toLocaleString('ko-KR')}</td>
                </tr>
            </table>
            
            <table>
                <thead>
                    <tr>
                        <th style="width: 70%;">품목</th>
                        <th style="width: 30%;">수량</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
            
            ${submission.memo ? `<p><strong>비고:</strong> ${submission.memo}</p>` : ''}
            
            <div style="margin-top: 50px;">
                <p>신청자 서명: _________________</p>
                <p>관리자 확인: _________________</p>
            </div>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
}

// 전체 요약 인쇄
function printSummary() {
    const submissions = JSON.parse(localStorage.getItem('cleaningSubmissions') || '[]');
    const printWindow = window.open('', '_blank');
    
    const ITEM_INFO = {
        envelope: '봉투',
        rag: '걸레',
        bleach: '락스',
        detergent: '세제',
        tissue: '휴지',
        trashbag: '쓰레기봉투',
        gloves: '장갑',
        broom: '빗자루'
    };
    
    // 품목 단위 정보는 전역 변수 ITEM_UNITS 사용
    
    const totals = {};
    const items = ['envelope', 'rag', 'bleach', 'detergent', 'tissue', 'trashbag', 'gloves', 'broom'];
    
    items.forEach(item => {
        totals[item] = 0;
    });
    
    submissions.forEach(submission => {
        items.forEach(item => {
            totals[item] += parseInt(submission[item]) || 0;
        });
    });
    
    let summaryHtml = '';
    items.forEach(item => {
        if (totals[item] > 0) {
            summaryHtml += `
                <tr>
                    <td style="border: 1px solid #000; padding: 8px; text-align: center;">${ITEM_INFO[item]}</td>
                    <td style="border: 1px solid #000; padding: 8px; text-align: center;">${totals[item]}${ITEM_UNITS[item]}</td>
                </tr>
            `;
        }
    });
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>미화 품목 전체 요약</title>
            <style>
                body { font-family: 'Malgun Gothic', sans-serif; font-size: 14px; }
                table { border-collapse: collapse; width: 100%; margin: 20px 0; }
                th { border: 1px solid #000; padding: 10px; background-color: #f0f0f0; }
                .header { text-align: center; margin-bottom: 30px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>미화 품목 전체 요약</h1>
                <p>총 신청 건수: ${submissions.length}건</p>
                <p>작성일: ${new Date().toLocaleDateString('ko-KR')}</p>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th style="width: 70%;">품목</th>
                        <th style="width: 30%;">총 수량</th>
                    </tr>
                </thead>
                <tbody>
                    ${summaryHtml}
                </tbody>
            </table>
            
            <div style="margin-top: 50px;">
                <p>담당자 확인: _________________</p>
                <p>구매 담당자: _________________</p>
            </div>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
}

// 인쇄 기능
function printForm() {
    const formData = new FormData(document.getElementById('itemForm'));
    const data = Object.fromEntries(formData);
    
    // 인쇄용 창 열기
    const printWindow = window.open('', '_blank');
    
    const ITEM_INFO = {
        envelope: '봉투',
        rag: '걸레',
        bleach: '락스',
        detergent: '세제',
        tissue: '휴지',
        trashbag: '쓰레기봉투',
        gloves: '장갑',
        broom: '빗자루'
    };
    
    // 품목 단위 정보는 전역 변수 ITEM_UNITS 사용
    
    let itemsHtml = '';
    const items = ['envelope', 'rag', 'bleach', 'detergent', 'tissue', 'trashbag', 'gloves', 'broom'];
    items.forEach(item => {
        const quantity = parseInt(data[item]);
        if (quantity > 0) {
            itemsHtml += `
                <tr>
                    <td style="border: 1px solid #000; padding: 8px; text-align: center;">${ITEM_INFO[item]}</td>
                    <td style="border: 1px solid #000; padding: 8px; text-align: center;">${quantity}${ITEM_UNITS[item]}</td>
                </tr>
            `;
        }
    });
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>미화 품목 신청서</title>
            <style>
                body { font-family: 'Malgun Gothic', sans-serif; font-size: 14px; }
                table { border-collapse: collapse; width: 100%; margin: 20px 0; }
                th { border: 1px solid #000; padding: 10px; background-color: #f0f0f0; }
                .header { text-align: center; margin-bottom: 30px; }
                .info-table { margin-bottom: 20px; }
                .info-table td { padding: 5px 10px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>미화 품목 신청서</h1>
            </div>
            
            <table class="info-table">
                <tr>
                    <td><strong>신청자:</strong> ${data.name}</td>
                    <td><strong>부서/팀:</strong> ${data.department}</td>
                </tr>
                <tr>
                    <td><strong>신청 날짜:</strong> ${formatDate(data.date)}</td>
                    <td><strong>제출 일시:</strong> ${new Date().toLocaleString('ko-KR')}</td>
                </tr>
            </table>
            
            <table>
                <thead>
                    <tr>
                        <th style="width: 70%;">품목</th>
                        <th style="width: 30%;">수량</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
            
            ${data.memo ? `<p><strong>비고:</strong> ${data.memo}</p>` : ''}
            
            <div style="margin-top: 50px;">
                <p>신청자 서명: _________________</p>
                <p>관리자 확인: _________________</p>
            </div>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
}

// 키보드 단축키 지원
document.addEventListener('keydown', function(event) {
    // Ctrl + Enter: 제출
    if (event.ctrlKey && event.key === 'Enter') {
        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.click();
        }
    }
    
    // Ctrl + P: 인쇄
    if (event.ctrlKey && event.key === 'p') {
        event.preventDefault();
        printForm();
    }
    
    // Ctrl + R: 폼 초기화
    if (event.ctrlKey && event.key === 'r') {
        event.preventDefault();
        resetForm();
    }
}); 