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
4. Vào **Firestore Database → tab Rules**, thay toàn bộ nội dung bằng đoạn sau rồi bấm **Publish** (đã gồm cả phần Đánh giá):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {

       // Dữ liệu trang bio, cấu hình đánh giá, biểu cảm: ai cũng đọc, chỉ chủ trang ghi
       match /site/{doc} {
         allow read: if true;
         allow write: if request.auth != null;
       }

       // Bình luận: mã tài liệu = mã thiết bị => mỗi thiết bị chỉ tạo được 1 lần
       match /reviews/{id} {
         allow read: if true;
         allow create: if request.resource.data.keys().hasOnly(['name','stars','text','reply','ts'])
           && request.resource.data.name is string
           && request.resource.data.name.size() > 0 && request.resource.data.name.size() <= 40
           && request.resource.data.stars is int
           && request.resource.data.stars >= 1 && request.resource.data.stars <= 5
           && request.resource.data.text is string && request.resource.data.text.size() <= 500
           && request.resource.data.reply == ''
           && request.resource.data.ts == request.time
           && !exists(/databases/$(database)/documents/blocked/$(id));
         allow update, delete: if request.auth != null;
       }

       // Thiết bị bị chặn + lý do thông báo cho họ
       match /blocked/{id} {
         allow get: if true;
         allow list, update, delete: if request.auth != null;
         allow create: if request.auth != null
           || (request.resource.data.keys().hasOnly(['reason','word','ts','by'])
               && request.resource.data.reason is string && request.resource.data.reason.size() <= 400
               && request.resource.data.ts == request.time);
       }
     }
   }
   ```
   (Ai cũng đọc được để xem trang; khách chỉ được **tạo 1 bình luận hợp lệ** cho mỗi thiết bị; chỉ chủ trang đã đăng nhập mới sửa / xoá / trả lời / chặn.)
5. Bấm biểu tượng ⚙️ cạnh "Project Overview" → **Project settings**. Kéo xuống mục **"Your apps"**, bấm biểu tượng `</>` (Web) để tạo 1 web app, đặt tên tuỳ ý, **không cần** tick Firebase Hosting, bấm **Register app**.
6. Firebase sẽ hiện ra một đoạn code chứa `firebaseConfig = { apiKey: ..., authDomain: ..., ... }`. Copy các giá trị đó, mở file **`firebase-config.js`** trong bộ file này và dán đè vào đúng chỗ.

Xong phần này — lưu file lại.

---

## Phần 2 — Đưa lên GitHub (để có link công khai)

1. Vào https://github.com, tạo tài khoản nếu chưa có, đăng nhập.
2. Bấm dấu **"+"** góc trên bên phải → **New repository**. Đặt tên repo (VD: `trang-bio-cua-toi`), để **Public**, bấm **Create repository**.
3. Trong trang repo vừa tạo, bấm **"uploading an existing file"** (hoặc **Add file → Upload files**).
4. Kéo thả **toàn bộ** các file: `index.html`, `edit.html`, `style.css`, `common.js`, `view.js`, `edit.js`, `firebase-config.js` (đã điền thông tin) và **3 tệp mới của phần Đánh giá**: `reviews.css`, `reviews.js`, `reviews-admin.js` vào ô upload. **Không cần** upload `README.md` (chỉ để bạn đọc).
5. Kéo xuống dưới, bấm **Commit changes** để lưu.
6. Vào tab **Settings** của repo → mục **Pages** (menu trái) → ở **Branch**, chọn `main` và thư mục `/ (root)` → bấm **Save**.
7. Đợi khoảng 1 phút, tải lại trang Settings → Pages, GitHub sẽ hiện link dạng:
   `https://ten-tai-khoan.github.io/trang-bio-cua-toi/`
   - Link này (không có `edit.html`) chính là **trang chính** — link để chia sẻ công khai.
   - Thêm `edit.html` vào cuối link đó để vào **trang chỉnh sửa** (VD: `.../edit.html`) — chỉ mình bạn nên biết link này.

