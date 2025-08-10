/**
 * Google Apps Script 코드
 * Google Sheets와 웹사이트를 연결하는 서버 역할
 * 
 * 설정 방법:
 * 1. script.google.com 접속
 * 2. 새 프로젝트 생성
 * 3. 아래 코드 복사/붙여넣기
 * 4. 배포 > 새 배포 > 웹 앱으로 배포
 * 5. 실행 대상: 나, 액세스 권한: 모든 사용자
 * 6. 배포 URL을 웹사이트의 GOOGLE_SCRIPT_URL에 입력
 */

// Google Sheets ID (실제 시트 ID로 교체)
const SHEET_ID = '1YA71BqAQGsrMuD2sGccNvUcV84gplyCuMkGjvDLp8Ac';
const SHEET_NAME = '미화품목신청';

// 공통: CORS
function withCors(output) {
  var out = output || ContentService.createTextOutput('');
  return out.setMimeType(ContentService.MimeType.JSON);
}

// 표준 헤더 정의(프론트엔드와 동일 키)
function getStandardHeaders() {
  // 사용자 친화적인 한글 헤더
  return [
    '식별자','제출시각','신청자','부서','신청일','월',
    '봉투','걸레','락스','세제','휴지','쓰레기봉투','장갑','빗자루','비고'
  ];
}

// 시트 가져오기 또는 생성 + 헤더 보장
function getOrCreateSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  const headers = getStandardHeaders();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  const lastCol = sheet.getLastColumn();
  if (lastCol > headers.length) {
    sheet.getRange(1, headers.length + 1, 1, lastCol - headers.length).clearContent();
  }
  return sheet;
}

