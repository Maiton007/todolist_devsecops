# ใช้ Official Nginx Image เป็น Base Image
FROM nginx:stable-alpine

# ลบไฟล์ default ของ Nginx ออกไปก่อน
RUN rm /etc/nginx/conf.d/default.conf

# คัดลอกไฟล์ HTML/CSS/JS ของเราไปไว้ในตำแหน่งที่ Nginx จะเสิร์ฟ (ใน Container)
COPY . /usr/share/nginx/html

# คัดลอกไฟล์ Nginx configuration ที่เราจะสร้างขึ้น
COPY nginx.conf /etc/nginx/conf.d/

# กำหนด Port ที่ Nginx จะเปิดรับการเชื่อมต่อ
EXPOSE 80

# คำสั่งที่จะรันเมื่อ Container เริ่มต้นทำงาน (รัน Nginx server)
CMD ["nginx", "-g", "daemon off;"]
