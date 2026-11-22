# Kết nối bảng xếp hạng dùng chung

Điểm và thứ hạng được lưu ở Supabase, không nằm trong bộ nhớ riêng của trình duyệt. Chạy các bước này một lần cho dự án.

## 1. Tạo cơ sở dữ liệu

1. Tạo dự án Supabase miễn phí và mở **SQL Editor → New query**.
2. Sao chép toàn bộ nội dung `schema.sql` vào query rồi nhấn **Run**. Ba tài khoản sẽ được khởi tạo ở 0 điểm.

## 2. Cài và kết nối Supabase CLI

Cài Supabase CLI theo hướng dẫn chính thức, mở terminal tại thư mục dự án (cùng cấp với `index.html`), sau đó chạy:

```text
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Lấy `YOUR_PROJECT_REF` trong **Project Settings → General**.

## 3. Thêm bí mật và triển khai API

Tạo `QUIZ_TOKEN_SECRET` ngẫu nhiên, dài tối thiểu 32 ký tự. Đặt mật khẩu mới (không dùng mật khẩu đã từng nằm trong mã web công khai) rồi triển khai hàm:

```text
supabase secrets set QUIZ_TOKEN_SECRET="PASTE_A_LONG_RANDOM_SECRET" QUIZ_ACCOUNTS_JSON='{"NguyenVanKhanh":"SET_NEW_PASSWORD_1","NgoAnhNguyen":"SET_NEW_PASSWORD_2","HuynhTanDuc":"SET_NEW_PASSWORD_3"}'
supabase functions deploy quiz-ranking
```

Thay mật khẩu mẫu bằng mật khẩu mới trước khi dùng bảng xếp hạng thật. Không đưa `service_role` key vào các tệp web.

## 4. Nối trang web với API

Mở `supabase-config.js`, thay các giá trị rỗng bằng URL function và publishable key của dự án (**Project Settings → API Keys**):

```js
window.QUIZ_API_URL = 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/quiz-ranking';
window.QUIZ_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_...';
```

Chỉ dùng publishable key ở trang web; không đưa secret/service-role key vào `supabase-config.js`.

Commit/push toàn bộ tệp dự án lên GitHub; Vercel sẽ triển khai phiên bản mới. Có thể vào ứng dụng bằng tài khoản để xem bảng xếp hạng; khách vẫn luyện tập được nhưng điểm không được lưu. Mỗi câu đúng trong đề thi thử 70 câu cộng 1 điểm; cứ 150 điểm lên một bậc.

## Ghi chú về độ tin cậy điểm

API kiểm tra phiên đăng nhập, giới hạn mỗi lượt thi tối đa 70 điểm và không cộng trùng cùng một mã lượt thi. Vì câu hỏi và phần chấm điểm nằm trong ứng dụng web tĩnh, đây là bảng xếp hạng phù hợp cho nhóm học nhỏ, chưa phải hệ thống chống gian lận cho giải đấu.
