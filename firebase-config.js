/* =========================================================
   DÁN CẤU HÌNH FIREBASE CỦA BẠN VÀO ĐÂY
   Lấy ở: Firebase Console -> ⚙️ Project settings -> mục "Your apps" -> SDK setup and configuration
   (Xem hướng dẫn đầy đủ trong README.md)
========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyDYvwIPea1bMCqpaBa20sol6RB8nQga_sg",
  authDomain: "trang-bio-cua-toi.firebaseapp.com",
  projectId: "trang-bio-cua-toi",
  storageBucket: "trang-bio-cua-toi.firebasestorage.app",
  messagingSenderId: "477154277734",
  appId: "1:477154277734:web:691c6783141a4ec27db0a7"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

/* Toàn bộ dữ liệu trang được lưu trong 1 document duy nhất tại: site/data */
const DOC_REF = db.collection("site").doc("data");
