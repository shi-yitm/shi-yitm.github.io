import * as THREE from 'three';
import { degreesForCounts } from './math.js';

export function createSensitivityScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101513);
  const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
  const raycaster = new THREE.Raycaster();
  const targetMaterial = new THREE.MeshBasicMaterial({ color: 0x69e3c5, side: THREE.DoubleSide });
  const target = new THREE.Mesh(new THREE.CircleGeometry(0.34, 48), targetMaterial);
  target.visible = false;
  scene.add(target);

  let sensitivity = 1;
  let yaw = 0;
  let pitch = 0;
  let frameId = null;

  const resize = () => {
    const width = Math.max(1, canvas.clientWidth || globalThis.innerWidth || 1);
    const height = Math.max(1, canvas.clientHeight || globalThis.innerHeight || 1);
    if (canvas.width !== width || canvas.height !== height) renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const render = () => {
    resize();
    renderer.render(scene, camera);
  };

  const targetAngularError = () => {
    if (!target.visible) return 0;
    const crosshairDirection = camera.getWorldDirection(new THREE.Vector3());
    const targetDirection = target.position.clone().sub(camera.position).normalize();
    return THREE.MathUtils.radToDeg(crosshairDirection.angleTo(targetDirection));
  };

  const animate = () => {
    render();
    frameId = requestAnimationFrame(animate);
  };

  return {
    setSensitivity(value) {
      sensitivity = value;
    },
    applyMouseDelta({ x, y }) {
      yaw -= THREE.MathUtils.degToRad(degreesForCounts(x, sensitivity));
      pitch -= THREE.MathUtils.degToRad(degreesForCounts(y, sensitivity));
      pitch = THREE.MathUtils.clamp(pitch, -Math.PI / 2, Math.PI / 2);
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
    },
    spawnTarget({ yawDeg = 0, pitchDeg = 0, distance = 8 } = {}) {
      const yawRad = THREE.MathUtils.degToRad(yawDeg);
      const pitchRad = THREE.MathUtils.degToRad(pitchDeg);
      target.position.set(
        Math.sin(yawRad) * Math.cos(pitchRad) * distance,
        Math.sin(pitchRad) * distance,
        -Math.cos(yawRad) * Math.cos(pitchRad) * distance,
      );
      target.lookAt(camera.position);
      target.visible = true;
      render();
    },
    hitTest() {
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      return target.visible && raycaster.intersectObject(target, false).length > 0;
    },
    aimState() {
      return { errorDeg: targetAngularError(), onTarget: this.hitTest() };
    },
    sceneHasPixels() {
      render();
      const gl = renderer.getContext();
      const pixel = new Uint8Array(4);
      gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return pixel.some((channel) => channel !== 0);
    },
    start() {
      if (frameId === null) animate();
    },
    pause() {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
    },
    dispose() {
      this.pause();
      target.geometry.dispose();
      targetMaterial.dispose();
      renderer.dispose();
    },
  };
}
