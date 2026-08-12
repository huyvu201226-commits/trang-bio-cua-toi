# Trang Bio Của Tôi — bản 2 trang, lưu vĩnh viễn

## Cấu trúc mới
- `index.html` — **Trang chính**, ai cũng xem được, chỉ đọc (không sửa được).
- `edit.html` — **Trang chỉnh sửa**, có đăng nhập bằng email/mật khẩu, chỉ mình bạn vào được.
- Khi bạn lưu thay đổi ở `edit.html`, dữ liệu được ghi lên Firebase (một dịch vụ lưu trữ miễn phí của Google) — `index.html` sẽ tự cập nhật theo, cho **mọi người, mọi lúc, mọi thiết bị**, không mất khi tắt trình duyệt.

Bạn cần làm 2 việc: (1) tạo dự án Firebase để có nơi lưu dữ liệu, (2) đưa các file lên GitHub Pages để có link công khai.

---

## Phần 1 — Tạo Firebase (chỗ lưu dữ liệu)

1. Vào https://console.firebase.google.com, đăng nhập bằng Google, bấm **"Add project"**, đặt tên tuỳ ý, tạo xong bấm **Continue** tới khi vào được trang dự án.
2. Ở menu trái, vào **Build → Firestore Database → Create database**. Chọn 1 vị trí máy chủ bất kỳ, chọn chế độ **"Start in test mode"** (sẽ khoá lại ở bước 4).
3. Vẫn ở menu trái, vào **Build → Authentication → Get started**. Chọn nhà cung cấp **Email/Password**, bật (Enable) lên, bấm **Save**. Qua tab **Users**, bấm **Add user**, nhập email + mật khẩu mà **chính bạn** sẽ dùng để đăng nhập trang sửa.
4. Vào **Firestore Database → tab Rules**, thay toàn bộ nội dung bằng đoạn sau rồi bấm **Publish**:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /site/data {
         allow read: if true;
         allow write: if request.auth != null;
       }
     }
   }
   ```
   (Ai cũng đọc được để xem trang chính, nhưng chỉ người đã đăng nhập mới ghi/sửa được.)
5. Bấm biểu tượng ⚙️ cạnh "Project Overview" → **Project settings**. Kéo xuống mục **"Your apps"**, bấm biểu tượng `</>` (Web) để tạo 1 web app, đặt tên tuỳ ý, **không cần** tick Firebase Hosting, bấm **Register app**.
6. Firebase sẽ hiện ra một đoạn code chứa `firebaseConfig = { apiKey: ..., authDomain: ..., ... }`. Copy các giá trị đó, mở file **`firebase-config.js`** trong bộ file này và dán đè vào đúng chỗ.

Xong phần này — lưu file lại.

---

## Phần 2 — Đưa lên GitHub (để có link công khai)

1. Vào https://github.com, tạo tài khoản nếu chưa có, đăng nhập.
2. Bấm dấu **"+"** góc trên bên phải → **New repository**. Đặt tên repo (VD: `trang-bio-cua-toi`), để **Public**, bấm **Create repository**.
3. Trong trang repo vừa tạo, bấm **"uploading an existing file"** (hoặc **Add file → Upload files**).
4. Kéo thả **toàn bộ** các file: `index.html`, `edit.html`, `style.css`, `common.js`, `view.js`, `edit.js`, `firebase-config.js` (đã điền thông tin) vào ô upload. **Không cần** upload `README.md` (chỉ để bạn đọc).
5. Kéo xuống dưới, bấm **Commit changes** để lưu.
6. Vào tab **Settings** của repo → mục **Pages** (menu trái) → ở **Branch**, chọn `main` và thư mục `/ (root)` → bấm **Save**.
7. Đợi khoảng 1 phút, tải lại trang Settings → Pages, GitHub sẽ hiện link dạng:
   `https://ten-tai-khoan.github.io/trang-bio-cua-toi/`
   - Link này (không có `edit.html`) chính là **trang chính** — link để chia sẻ công khai.
   - Thêm `edit.html` vào cuối link đó để vào **trang chỉnh sửa** (VD: `.../edit.html`) — chỉ mình bạn nên biết link này.

Từ giờ, mỗi lần muốn đổi nội dung, bạn mở link `edit.html`, đăng nhập, sửa — trang chính sẽ tự cập nhật theo, còn dữ liệu thì lưu mãi mãi trên Firebase.

## Lưu ý về hình ảnh
Ảnh bạn tải lên (avatar, ảnh bìa, ảnh nền, ảnh liên kết) được lưu thẳng vào dữ liệu (base64), nên nếu dùng nhiều ảnh lớn, dữ liệu sẽ nặng hơn. Nếu sau này thấy chậm, nên nén ảnh nhỏ lại trước khi tải lên.
