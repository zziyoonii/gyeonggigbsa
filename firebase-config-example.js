// Firebase 설정 예시
// 실제 사용시 index.html의 firebaseConfig 부분을 아래와 같이 수정하세요

const firebaseConfig = {
    apiKey: "your-api-key-here",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id"
};

// Firebase 프로젝트 생성 방법:
// 1. https://console.firebase.google.com 접속
// 2. "프로젝트 추가" 클릭
// 3. 프로젝트 이름 입력 (예: cleaning-supplies-system)
// 4. Google Analytics 설정 (선택사항)
// 5. "프로젝트 만들기" 클릭
// 6. 프로젝트 설정 > 일반 탭에서 웹 앱 추가
// 7. 앱 이름 입력하고 "앱 등록" 클릭
// 8. 표시되는 설정 정보를 위의 firebaseConfig에 복사

// Firestore 데이터베이스 설정:
// 1. Firebase 콘솔에서 "Firestore Database" 클릭
// 2. "데이터베이스 만들기" 클릭
// 3. "테스트 모드에서 시작" 선택 (나중에 보안 규칙 설정 가능)
// 4. 지역 선택 (asia-northeast3 - 서울 권장)
// 5. "완료" 클릭

// 보안 규칙 설정 (선택사항):
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     match /submissions/{document} {
//       allow read, write: if true; // 모든 사용자가 읽기/쓰기 가능
//     }
//   }
// }