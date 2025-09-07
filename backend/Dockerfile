# ใช้ Official Python Image เป็น Base Image
# นี่คือ "ระบบปฏิบัติการ" ขนาดเล็กที่มี Python ติดตั้งมาให้แล้ว
FROM python:3.9-slim-buster

# ตั้งค่า Environment Variable เพื่อไม่ให้ Python สร้างไฟล์ .pyc
ENV PYTHONDONTWRITEBYTECODE =1
# ตั้งค่า Environment Variable เพื่อให้ Python output log ไปที่ stdout/stderr
ENV PYTHONUNBUFFERED =1

# สร้างไดเรกทอรีสำหรับแอปพลิเคชันใน Container
WORKDIR /app

# คัดลอกไฟล์ requirements.txt เข้าไปใน Container
COPY requirements.txt .

# ติดตั้งไลบรารีที่จำเป็น (Flask, Flask-Cors)
RUN pip install --no-cache-dir -r requirements.txt

# คัดลอกโค้ดแอปพลิเคชัน (app.py) เข้าไปใน Container
COPY . .

# กำหนด Port ที่แอปพลิเคชันจะเปิดรับการเชื่อมต่อ
EXPOSE 5000

# คำสั่งที่จะรันเมื่อ Container เริ่มต้นทำงาน (รัน Flask app)
CMD ["python", "app.py"]