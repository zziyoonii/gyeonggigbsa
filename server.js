const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// 데이터 파일 경로
const DATA_FILE = path.join(__dirname, 'data', 'submissions.json');

// 데이터 디렉토리 생성
async function ensureDataDirectory() {
    const dataDir = path.dirname(DATA_FILE);
    try {
        await fs.access(dataDir);
    } catch {
        await fs.mkdir(dataDir, { recursive: true });
    }
}

// 데이터 로드
async function loadData() {
    try {
        await ensureDataDirectory();
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // 파일이 없으면 빈 데이터 반환
        return { submissions: [], lastUpdated: new Date().toISOString() };
    }
}

// 데이터 저장
async function saveData(data) {
    await ensureDataDirectory();
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// API 라우트

// 모든 신청 조회
app.get('/api/submissions', async (req, res) => {
    try {
        const data = await loadData();
        res.json(data);
    } catch (error) {
        console.error('데이터 로드 오류:', error);
        res.status(500).json({ error: '데이터 로드 실패' });
    }
});

// 새 신청 추가
app.post('/api/submissions', async (req, res) => {
    try {
        const { name, department, date, envelope, rag, bleach, detergent, tissue, trashbag, gloves, broom, memo } = req.body;
        
        // 필수 필드 검증
        if (!name || !department || !date) {
            return res.status(400).json({ error: '이름, 부서, 날짜는 필수입니다.' });
        }
        
        const data = await loadData();
        
        const newSubmission = {
            id: Date.now().toString(),
            name,
            department,
            date,
            envelope: parseInt(envelope) || 0,
            rag: parseInt(rag) || 0,
            bleach: parseInt(bleach) || 0,
            detergent: parseInt(detergent) || 0,
            tissue: parseInt(tissue) || 0,
            trashbag: parseInt(trashbag) || 0,
            gloves: parseInt(gloves) || 0,
            broom: parseInt(broom) || 0,
            memo: memo || '',
            submittedAt: new Date().toISOString(),
            month: new Date(date).toISOString().slice(0, 7)
        };
        
        data.submissions.unshift(newSubmission);
        data.lastUpdated = new Date().toISOString();
        
        await saveData(data);
        
        res.json({ success: true, submission: newSubmission });
    } catch (error) {
        console.error('신청 저장 오류:', error);
        res.status(500).json({ error: '신청 저장 실패' });
    }
});

// 신청 삭제
app.delete('/api/submissions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const data = await loadData();
        
        const index = data.submissions.findIndex(s => s.id === id);
        if (index === -1) {
            return res.status(404).json({ error: '신청을 찾을 수 없습니다.' });
        }
        
        data.submissions.splice(index, 1);
        data.lastUpdated = new Date().toISOString();
        
        await saveData(data);
        
        res.json({ success: true });
    } catch (error) {
        console.error('신청 삭제 오류:', error);
        res.status(500).json({ error: '신청 삭제 실패' });
    }
});

// 월별 통계
app.get('/api/statistics/monthly/:month', async (req, res) => {
    try {
        const { month } = req.params;
        const data = await loadData();
        
        const monthlySubmissions = data.submissions.filter(s => s.month === month);
        
        const totals = {
            envelope: 0, rag: 0, bleach: 0, detergent: 0, tissue: 0,
            trashbag: 0, gloves: 0, broom: 0
        };
        
        monthlySubmissions.forEach(submission => {
            Object.keys(totals).forEach(key => {
                totals[key] += parseInt(submission[key]) || 0;
            });
        });
        
        const statistics = {
            month,
            totalPeople: new Set(monthlySubmissions.map(s => s.name)).size,
            totalSubmissions: monthlySubmissions.length,
            totals
        };
        
        res.json(statistics);
    } catch (error) {
        console.error('통계 조회 오류:', error);
        res.status(500).json({ error: '통계 조회 실패' });
    }
});

// 메인 페이지
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`http://localhost:${PORT}`);
});

module.exports = app; 