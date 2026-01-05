from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from PIL import Image
import numpy as np
import mediapipe as mp
from collections import deque
import pytz

app = Flask(__name__)

# ================= DATABASE =================
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///stress.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

class StressRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    stress_value = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

with app.app_context():
    db.create_all()

# ================= MEDIAPIPE =================
mp_face = mp.solutions.face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# ================= STATE =================
previous_nose = None
movement_history = deque(maxlen=15)
baseline_movement = None
last_saved_time = None

# ================= ROUTES =================
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/predict", methods=["POST"])
def predict():
    global previous_nose, movement_history, baseline_movement, last_saved_time

    if "frame" not in request.files:
        return jsonify({"stress_index": 0})

    file = request.files["frame"]
    img = np.array(Image.open(file.stream))

    results = mp_face.process(img)
    stress_value = 0.0

    if results.multi_face_landmarks:
        face = results.multi_face_landmarks[0]
        nose = face.landmark[1]
        nose_point = np.array([nose.x, nose.y])

        if previous_nose is not None:
            movement = np.linalg.norm(nose_point - previous_nose)
            movement_history.append(movement)

            avg = np.mean(movement_history)

            if baseline_movement is None and len(movement_history) >= 7:
                baseline_movement = avg

            if baseline_movement:
                diff = avg - baseline_movement
                score = diff * 5000

                if score < 0.4:
                    stress_value = 0.25
                elif score < 0.9:
                    stress_value = 0.6
                else:
                    stress_value = 0.9

        previous_nose = nose_point
    else:
        previous_nose = None
        movement_history.clear()

    stress_value = round(stress_value, 2)

    # save every 3 sec
    now = datetime.utcnow()
    if last_saved_time is None or (now - last_saved_time).total_seconds() >= 3:
        db.session.add(StressRecord(stress_value=stress_value))
        db.session.commit()
        last_saved_time = now

    return jsonify({"stress_index": stress_value})

@app.route("/history")
def history_page():
    records = StressRecord.query.order_by(
        StressRecord.created_at.desc()
    ).limit(20).all()

    return render_template(
        "history.html",
        records=records,
        ist=pytz.timezone("Asia/Kolkata")
    )

@app.route("/settings")
def settings_page():
    return render_template("settings.html")

if __name__ == "__main__":
    app.run(debug=True)