// GET: 전체/월별 조회 → { submissions: [...] } 또는 JSONP(callback)
function doGet(e) {
  try {
    // 관리요약 탭 원격 생성 훅: /exec?setup=managerSummary
    if (e && e.parameter && e.parameter.setup === 'managerSummary') {
      createManagerSummary();
      return withCors(ContentService.createTextOutput(JSON.stringify({ success: true, setup: 'managerSummary' })));
    }

    const monthFilter = e && e.parameter && e.parameter.month;
    const sheet = getOrCreateSheet();
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      var emptyObj = { submissions: [] };
      var cbEmpty = e && e.parameter && e.parameter.callback;
      if (cbEmpty) {
        return ContentService.createTextOutput(cbEmpty + '(' + JSON.stringify(emptyObj) + ')')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return withCors(ContentService.createTextOutput(JSON.stringify(emptyObj)));
    }

    const [header, ...rows] = values;
    // 한글 헤더 → API는 영문 키로 반환
    var idx = {};
    header.forEach(function(h,i){ idx[h]=i; });
    const items = rows.map(function(r){
      return {
        id: r[idx['식별자']],
        submittedAt: r[idx['제출시각']],
        name: r[idx['신청자']],
        department: r[idx['부서']],
        date: r[idx['신청일']],
        month: r[idx['월']],
        envelope: Number(r[idx['봉투']]||0),
        rag: Number(r[idx['걸레']]||0),
        bleach: Number(r[idx['락스']]||0),
        detergent: Number(r[idx['세제']]||0),
        tissue: Number(r[idx['휴지']]||0),
        trashbag: Number(r[idx['쓰레기봉투']]||0),
        gloves: Number(r[idx['장갑']]||0),
        broom: Number(r[idx['빗자루']]||0),
        memo: r[idx['비고']]||''
      };
    });
    const submissions = monthFilter ? items.filter(function(x){return x.month===monthFilter;}) : items;
    var cb = e && e.parameter && e.parameter.callback;
    if (cb) {
      return ContentService.createTextOutput(cb + '(' + JSON.stringify({ submissions: submissions }) + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return withCors(ContentService.createTextOutput(JSON.stringify({ submissions: submissions })));
  } catch (err) {
    return withCors(ContentService.createTextOutput(JSON.stringify({ error: String(err) })));
  }
}

// POST: 생성/수정/삭제 (form-encoded 간단요청 대응)
function getParams(e){
  var p = (e && e.parameter) ? Object.assign({}, e.parameter) : {};
  if (e && e.postData && e.postData.contents) {
    try {
      var json = JSON.parse(e.postData.contents);
      Object.keys(json).forEach(function(k){ if (p[k] == null) p[k] = json[k]; });
    } catch(err) {}
  }
  return p;
}

function doPost(e) {
  try {
    var p = getParams(e);
    var action = p.action || 'create';
    var sheet = getOrCreateSheet();
    var headers = getStandardHeaders();

    if (action === 'create') {
      var id = String(new Date().getTime());
      var submittedAt = new Date().toISOString();
      var dateVal = (p.date || '');
      var month = dateVal ? String(dateVal).slice(0, 7) : '';
      var rowObjK = {
        '식별자': id,
        '제출시각': submittedAt,
        '신청자': (p.name || p['name']) || '',
        '부서': (p.department || p['department']) || '',
        '신청일': dateVal,
        '월': month,
        '봉투': +(p.envelope || p['envelope']) || 0,
        '걸레': +(p.rag || p['rag']) || 0,
        '락스': +(p.bleach || p['bleach']) || 0,
        '세제': +(p.detergent || p['detergent']) || 0,
        '휴지': +(p.tissue || p['tissue']) || 0,
        '쓰레기봉투': +(p.trashbag || p['trashbag']) || 0,
        '장갑': +(p.gloves || p['gloves']) || 0,
        '빗자루': +(p.broom || p['broom']) || 0,
        '비고': (p.memo || p['memo']) || ''
      };
      var row = headers.map(function(h){ return rowObjK[h] || ''; });
      sheet.appendRow(row);
      return withCors(ContentService.createTextOutput(JSON.stringify({ success: true, id: id })));
    }

    if (action === 'update') {
      if (!p.id) return withCors(ContentService.createTextOutput(JSON.stringify({ success: false, error: 'id required' })));
      var values = sheet.getDataRange().getValues();
      var header = values[0];
      var idIdx = header.indexOf('식별자');
      var rowIdx = -1;
      for (var i=1;i<values.length;i++) { if (String(values[i][idIdx]) === String(p.id)) { rowIdx = i; break; } }
      if (rowIdx < 0) return withCors(ContentService.createTextOutput(JSON.stringify({ success: false, error: 'not found' })));
      var targetRow = rowIdx + 1; // 1-based
      var kMap = {
        name:'신청자', department:'부서', date:'신청일', month:'월',
        envelope:'봉투', rag:'걸레', bleach:'락스', detergent:'세제',
        tissue:'휴지', trashbag:'쓰레기봉투', gloves:'장갑', broom:'빗자루', memo:'비고'
      };
      Object.keys(p).forEach(function(key){
        var colName = kMap[key];
        if (colName) {
          var col = header.indexOf(colName);
          if (col >= 0) sheet.getRange(targetRow, col + 1).setValue(p[key]);
        }
      });
      return withCors(ContentService.createTextOutput(JSON.stringify({ success: true })));
    }

    if (action === 'delete') {
      if (!p.id) return withCors(ContentService.createTextOutput(JSON.stringify({ success: false, error: 'id required' })));
      var values2 = sheet.getDataRange().getValues();
      var header2 = values2[0];
      var idIdx2 = header2.indexOf('식별자');
      var rowIdx2 = -1;
      for (var j=1;j<values2.length;j++) { if (String(values2[j][idIdx2]) === String(p.id)) { rowIdx2 = j; break; } }
      if (rowIdx2 < 0) return withCors(ContentService.createTextOutput(JSON.stringify({ success: false, error: 'not found' })));
      sheet.deleteRow(rowIdx2 + 1);
      return withCors(ContentService.createTextOutput(JSON.stringify({ success: true })));
    }

    // fallback
    return withCors(ContentService.createTextOutput(JSON.stringify({ success: false, error: 'unknown action' })));
  } catch (err) {
    return withCors(ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) })));
  }
}

// PUT: 부분 수정(id 기준)
function doPut(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const id = body.id;
    if (!id) return withCors(ContentService.createTextOutput(JSON.stringify({ success: false, error: 'id required' })));

    const sheet = getOrCreateSheet();
    const values = sheet.getDataRange().getValues();
    const [header, ...rows] = values;
    const idIdx = header.indexOf('id');
    const rowIdx = rows.findIndex(r => String(r[idIdx]) === String(id));
    if (rowIdx < 0) return withCors(ContentService.createTextOutput(JSON.stringify({ success: false, error: 'not found' })));

    const targetRow = rowIdx + 2; // 1-based + header
    Object.keys(body).forEach(key => {
      const col = header.indexOf(key);
      if (col >= 0) sheet.getRange(targetRow, col + 1).setValue(body[key]);
    });

    return withCors(ContentService.createTextOutput(JSON.stringify({ success: true })));
  } catch (err) {
    return withCors(ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) })));
  }
}

