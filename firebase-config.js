/* =========================================================
   DÁN CẤU HÌNH FIREBASE CỦA BẠN VÀO ĐÂY
   Lấy ở: Firebase Console -> ⚙️ Project settings -> mục "Your apps" -> SDK setup and configuration
   (Xem hướng dẫn đầy đủ trong README.md)
========================================================= */
const firebaseConfig = {
  apiKey: "DÁN_API_KEY_VÀO_ĐÂY",
  authDomain: "TEN-DU-AN.firebaseapp.com",
  projectId: "TEN-DU-AN",
  storageBucket: "TEN-DU-AN.appspot.com",
  messagingSenderId: "SỐ_ID",
  appId: "APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

/* Toàn bộ dữ liệu trang được lưu trong 1 document duy nhất tại: site/data */
const DOC_REF = db.collection("site").doc("data");
