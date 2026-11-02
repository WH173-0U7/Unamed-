import * as THREE from 'three';

const JOY_RADIUS = 56;
const SPEED = 16;

/**
 * Touch: left thumb is a floating joystick (move), right thumb drags to look.
 * Desktop: WASD / arrows to move, drag the mouse to look, Space / Shift to rise / sink.
 * Movement follows where you look, so you fly.
 */
export class Controls {
  yaw = 0;
  pitch = -0.08;
  roll = 0;
  enabled = false;
  readonly velocity = new THREE.Vector3();

  private move = { x: 0, y: 0 };
  private keys = new Set<string>();
  private movePid: number | null = null;
  private lookPid: number | null = null;
  private moveOrigin = { x: 0, y: 0 };
  private lastLook = { x: 0, y: 0 };
  private lookIsMouse = false;
  private yawRate = 0;

  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();

  constructor(
    private readonly el: HTMLElement,
    private readonly joyBase: HTMLElement,
    private readonly joyKnob: HTMLElement,
  ) {
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  private onDown = (e: PointerEvent) => {
    if (!this.enabled) return;
    if (e.pointerType !== 'mouse' && e.clientX < window.innerWidth / 2 && this.movePid === null) {
      this.movePid = e.pointerId;
      this.moveOrigin = { x: e.clientX, y: e.clientY };
      this.joyBase.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      this.joyKnob.style.transform = 'translate(-50%, -50%)';
      this.joyBase.classList.add('active');
    } else if (this.lookPid === null) {
      this.lookPid = e.pointerId;
      this.lookIsMouse = e.pointerType === 'mouse';
      this.lastLook = { x: e.clientX, y: e.clientY };
    } else {
      return;
    }
    this.el.setPointerCapture(e.pointerId);
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerId === this.movePid) {
      let dx = e.clientX - this.moveOrigin.x;
      let dy = e.clientY - this.moveOrigin.y;
      const len = Math.hypot(dx, dy);
      if (len > JOY_RADIUS) {
        dx = (dx / len) * JOY_RADIUS;
        dy = (dy / len) * JOY_RADIUS;
      }
      this.move.x = dx / JOY_RADIUS;
      this.move.y = -dy / JOY_RADIUS;
      this.joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    } else if (e.pointerId === this.lookPid) {
      const sens = this.lookIsMouse ? 0.004 : 0.006;
      const dx = e.clientX - this.lastLook.x;
      const dy = e.clientY - this.lastLook.y;
      this.lastLook = { x: e.clientX, y: e.clientY };
      this.yaw -= dx * sens;
      this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sens, -1.4, 1.4);
      this.yawRate += -dx * sens;
    }
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId === this.movePid) {
      this.movePid = null;
      this.move.x = 0;
      this.move.y = 0;
      this.joyBase.classList.remove('active');
    } else if (e.pointerId === this.lookPid) {
      this.lookPid = null;
    }
  };

  update(dt: number, camera: THREE.PerspectiveCamera, autopilot = false) {
    let f = this.move.y;
    let s = this.move.x;
    let u = 0;
    if (this.enabled) {
      const k = this.keys;
      if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) s += 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) s -= 1;
      if (k.has('Space')) u += 1;
      if (k.has('ShiftLeft') || k.has('ShiftRight')) u -= 1;
    }
    if (autopilot) {
      f = 0.35;
      this.yaw += dt * 0.04;
    }
    const mag = Math.hypot(f, s);
    if (mag > 1) {
      f /= mag;
      s /= mag;
    }

    const cp = Math.cos(this.pitch);
    this.forward.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.desired
      .copy(this.forward)
      .multiplyScalar(f)
      .addScaledVector(this.right, s)
      .addScaledVector(THREE.Object3D.DEFAULT_UP, u)
      .multiplyScalar(SPEED);
    this.velocity.lerp(this.desired, 1 - Math.exp(-dt * 2.5));
    camera.position.addScaledVector(this.velocity, dt);

    // Gentle banking when strafing or turning, for a floaty feel.
    const targetRoll = -s * 0.1 + THREE.MathUtils.clamp(this.yawRate * 2, -0.25, 0.25);
    this.roll += (targetRoll - this.roll) * (1 - Math.exp(-dt * 3));
    this.yawRate *= Math.exp(-dt * 8);
    camera.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
  }
}
