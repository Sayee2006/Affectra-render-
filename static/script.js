document.addEventListener("DOMContentLoaded", () => {

  /* ---------- ELEMENTS ---------- */
  const video = document.getElementById("video");
  const startBtn = document.getElementById("startCamBtn");
  const stopBtn = document.getElementById("stopCamBtn");
  const stressBox = document.getElementById("stress-result");
  const adviceBox = document.getElementById("stress-advice");
  const avgBox = document.getElementById("avg-stress");
  const lastCheckBox = document.getElementById("last-check");

  /* ---------- SAFETY ---------- */
  if (!video || !startBtn || !stressBox) {
    console.error("❌ Required HTML elements missing");
    return;
  }

  /* ---------- STATE ---------- */
  let stream = null;
  let captureTimer = null;
  let resultTimer = null;
  let readings = [];
  let running = false;

  /* ---------- BUTTON EVENTS ---------- */
  startBtn.addEventListener("click", startCamera);
  if (stopBtn) stopBtn.addEventListener("click", stopCamera);

  /* ---------- START CAMERA ---------- */
  async function startCamera() {
    if (running) return;

    running = true;
    readings = [];

    stressBox.innerText = "Measuring...";
    if (adviceBox) adviceBox.innerText = "--";

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" }
      });

      video.srcObject = stream;

      // 🔥 MUST for Chrome autoplay
      video.muted = true;
      video.playsInline = true;
      await video.play();

      startBtn.disabled = true;
      if (stopBtn) stopBtn.disabled = false;

      captureTimer = setInterval(captureFrame, 1000);
      resultTimer = setTimeout(showFinalResult, 30000);

      console.log("✅ Camera started");

    } catch (err) {
      alert("❌ Camera access denied or unavailable");
      console.error("Camera error:", err);
      running = false;
    }
  }

  /* ---------- CAPTURE FRAME ---------- */
  function captureFrame() {
    if (!running || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) return;

      try {
        const fd = new FormData();
        fd.append("frame", blob, "frame.jpg");

        const res = await fetch("/predict", {
          method: "POST",
          body: fd
        });

        const data = await res.json();
        let value = Math.round((data.stress_index || 0) * 100);
        value = Math.max(0, Math.min(100, value));

        readings.push(value);

      } catch (e) {
        console.error("❌ Predict error:", e);
      }
    }, "image/jpeg");
  }

  /* ---------- FINAL RESULT ---------- */
  function showFinalResult() {
    stopCamera();

    if (readings.length === 0) {
      stressBox.innerText = "No data";
      return;
    }

    const avgRaw = Math.round(
      readings.reduce((a, b) => a + b, 0) / readings.length
    );

    const stress = normalizeStress(avgRaw);

    stressBox.innerText = stress + "%";
    if (adviceBox) adviceBox.innerText = getSuggestion(stress);
    applyColor(stress);
    updateAverage(stress);
  }

  /* ---------- STOP CAMERA ---------- */
  function stopCamera() {
    running = false;

    if (captureTimer) clearInterval(captureTimer);
    if (resultTimer) clearTimeout(resultTimer);

    captureTimer = null;
    resultTimer = null;

    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }

    startBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;

    console.log("🛑 Camera stopped");
  }

  /* ---------- STRESS LOGIC ---------- */
  function normalizeStress(v) {
    if (v < 20) return 20;
    if (v < 50) return 40;
    if (v < 75) return 65;
    return 85;
  }

  function getSuggestion(v) {
    if (v <= 40) return "You look relaxed 😄 Keep it up!";
    if (v <= 80) return "You seem tense 😟 Relax jaw & shoulders.";
    return "High stress 😣 Take slow deep breaths 🧘‍♀️";
  }

  function applyColor(v) {
    stressBox.className = "";
    if (v <= 40) stressBox.classList.add("low-stress");
    else if (v <= 80) stressBox.classList.add("mild-stress");
    else stressBox.classList.add("high-stress");
  }

  /* ---------- AVG + HISTORY ---------- */
  function updateAverage(v) {
    if (typeof v !== "number" || isNaN(v)) return;

    let history = JSON.parse(localStorage.getItem("history")) || [];
    history = history.filter(x => typeof x === "number");

    history.push(v);
    if (history.length > 50) history = history.slice(-50);

    const avg = Math.round(
      history.reduce((a, b) => a + b, 0) / history.length
    );

    if (avgBox) avgBox.innerText = avg + "%";
    if (lastCheckBox) lastCheckBox.innerText = new Date().toLocaleString();

    localStorage.setItem("history", JSON.stringify(history));
  }

});
