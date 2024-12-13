class Vector {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  add(other) {
    return new Vector(this.x + other.x, this.y + other.y);
  }

  subtract(other) {
    return new Vector(this.x - other.x, this.y - other.y);
  }

  scale(scalar) {
    return new Vector(this.x * scalar, this.y * scalar);
  }

  dot(other) {
    return this.x * other.x + this.y * other.y;
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  lengthSquared() {
    return this.x * this.x + this.y * this.y;
  }

  normalize() {
    const len = this.length();
    if (len === 0) return new Vector(0, 0);
    return this.scale(1 / len);
  }

  distanceTo(other) {
    return this.subtract(other).length();
  }

  distanceToSquared(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return dx * dx + dy * dy;
  }

  clone() {
    return new Vector(this.x, this.y);
  }

  // Возвращает вектор, повернутый на 90 градусов по часовой стрелке
  perpendicular() {
    return new Vector(this.y, -this.x);
  }
}

class Ball {
  constructor(
    x,
    y,
    radius,
    mass,
    velocity = new Vector(0, 0),
    restitution = 1.0
  ) {
    this.position = new Vector(x, y);
    this.velocity = velocity;
    this.radius = radius;
    this.mass = mass;
    this.restitution = restitution;
  }

  predictPosition(dt) {
    return this.position.add(this.velocity.scale(dt));
  }

  handleCollisions(canvasWidth, canvasHeight) {
    // Проверяем текущую позицию
    if (this.position.x - this.radius < 0) {
      this.position.x = this.radius;
      this.velocity.x = Math.abs(this.velocity.x) * this.restitution;
    } else if (this.position.x + this.radius > canvasWidth) {
      this.position.x = canvasWidth - this.radius;
      this.velocity.x = -Math.abs(this.velocity.x) * this.restitution;
    }

    if (this.position.y - this.radius < 0) {
      this.position.y = this.radius;
      this.velocity.y = Math.abs(this.velocity.y) * this.restitution;
    } else if (this.position.y + this.radius > canvasHeight) {
      this.position.y = canvasHeight - this.radius;
      this.velocity.y = -Math.abs(this.velocity.y) * this.restitution;
    }
  }
}

class PhysicsEngine {
  constructor() {
    this.balls = [];
    this.currentTime = 0;
    this.debugInfo = {
      minDistance: Infinity,
      lastPositions: new Map(),
      collisionsCount: 0,
    };
  }

  add(ball) {
    this.balls.push(ball);
  }

  // Находит следующее столкновение среди всех мячей
  findNextCollision() {
    let nextCollision = null;
    let minTime = Infinity;

    // Проверяем столкновения между мячами
    for (let i = 0; i < this.balls.length; i++) {
      const ball1 = this.balls[i];

      // Проверяем столкновения со стенами
      const wallCollision = this.predictWallCollision(ball1);
      if (wallCollision && wallCollision.time < minTime) {
        nextCollision = wallCollision;
        minTime = wallCollision.time;
      }

      // Проверяем столкновения с другими мячами
      for (let j = i + 1; j < this.balls.length; j++) {
        const ball2 = this.balls[j];
        const collision = this.predictCollision(ball1, ball2);
        if (collision && collision.time < minTime) {
          nextCollision = collision;
          minTime = collision.time;
        }
      }
    }

    return nextCollision;
  }

  predictWallCollision(ball) {
    const pos = ball.position;
    const vel = ball.velocity;
    let minTime = Infinity;
    let wallNormal = null;

    // Проверяем все стены одновременно
    if (vel.x !== 0) {
      if (vel.x < 0) {
        const t = (ball.radius - pos.x) / vel.x;
        if (t >= 0 && t < minTime) {
          minTime = t;
          wallNormal = new Vector(1, 0);
        }
      } else if (vel.x > 0) {
        const t = (canvas.width - ball.radius - pos.x) / vel.x;
        if (t >= 0 && t < minTime) {
          minTime = t;
          wallNormal = new Vector(-1, 0);
        }
      }
    }

    if (vel.y !== 0) {
      if (vel.y < 0) {
        const t = (ball.radius - pos.y) / vel.y;
        if (t >= 0 && t < minTime) {
          minTime = t;
          wallNormal = new Vector(0, 1);
        }
      } else if (vel.y > 0) {
        const t = (canvas.height - ball.radius - pos.y) / vel.y;
        if (t >= 0 && t < minTime) {
          minTime = t;
          wallNormal = new Vector(0, -1);
        }
      }
    }

    return minTime !== Infinity
      ? {
          time: minTime,
          type: "wall",
          ball,
          normal: wallNormal,
        }
      : null;
  }

  predictCollision(ball1, ball2) {
    const relativePosition = ball2.position.subtract(ball1.position);
    const relativeVelocity = ball2.velocity.subtract(ball1.velocity);

    const a = relativeVelocity.lengthSquared();
    if (a === 0) return null; // Если относительная скорость нулевая, столкновения не будет

    const b = 2 * relativePosition.dot(relativeVelocity);
    const c =
      relativePosition.lengthSquared() -
      Math.pow(ball1.radius + ball2.radius, 2);

    // Если мячи уже перекрываются, немедленно вернуть столкновение
    if (c <= 0) {
      // Добавляем проверку на относительную скорость
      if (relativeVelocity.dot(relativePosition) >= 0) {
        return null; // Мячи перекрываются, но движутся в разные стороны
      }
      return {
        time: 0,
        type: "ball",
        ball1,
        ball2,
        normal: relativePosition.normalize(),
      };
    }

    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;

    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    if (t < 0) return null;

    return {
      time: t,
      type: "ball",
      ball1,
      ball2,
      normal: ball2.position
        .add(ball2.velocity.scale(t))
        .subtract(ball1.position.add(ball1.velocity.scale(t)))
        .normalize(),
    };
  }

  resolveCollision(collision) {
    if (collision.type === "wall") {
      const ball = collision.ball;
      ball.position = ball.predictPosition(collision.time);

      // Исправляем отражение от стены
      if (collision.normal.x !== 0) {
        ball.velocity.x = -ball.velocity.x;
      }
      if (collision.normal.y !== 0) {
        ball.velocity.y = -ball.velocity.y;
      }
    } else {
      const { ball1, ball2, normal } = collision;

      // Перемещаем мячи в точку столкновения
      const dt = collision.time - this.currentTime;
      ball1.position = ball1.predictPosition(dt);
      ball2.position = ball2.predictPosition(dt);

      // Вычисляем относительную скорость
      const relativeVelocity = ball2.velocity.subtract(ball1.velocity);
      const velAlongNormal = relativeVelocity.dot(normal);

      // Если мячи движутся в противоположных направлениях, пропускаем обработку
      if (velAlongNormal > 0) return;

      // Проверяем и исправляем перекрытие
      const distance = ball1.position.distanceTo(ball2.position);
      const minDistance = ball1.radius + ball2.radius;

      const OVERLAP_THRESHOLD = 0.0001;

      if (distance < minDistance - OVERLAP_THRESHOLD) {
        const overlap = minDistance - distance;
        const separation = normal.scale(overlap / 2);
        ball1.position = ball1.position.subtract(separation);
        ball2.position = ball2.position.add(separation);
      }

      // Вычисляем импульс
      const restitution = Math.min(ball1.restitution, ball2.restitution);
      const j = -(1 + restitution) * velAlongNormal;
      const impulseScalar = j / (1 / ball1.mass + 1 / ball2.mass);
      const impulse = normal.scale(impulseScalar);

      // Применяем импульс
      ball1.velocity = ball1.velocity.subtract(impulse.scale(1 / ball1.mass));
      ball2.velocity = ball2.velocity.add(impulse.scale(1 / ball2.mass));
    }

    this.debugInfo.collisionsCount++;
  }

  // Основной метод для продвижения симуляции на заданный интервал времени
  step(deltaTime) {
    let remainingTime = deltaTime;

    while (remainingTime > 0) {
      const nextCollision = this.findNextCollision();

      if (!nextCollision || nextCollision.time > remainingTime) {
        // Если нет столкновений или они происходят после оставшегося времени,
        // просто перемещаем все мячи
        for (const ball of this.balls) {
          ball.position = ball.predictPosition(remainingTime);
          // Добавляем принудительную коррекцию позиции
          this.enforceCanvasBounds(ball);
        }
        break;
      }

      // Перемещаем все мячи до момента столкновения
      for (const ball of this.balls) {
        ball.position = ball.predictPosition(nextCollision.time);
        // Добавляем принудительную коррекцию позиции
        this.enforceCanvasBounds(ball);
      }

      // Обрабатываем столкновение
      this.resolveCollision(nextCollision);

      // Уменьшаем оставшееся время
      remainingTime -= nextCollision.time;

      // Если осталось слишком мало времени, прекращаем
      if (remainingTime < deltaTime * 0.001) break;
    }

    // Обновляем отладочную информацию
    this.updateDebugInfo();
  }

  // Добавляем новый метод для принудительной коррекции позиции
  enforceCanvasBounds(ball) {
    // Проверяем и корректируем позицию по X
    if (ball.position.x - ball.radius < 0) {
      ball.position.x = ball.radius;
      ball.velocity.x = Math.abs(ball.velocity.x) * ball.restitution;
    } else if (ball.position.x + ball.radius > canvas.width) {
      ball.position.x = canvas.width - ball.radius;
      ball.velocity.x = -Math.abs(ball.velocity.x) * ball.restitution;
    }

    // Проверяем и корректируем позицию по Y
    if (ball.position.y - ball.radius < 0) {
      ball.position.y = ball.radius;
      ball.velocity.y = Math.abs(ball.velocity.y) * ball.restitution;
    } else if (ball.position.y + ball.radius > canvas.height) {
      ball.position.y = canvas.height - ball.radius;
      ball.velocity.y = -Math.abs(ball.velocity.y) * ball.restitution;
    }
  }

  updateDebugInfo() {
    // Обновляем минимальное расстояние
    this.debugInfo.minDistance = Infinity;
    for (let i = 0; i < this.balls.length; i++) {
      const ball1 = this.balls[i];

      // Сохраняем позицию для траектории
      if (!this.debugInfo.lastPositions.has(ball1)) {
        this.debugInfo.lastPositions.set(ball1, []);
      }
      const positions = this.debugInfo.lastPositions.get(ball1);
      positions.push({ x: ball1.position.x, y: ball1.position.y });

      // Проверяем последние 3 точки на коллинеарность
      if (positions.length >= 3) {
        const p1 = positions[positions.length - 3];
        const p2 = positions[positions.length - 2];
        const p3 = positions[positions.length - 1];

        // Вычисляем площадь треугольника через определитель
        const area = Math.abs(
          (p2.x - p1.x) * (p3.y - p1.y) - (p3.x - p1.x) * (p2.y - p1.y)
        );

        // Если площадь близка к 0, точки на одной прямой
        if (area < 0.0001) {
          positions.splice(positions.length - 2, 1);
        }
      }

      if (positions.length > 5) positions.shift();

      // Проверяем расстояния между мячами
      for (let j = i + 1; j < this.balls.length; j++) {
        const ball2 = this.balls[j];
        const distance = ball1.position.distanceTo(ball2.position);
        this.debugInfo.minDistance = Math.min(
          this.debugInfo.minDistance,
          distance
        );
      }
    }
  }

  // Добавляем метод для получения текущего состояния мячей
  getBallsState() {
    return this.balls.map((ball) => ({
      x: ball.position.x,
      y: ball.position.y,
      radius: ball.radius,
    }));
  }
}

// Настройка HTML
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  canvas.width = window.innerWidth - 4; // -4 для учета бордера
  canvas.height = window.innerHeight - 4;
}