// DELETE: 삭제(id 기준)
function doDelete(e) {
  try {
    const id = e && e.parameter && e.parameter.id;
    if (!id) return withCors(ContentService.createTextOutput(JSON.stringify({ success: false, error: 'id required' })));

    const sheet = getOrCreateSheet();
    const values = sheet.getDataRange().getValues();
    const [header, ...rows] = values;
    const idIdx = header.indexOf('식별자');
    const rowIdx = rows.findIndex(function(r){ return String(r[idIdx]) === String(id); });
    if (rowIdx < 0) return withCors(ContentService.createTextOutput(JSON.stringify({ success: false, error: 'not found' })));
    sheet.deleteRow(rowIdx + 2);
    return withCors(ContentService.createTextOutput(JSON.stringify({ success: true })));
  } catch (err) {
    return withCors(ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) })));
  }
}

// 시트 가져오기 또는 생성
// 중복 정의 제거: 상단의 getOrCreateSheet를 사용합니다

// (이전 getData/getMyData 핸들러는 통합되어 doGet에서 처리)

// 테스트 함수
function testFunction() {
  const testData = {
    timestamp: new Date().toLocaleString('ko-KR'),
    name: '테스트',
    department: '테스트부서',
    date: '2024-01-01',
    envelope: 5,
    rag: 3,
    bleach: 2,
    detergent: 1,
    tissue: 4,
    memo: '테스트 데이터입니다'
  };
  
  const sheet = getOrCreateSheet();
  console.log('시트 이름:', sheet.getName());
  console.log('테스트 데이터:', testData);
}

// 관리자 요약 시트 생성/갱신: 한 번 실행하면 '관리요약' 탭이 생깁니다
function createManagerSummary() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var src = getOrCreateSheet(); // '미화품목신청'
  var sh = ss.getSheetByName('관리요약');
  if (!sh) sh = ss.insertSheet('관리요약'); else sh.clear();

  // 머리말/월 입력 안내
  sh.getRange('A1').setValue('관리요약');
  sh.getRange('B1').setValue('월');
  sh.getRange('C1').setValue('예: 2025-08');
  sh.getRange('A1:C1').setFontWeight('bold');

  // 품목 합계 표 헤더
  sh.getRange('A3').setValue('품목');
  sh.getRange('B3').setValue('총요청');
  sh.getRange('C3').setValue('총배정(입력)');
  sh.getRange('D3').setValue('구매수량(=총요청-총배정)');
  sh.getRange('A3:D3').setFontWeight('bold').setBackground('#e8f5e8');

  // 품목 목록
  var items = ['봉투','걸레','락스','세제','휴지','쓰레기봉투','장갑','빗자루'];
  sh.getRange(4,1,items.length,1).setValues(items.map(function(i){return [i];}));

  // 각 품목별 총요청(FILTER) 수식: 미화품목신청!에서 월(C1) 기준 합계
  var mapCol = { '봉투':'G','걸레':'H','락스':'I','세제':'J','휴지':'K','쓰레기봉투':'L','장갑':'M','빗자루':'N' };
  for (var r=0;r<items.length;r++) {
    var item = items[r];
    var col = mapCol[item];
    var row = 4 + r;
    var formula = '=IF($C$1="","",SUM(FILTER(미화품목신청!'+col+'2:'+col+', 미화품목신청!F2:F=$C$1)))';
    sh.getRange(row, 2).setFormula(formula);
    // 구매수량 = 총요청 - 총배정
    sh.getRange(row, 4).setFormula('=IF(B'+row+'="","",B'+row+'-C'+row+')');
  }

  // 구분선
  sh.getRange('A12').setValue('개인별 목록 (월 필터)');
  sh.getRange('A12').setFontWeight('bold');

  // 개인별 필터 표 헤더
  var headers = ['신청자','부서','봉투','걸레','락스','세제','휴지','쓰레기봉투','장갑','빗자루','비고'];
  sh.getRange('A13:K13').setValues([headers]).setFontWeight('bold').setBackground('#f0f0f0');
  // FILTER로 해당 월 데이터 표시
  var filterFormula = '=IF($C$1="","",FILTER({미화품목신청!C2:D, 미화품목신청!G2:N, 미화품목신청!O2:O}, 미화품목신청!F2:F=$C$1))';
  sh.getRange('A14').setFormula(filterFormula);

  // 열 너비/보기 정리
  sh.autoResizeColumns(1, 11);
  sh.setFrozenRows(3);
}