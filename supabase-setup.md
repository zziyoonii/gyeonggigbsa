# Supabase 무료 데이터베이스 연동 가이드

## 🎯 **Supabase 장점:**
- **완전 무료** (월 500MB까지)
- **실시간 업데이트** 지원
- **간단한 설정**
- **모든 기기에서 동기화**

## 🛠️ **설정 방법:**

### 1단계: Supabase 프로젝트 생성
1. [supabase.com](https://supabase.com) 접속
2. "Start your project" 클릭
3. GitHub으로 로그인
4. "New project" 생성
5. 프로젝트 이름: `cleaning-supplies`
6. 데이터베이스 비밀번호 설정

### 2단계: 테이블 생성
SQL Editor에서 다음 쿼리 실행:

```sql
-- 신청 테이블 생성
CREATE TABLE submissions (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    date DATE NOT NULL,
    envelope INTEGER DEFAULT 0,
    rag INTEGER DEFAULT 0,
    bleach INTEGER DEFAULT 0,
    detergent INTEGER DEFAULT 0,
    tissue INTEGER DEFAULT 0,
    trashbag INTEGER DEFAULT 0,
    gloves INTEGER DEFAULT 0,
    broom INTEGER DEFAULT 0,
    memo TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    month TEXT GENERATED ALWAYS AS (TO_CHAR(date, 'YYYY-MM')) STORED
);

-- RLS (Row Level Security) 비활성화 (공개 데이터이므로)
ALTER TABLE submissions DISABLE ROW LEVEL SECURITY;

-- 인덱스 생성 (성능 향상)
CREATE INDEX idx_submissions_month ON submissions(month);
CREATE INDEX idx_submissions_name ON submissions(name);
```

### 3단계: API 키 복사
1. Settings > API 탭 이동
2. `Project URL` 복사
3. `anon public` 키 복사

### 4단계: 웹사이트 연동
HTML 파일에서 다음 설정:

```javascript
const SUPABASE_CONFIG = {
    url: 'YOUR_PROJECT_URL',
    key: 'YOUR_ANON_KEY'
};
```

## 📊 **결과:**
- ✅ 모든 기기에서 실시간 공유
- ✅ 월별 집계 자동 계산
- ✅ 완전 무료 (소규모 사용)
- ✅ 백업 자동 생성