// Инициализация размера и обработчик изменения размера окна
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

const physicsEngine = new PhysicsEngine();

// Создаем мячи с учетом размера экрана
function initBalls() {
  physicsEngine.balls = [];

  // Случайное количество мячей от 2 до 10
  const ballsCount = Math.floor(Math.random() * 190) + 2;

  for (let i = 0; i < ballsCount; i++) {
    // Случайный радиус от 15 до 40
    const radius = 15 + Math.random() * 25;
    // Масса пропорциональна площади
    const mass = (Math.PI * radius * radius) / 400;

    // Случайная позиция с учетом радиуса
    const x = radius + Math.random() * (canvas.width - 2 * radius);
    const y = radius + Math.random() * (canvas.height - 2 * radius);

    // Случайная скорость с базовым масштабом ~3000
    const angle = Math.random() * Math.PI * 2;
    const speed = 2000 + Math.random() * 2000;
    const velocity = new Vector(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    );

    const ball = new Ball(x, y, radius, mass, velocity);
    physicsEngine.add(ball);
  }
}

initBalls();

// Функция для создания случайного импульса
function getRandomImpulse() {
  const angle = Math.random() * Math.PI * 2;
  const strength = 2000 + Math.random() * 3000; // Случайная сила от 2000 до 5000
  return new Vector(Math.cos(angle) * strength, Math.sin(angle) * strength);
}

