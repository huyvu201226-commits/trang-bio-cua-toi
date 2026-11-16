/* =========================================================
   DÁN CẤU HÌNH FIREBASE CỦA BẠN VÀO ĐÂY
   Lấy ở: Firebase Console -> ⚙️ Project settings -> mục "Your apps" -> SDK setup and configuration
   (Xem hướng dẫn đầy đủ trong README.md)
========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyBym_HqQtU_otKkJCyjW-Yv3FFe6HeTM2A",
  authDomain: "bio-j-hush.firebaseapp.com",
  projectId: "bio-j-hush",
  storageBucket: "bio-j-hush.firebasestorage.app",
  messagingSenderId: "515898505309",
  appId: "1:515898505309:web:050d44d7030d0533a6b5b4"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

/* Toàn bộ dữ liệu trang được lưu trong 1 document duy nhất tại: site/data */
const DOC_REF = db.collection("site").doc("data");

/* ---- Dữ liệu cho phần Đánh giá ---- */
const CONFIG_REF  = db.collection("site").doc("reviewConfig");   // cấu hình: kính, slogan, luật lọc, avatar...
const REVIEWS_REF = db.collection("reviews");                    // mỗi bình luận 1 tài liệu, mã = mã thiết bị
const BLOCKED_REF = db.collection("blocked");                    // thiết bị bị chặn + lý do thông báo
const moodRef = (n) => db.collection("site").doc("mood" + n);    // biểu cảm động cho mức sao n (1..5)