Từ giờ, mỗi lần muốn đổi nội dung, bạn mở link `edit.html`, đăng nhập, sửa — trang chính sẽ tự cập nhật theo, còn dữ liệu thì lưu mãi mãi trên Firebase.

## Lưu ý về hình ảnh
Ảnh bạn tải lên (avatar, ảnh bìa, ảnh nền, ảnh liên kết) được lưu thẳng vào dữ liệu (base64), nên nếu dùng nhiều ảnh lớn, dữ liệu sẽ nặng hơn. Nếu sau này thấy chậm, nên nén ảnh nhỏ lại trước khi tải lên.

## Các tính năng mới

**1. Chân trang phủ mờ xám (đè lên nền trang)**
Ở cuối trang chỉnh sửa (`edit.html`) có một dòng chữ nằm cố định phía dưới cùng màn hình, nền là lớp kính mờ xám (không phải chân trang bên trong khung thẻ trắng). Bấm thẳng vào dòng chữ đó để gõ nội dung tuỳ ý (bản quyền, liên hệ, khẩu hiệu...). Nội dung này lưu vào `footerText` và hiển thị y hệt cho mọi người xem `index.html`.

**2. Nền trang: màu / ảnh tuỳ chỉnh / hoạt ảnh (video)**
Ở nút **"Nền trang"** trên thanh công cụ của `edit.html`, ngoài chọn màu và tải ảnh như cũ, giờ có thêm mục **"Hoạt ảnh"**: dán link video `.mp4` bất kỳ rồi bấm **"Dùng hoạt ảnh này"** để video đó tự động phát lặp làm nền động (có sẵn 1 link hoạt ảnh mẫu tại `https://huyvu201226-commits.github.io/N-n-ng/video.mp4`, bạn có thể thay bằng link khác). Chỉ 1 kiểu nền hiển thị tại một thời điểm — dòng chữ nhỏ trong bảng cho biết đang dùng kiểu nào.

**3. Kích cỡ khung trang tuỳ chỉnh**
Nút **"Kích cỡ khung"** trên thanh công cụ mở thanh trượt để phóng to/thu nhỏ toàn bộ khung thẻ (85%–135%). Mọi phần bên trong — ảnh bìa, avatar, chữ, hộp liên kết — đều co giãn theo cùng một hệ số nên luôn cân đối, không bị vỡ giao diện dù chỉnh lớn hay nhỏ. Trên điện thoại rất hẹp, khung vẫn tự động co về vừa màn hình để không bị tràn.

---

## Phần ĐÁNH GIÁ (mới)

### Người xem thấy gì
- **Khung "Đánh giá & nhận xét"** nằm ngay dưới khung bio, phía trên chân trang. Chưa vào xem lần nào thì khung **lấp lánh** (quét sáng + sao nhấp nháy); vào rồi thì hết lấp lánh.
- Chạm/bấm vào trang lần đầu → nút **★ Đánh giá** hiện ở góc trái dưới. Bấm khung hoặc nút ★ → trang bio **đổi ngay tại chỗ** (cùng nền) sang trang đánh giá (đường dẫn `…/#danh-gia`, nút Back của trình duyệt dùng được).
- Trang đánh giá: **avatar khác của admin** trong khung tròn trong suốt, **vòng vàng quanh avatar** thể hiện điểm trung bình trên thang 5 sao, kèm số ★ (tính từ đánh giá thật). Bên dưới là form: **tên → 5 sao (chạm mức nào sáng tới mức đó) → ô slogan bấm nhanh → bình luận thêm**, rồi danh sách bình luận **rải xuống** từng khung kính.
- Gửi xong: bình luận của người đó **nổi lên đầu danh sách**, avatar admin **đổi thành biểu cảm động** của đúng mức sao đó trong vài giây (admin chỉnh), rồi trở lại avatar.
- **Góc phải dưới**: các bình luận **5 sao** chạy kiểu live TikTok — hiện từng dòng, dòng cũ trượt lên, mờ dần rồi biến mất, không bấm được.
- Mỗi **thiết bị** chỉ bình luận **1 lần** (mã thiết bị lưu trong trình duyệt + cookie, và là mã tài liệu trên Firebase nên máy chủ cũng từ chối lần 2).

