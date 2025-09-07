from flask import Flask, jsonify, request
from flask_cors import CORS
import database as db

app = Flask(__name__)
CORS(app)

db.init_db()

def ok(data, status=200):
    return jsonify({"ok": True, "data": data}), status

def err(message, code="ERROR", status=400):
    return jsonify({"ok": False, "error": {"code": code, "message": message}}), status

@app.get("/api/health")
def health():
    return ok({"status": "healthy"})

# ----- Tasks API -----
@app.post("/api/tasks")
def create_task():
    try:
        payload = request.get_json(force=True, silent=False) or {}
        t = db.create_task(payload)
        return ok(t, 201)
    except ValueError as e:
        m = str(e)
        if m == "TITLE_REQUIRED": return err("กรุณากรอกหัวข้องาน", m, 422)
        if m == "INVALID_STATUS": return err("สถานะไม่ถูกต้อง (todo|done|archived)", m, 422)
        if m == "INVALID_DATE": return err("วันที่ต้องเป็นรูปแบบ YYYY-MM-DD", m, 422)
        return err("ข้อมูลไม่ถูกต้อง", "VALIDATION_ERROR", 422)
    except Exception as e:
        return err(str(e), "SERVER_ERROR", 500)

@app.get("/api/tasks")
def list_tasks():
    try:
        filters = {
            "q": request.args.get("q"),
            "status": request.args.get("status"),
            "tag": request.args.get("tag"),
            "due_before": request.args.get("due_before"),
            "due_after": request.args.get("due_after"),
            "sort": request.args.get("sort"),
            "order": request.args.get("order"),
        }
        return ok(db.list_tasks(filters))
    except ValueError as e:
        if str(e) == "INVALID_DATE":
            return err("วันที่ต้องเป็นรูปแบบ YYYY-MM-DD", "INVALID_DATE", 422)
        return err("ข้อมูลตัวกรองไม่ถูกต้อง", "VALIDATION_ERROR", 422)
    except Exception as e:
        return err(str(e), "SERVER_ERROR", 500)

@app.get("/api/tasks/<int:task_id>")
def get_task(task_id: int):
    try:
        return ok(db.get_task(task_id))
    except KeyError:
        return err("ไม่พบงานนี้", "NOT_FOUND", 404)
    except Exception as e:
        return err(str(e), "SERVER_ERROR", 500)

@app.put("/api/tasks/<int:task_id>")
def update_task(task_id: int):
    try:
        payload = request.get_json(force=True, silent=False) or {}
        return ok(db.update_task(task_id, payload))
    except KeyError:
        return err("ไม่พบงานนี้", "NOT_FOUND", 404)
    except ValueError as e:
        m = str(e)
        if m == "TITLE_REQUIRED": return err("กรุณากรอกหัวข้องาน", m, 422)
        if m == "INVALID_STATUS": return err("สถานะไม่ถูกต้อง (todo|done|archived)", m, 422)
        if m == "INVALID_DATE": return err("วันที่ต้องเป็นรูปแบบ YYYY-MM-DD", m, 422)
        return err("ข้อมูลไม่ถูกต้อง", "VALIDATION_ERROR", 422)
    except Exception as e:
        return err(str(e), "SERVER_ERROR", 500)

@app.delete("/api/tasks/<int:task_id>")
def delete_task(task_id: int):
    try:
        db.delete_task(task_id)
        return "", 204
    except KeyError:
        return err("ไม่พบงานนี้", "NOT_FOUND", 404)
    except Exception as e:
        return err(str(e), "SERVER_ERROR", 500)

@app.patch("/api/tasks/<int:task_id>/toggle")
def toggle_task(task_id: int):
    try:
        return ok(db.toggle_task(task_id))
    except KeyError:
        return err("ไม่พบงานนี้", "NOT_FOUND", 404)
    except Exception as e:
        return err(str(e), "SERVER_ERROR", 500)

if __name__ == "__main__":
    # รันแบบพัฒนา
    app.run(host="0.0.0.0", port=5000, debug=True)
