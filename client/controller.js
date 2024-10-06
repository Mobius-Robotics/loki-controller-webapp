(function () {
  "use strict";

  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById("fullscreenCanvas");
  const ctx = canvas.getContext("2d");

  class Joystick {
    constructor(centerX, centerY, innerRadius, outerRadius) {
      this.centerX = centerX;
      this.centerY = centerY;
      this.innerRadius = innerRadius;
      this.outerRadius = outerRadius;

      /** @type {Touch | null} */
      this.currentTouch = null;

      canvas.addEventListener("touchstart", this.ontouchstart.bind(this));
      canvas.addEventListener("touchmove", this.ontouchmove.bind(this));
      canvas.addEventListener("touchend", this.ontouchend.bind(this));
      canvas.addEventListener("touchcancel", this.ontouchcancel.bind(this));
    }

    draw() {
      ctx.beginPath();
      ctx.strokeStyle = "white";
      ctx.arc(this.centerX, this.centerY, this.outerRadius, 0, 2 * Math.PI);
      ctx.stroke();

      const { angle, distance } = this.polarValue();
      ctx.beginPath();
      ctx.strokeStyle = "white";
      ctx.fillStyle = `rgba(255, 255, 255, ${distance / (this.outerRadius - this.innerRadius)})`;
      ctx.arc(
        this.centerX + distance * Math.cos(angle),
        this.centerY + distance * Math.sin(angle),
        this.innerRadius,
        0,
        2 * Math.PI,
      );
      ctx.fill();
      ctx.stroke();

      const { x, y } = this.cartesianValue();
      ctx.fillStyle = "white";
      ctx.font = "20px monospace";
      const measure = ctx.measureText(`(${x.toFixed(2)}, ${y.toFixed(2)})`);
      ctx.fillText(
        `(${x.toFixed(2)}, ${y.toFixed(2)})`,
        this.centerX - measure.width / 2,
        this.centerY - this.outerRadius - 10,
      );
    }

    cartesianValue() {
      const { angle, distance } = this.polarValue();
      return {
        x: (distance * Math.cos(angle)) / (this.outerRadius - this.innerRadius),
        y: (distance * Math.sin(angle)) / (this.outerRadius - this.innerRadius),
      };
    }

    polarValue() {
      if (this.currentTouch === null) return { angle: 0, distance: 0 };
      const dx = this.currentTouch.pageX - this.centerX;
      const dy = this.currentTouch.pageY - this.centerY;
      const angle = Math.atan2(dy, dx);
      const distance = Math.min(this.outerRadius - this.innerRadius, Math.hypot(dx, dy));
      return { angle, distance };
    }

    ontouchstart(event) {
      if (canvas.requestFullscreen) canvas.requestFullscreen();
      if (this.currentTouch !== null) return;
      const ourTouch = Array.from(event.changedTouches).find(
        (touch) =>
          Math.hypot(touch.pageX - this.centerX, touch.pageY - this.centerY) < this.outerRadius,
      );
      if (ourTouch === undefined) return;
      this.currentTouch = copyTouch(ourTouch);
    }

    ontouchmove(event) {
      if (this.currentTouch === null) return;
      const ourTouch = Array.from(event.changedTouches).find(
        (touch) => touch.identifier === this.currentTouch.identifier,
      );
      if (ourTouch === undefined) return;
      this.currentTouch = copyTouch(ourTouch);
    }

    ontouchend(event) {
      if (this.currentTouch === null) return;
      const ourTouch = Array.from(event.changedTouches).find(
        (touch) => touch.identifier === this.currentTouch.identifier,
      );
      if (ourTouch === undefined) return;
      this.currentTouch = null;
    }

    ontouchcancel(event) {
      if (this.currentTouch === null) return;
      const ourTouch = Array.from(event.changedTouches).find(
        (touch) => touch.identifier === this.currentTouch.identifier,
      );
      if (ourTouch === undefined) return;
      this.currentTouch = null;
    }
  }

  class Slider {
    constructor(label, centerX, topY, bottomY, returnOnRelease) {
      this.label = label;
      this.centerX = centerX;
      this.topY = topY;
      this.bottomY = bottomY;
      this.returnOnRelease = returnOnRelease;

      this.value = 0;

      /** @type {Touch | null} */
      this.currentTouch = null;

      canvas.addEventListener("touchstart", this.ontouchstart.bind(this));
      canvas.addEventListener("touchmove", this.ontouchmove.bind(this));
      canvas.addEventListener("touchend", this.ontouchend.bind(this));
      canvas.addEventListener("touchcancel", this.ontouchcancel.bind(this));
    }

    draw() {
      ctx.beginPath();
      ctx.strokeStyle = "white";
      ctx.moveTo(this.centerX, this.topY);
      ctx.lineTo(this.centerX, this.bottomY);
      ctx.stroke();

      const y = this.centerY + this.value * this.radius;
      ctx.beginPath();
      ctx.strokeStyle = "white";
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.arc(this.centerX, y, 10, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "white";
      ctx.font = "20px monospace";
      const measure = ctx.measureText(this.value.toFixed(2));
      ctx.fillText(this.value.toFixed(2), this.centerX - measure.width / 2, this.topY - 5);

      ctx.fillStyle = "white";
      ctx.font = "20px monospace";
      const measureLabel = ctx.measureText(this.label);
      ctx.fillText(this.label, this.centerX - measureLabel.width / 2, this.bottomY + 25);
    }

    get centerY() {
      return (this.bottomY + this.topY) / 2;
    }

    get radius() {
      return (this.bottomY - this.topY) / 2;
    }

    recalculateValue() {
      const delta = this.currentTouch.pageY - this.centerY;
      const direction = Math.sign(delta);
      const clampedDistance = Math.min(Math.abs(delta) / ((this.bottomY - this.topY) / 2), 1);
      this.value = direction * clampedDistance;
    }

    ontouchstart(event) {
      if (this.currentTouch !== null) return;
      const ourTouch = Array.from(event.changedTouches).find(
        (touch) => Math.abs(touch.pageX - this.centerX) < 20,
      );
      if (ourTouch === undefined) return;
      this.currentTouch = copyTouch(ourTouch);
      this.recalculateValue();
    }

    ontouchmove(event) {
      if (this.currentTouch === null) return;
      const ourTouch = Array.from(event.changedTouches).find(
        (touch) => touch.identifier === this.currentTouch.identifier,
      );
      if (ourTouch === undefined) return;
      this.currentTouch = copyTouch(ourTouch);
      this.recalculateValue();
    }

    ontouchend(event) {
      if (this.currentTouch === null) return;
      const ourTouch = Array.from(event.changedTouches).find(
        (touch) => touch.identifier === this.currentTouch.identifier,
      );
      if (ourTouch === undefined) return;
      this.currentTouch = null;
      if (this.returnOnRelease) {
        this.value = 0;
      }
    }

    ontouchcancel(event) {
      this.ontouchend(event);
    }
  }

  const joystick = new Joystick(0, 0, 0, 0);
  const sliders = ["Elevator", "Claw", "ω"].map(
    (label, idx) => new Slider(label, 0, 0, 0, idx == 2),
  );

  const urlParams = new URLSearchParams(window.location.search);
  const webSocket = new WebSocket(
    `ws://${urlParams.get("host") || "localhost"}:${urlParams.get("port") || "5743"}`,
  );

  // Set canvas dimensions to match the window size
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const outerRadius = canvas.width / 4 - 20;
    const innerRadius = outerRadius / 2;

    joystick.innerRadius = innerRadius;
    joystick.outerRadius = outerRadius;
    joystick.centerX = canvas.width / 2 - outerRadius;
    joystick.centerY = canvas.height / 2;
    sliders.forEach((slider, idx) => {
      slider.centerX = canvas.width / 2 + 150 + 80 * idx;
      slider.topY = 30;
      slider.bottomY = canvas.height - 30;
    });
  }

  // https://developer.mozilla.org/en-US/docs/Web/API/Touch_events
  function copyTouch({ identifier, pageX, pageY }) {
    return { identifier, pageX, pageY };
  }

  // Call the function once on page load
  resizeCanvas();

  // Ensure the canvas resizes when the window is resized
  window.addEventListener("resize", resizeCanvas);

  function loop() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    joystick.draw();
    sliders.forEach((slider) => slider.draw());

    const sliderValues = {};
    sliders.forEach((slider) => {
      sliderValues[slider.label] = slider.value;
    });
    if (webSocket.readyState === WebSocket.OPEN) {
      webSocket.send(
        JSON.stringify({
          joystick: joystick.cartesianValue(),
          sliders: sliderValues,
        }),
      );
    }

    requestAnimationFrame(loop);
  }

  loop();
})();