### Admin (trang `edit.html`, tab **Đánh giá** cạnh tab **Trang bio**)
- **Bình luận**: thống kê sao, lọc/tìm, trả lời nhanh (có mẫu trả lời sẵn, `Ctrl+Enter` để gửi), xoá, hoặc **xoá & chặn thiết bị** kèm lý do. Có bình luận mới → hiện thông báo, âm báo, huy hiệu đỏ trên tab (và thông báo trình duyệt nếu bật). **Không cần duyệt** — bình luận hiện ngay; trả lời/xoá của admin cập nhật ngay ở trang chính.
- **Giao diện**: avatar riêng của trang đánh giá, tiêu đề, **màu / độ trong / độ mờ / bo góc / độ méo nền của khung kính** (khu xem trước có 3 quả cầu kéo được để thấy nền bị méo), danh sách **slogan bấm nhanh**, mẫu trả lời nhanh.
- **Biểu cảm theo sao**: mỗi mức 1–5★ gắn ảnh / GIF / video từ máy (hoặc dán link). Ảnh tự cắt vuông giữa; mọi thứ hiển thị trong khung tròn nên **4 góc bị bỏ**. Chỉnh được **số giây** hiển thị.
- **Luật & chặn**: danh sách từ ngữ tiêu cực (không phân biệt hoa/thường, có dấu hay không dấu, bắt cả kiểu viết tách ký tự), lý do hiện cho người dùng (dùng `{word}`). Bình luận vi phạm bị chặn ngay lúc gửi, và nếu lọt qua thì bị **tự xoá** khi bạn đang mở trang sửa; thiết bị đó bị **chặn** và nhận **thông báo lý do**. Có nút "Quét lại tất cả" và danh sách thiết bị bị chặn để **bỏ chặn**.
- **Mô phỏng lỗi**: xem người dùng sẽ thấy gì ở các lỗi hay gặp + cách khắc phục; nút **Kiểm tra hệ thống thật** thử bằng một "khách" ẩn danh để biết Rules đã đúng chưa.

### Tải trang
Phần Đánh giá (`reviews.css` + `reviews.js`) **chỉ bắt đầu tải sau khi trang bio đã hiển thị xong** (và trình duyệt rảnh); khu quản trị cũng vậy. Biểu cảm chỉ tải khi cần.

### Giới hạn nên biết
- **Chống lặp bình luận không tuyệt đối**: xoá dữ liệu trình duyệt hoặc dùng chế độ ẩn danh sẽ tạo mã thiết bị mới. Muốn chặt hơn cần đăng nhập người dùng hoặc Firebase App Check.
- Trang chỉ tải **100 bình luận mới nhất** (hằng số `REVIEW_LIMIT` trong `reviews.js`) để tiết kiệm lượt đọc miễn phí của Firebase; điểm trung bình tính trên số này.
- Ảnh động/video tải từ máy tối đa **640KB** (giới hạn ~1MB/tài liệu của Firestore); nặng hơn hãy dán link.
- Hiệu ứng **méo nền sau kính** chỉ có trên trình duyệt nhân Chrome/Edge/Android (Safari/Firefox vẫn có kính mờ). Máy yếu bị giật → kéo "Độ méo nền" về 0.
- Từ cấm lưu trong cấu hình công khai (cần để kiểm tra ngay lúc gửi), nên ai biết cách đọc dữ liệu có thể xem được danh sách.