// Функция для применения импульса к случайному мячу
function applyRandomImpulse() {
  if (physicsEngine.balls.length === 0) return;

  const randomBall =
    physicsEngine.balls[Math.floor(Math.random() * physicsEngine.balls.length)];
  const impulse = getRandomImpulse();
  randomBall.velocity = randomBall.velocity.add(impulse);
}

// Запускаем таймер для случайных импульсов
// setInterval(applyRandomImpulse, 2000);

// Добавляем контроль времени и FPS
const timeScaleSlider = document.getElementById("timeScale");
const timeScaleValue = document.getElementById("timeScaleValue");
let timeScale = 0.01;
let lastTimestamp = 0;
let fps = 0;

// Позиционируем контейнер управления справа
const controls = document.querySelector(".controls");
controls.style.position = "fixed";
controls.style.right = "20px";
controls.style.top = "20px";
controls.style.left = "auto";
controls.style.width = "500px";
controls.style.textAlign = "right";
controls.style.whiteSpace = "nowrap";
// Стили для слайдера и текста
timeScaleSlider.style.width = "100%";
// timeScaleValue.style.width = "100%";
timeScaleValue.style.textAlign = "right";
timeScaleValue.style.color = "white";
timeScaleValue.style.marginTop = "5px";

// Функция для преобразования значения слайдера в масштаб времени
function sliderToTimeScale(sliderValue) {
  // Преобразуем линейное значение слайдера [0, 1] в логарифмическое [0.001, 1000]
  return 0.001 * Math.pow(1000000, sliderValue);
}

