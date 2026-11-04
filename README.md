# Chùa Bạch Vân

Chùa Bắc Bộ 3D trực tuyến cho nhiều người cùng chơi: tạo nhân vật, lễ Phật, lần tràng hạt, thiền định, thắp hương, gõ mõ, thỉnh chuông, nhiệm vụ ngày và tuần, bảng xếp hạng công đức.

## Cấu trúc

- `server.js`: máy chủ Node.js. Phục vụ trang game và kênh WebSocket `/ws` để mọi người thấy nhau.
- `public/index.html`: toàn bộ game (Three.js tải từ CDN).
- `data/board.json`: bảng xếp hạng, tự tạo khi chạy.
- `render.yaml`: cấu hình để đưa lên Render.

Mỗi "Chánh điện" chứa tối đa 80 người. Đầy thì người mới tự sang Chánh điện 2, 3… (đổi bằng biến môi trường `ROOM_CAP`).

## Chạy thử trên máy

Cần Node.js 18 trở lên.

```
npm install
npm start
```

Mở http://localhost:3000. Mở thêm một tab nữa để thấy hai nhân vật cùng lúc.

## Đưa lên mạng miễn phí (Render)

1. Tạo tài khoản GitHub, bấm **New repository**, đặt tên `chua-bach-van`, chọn Public.
2. Trong repo vừa tạo, bấm **Add file → Upload files**, kéo toàn bộ file và thư mục trong gói này vào, bấm **Commit changes**.
3. Vào https://render.com, đăng nhập bằng GitHub.
4. Bấm **New → Blueprint**, chọn repo `chua-bach-van`, bấm **Apply**. Render đọc `render.yaml` và tự cài đặt.
5. Chờ vài phút tới khi trạng thái là **Live**. Link dạng `https://chua-bach-van.onrender.com` là link để chia sẻ.

Nếu không thấy mục Blueprint: bấm **New → Web Service**, chọn repo, Build Command `npm install`, Start Command `npm start`, gói Free.

## Lưu ý với gói miễn phí

- Máy chủ ngủ sau khoảng 15 phút không ai vào. Người đầu tiên vào sau đó phải chờ khoảng 1 phút.
- Ổ đĩa không lưu lâu dài: bảng xếp hạng bị xoá mỗi lần máy chủ khởi động lại. Muốn giữ lâu dài thì dùng gói có ổ đĩa (Render Disk) và đặt biến `DATA_DIR` trỏ tới ổ đó, hoặc chuyển sang cơ sở dữ liệu.
- Công đức của từng người lưu trên trình duyệt của họ. Điểm gửi lên bảng xếp hạng do trình duyệt tự báo nên người rành kỹ thuật có thể gian lận. Muốn chống thì phải chuyển việc tính công đức sang máy chủ.