// Функция для преобразования масштаба времени в значение слайдера
function timeScaleToSlider(timeScale) {
  // Обратное преобразование
  return Math.log(timeScale / 0.001) / Math.log(1000000);
}

timeScaleSlider.min = 0;
timeScaleSlider.max = 1;
timeScaleSlider.step = 0.001;
timeScaleSlider.value = timeScaleToSlider(0.01); // Начальное значение 1x

timeScaleSlider.addEventListener("input", (e) => {
  timeScale = sliderToTimeScale(parseFloat(e.target.value));
  timeScaleValue.textContent = timeScale.toFixed(3) + "x";
});

function update(timestamp) {
  if (lastTimestamp === 0) {
    lastTimestamp = timestamp;
    window.requestAnimationFrame(update);
    return;
  }

  const realFrameTime = (timestamp - lastTimestamp) / 1000;
  const scaledFrameTime = realFrameTime * timeScale;

  // Обновляем FPS
  fps = 1000 / (timestamp - lastTimestamp);

  // Продвигаем физическую симуляцию
  physicsEngine.step(scaledFrameTime);

  // Рисуем текущее состояние
  draw();

  lastTimestamp = timestamp;
  window.requestAnimationFrame(update);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Отрисовка траекторий
  physicsEngine.debugInfo.lastPositions.forEach((positions, ball) => {
    if (positions.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(positions[0].x, positions[0].y);
    for (let i = 1; i < positions.length; i++) {
      ctx.lineTo(positions[i].x, positions[i].y);
    }
    ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Отрисовка мячей
  const balls = physicsEngine.getBallsState();
  for (const ball of balls) {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = "blue";
    ctx.fill();
  }

  // Отображение отладочной информации
  ctx.fillStyle = "white";
  ctx.font = "16px Arial";
  ctx.textAlign = "left";

  ctx.fillText(
    `Min distance: ${physicsEngine.debugInfo.minDistance.toFixed(2)}px`,
    10,
    30
  );
  ctx.fillText(`FPS: ${Math.round(fps)}`, 10, 55);
  ctx.fillText(`Balls: ${physicsEngine.balls.length}`, 10, 80);
  ctx.fillText(
    `Collisions: ${physicsEngine.debugInfo.collisionsCount}`,
    10,
    105
  );
  ctx.fillText(`Time Scale: ${timeScale.toFixed(3)}x`, 10, 130);
}

// Инициализация и запуск
resizeCanvas();
initBalls();
window.requestAnimationFrame(update);

// При изменении размера окна пересоздаем мячи
window.addEventListener("resize", () => {
  resizeCanvas();
  setTimeout(initBalls, 100);
});
