// src/views/Viewport3D.jsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { WALLS, WORKTOP, COOKTOP } from '../data/tech';
import { decorById } from '../data/decors';
import { templateById } from '../data/catalog';
import { bandRect, elementAABB, obstacleAABB } from '../engine/geometry';
import { computePanels } from '../engine/panels';
import { handlePlacements } from '../engine/layout';
import {
  computeWorktops, computeWallPanels, computeLedMask,
  computeSocle, computeTopMask, computeEndPanels,
} from '../engine/surfaces';
import { makeDecorCanvas, makeLabelCanvas, applyWorldUV } from '../utils/canvas';

const S = 0.001;

/** Na koliko mm se prevlačenje upisuje u store — vidi napomenu u PlanView2D. */
const DRAG_COMMIT_MM = 25;

export function Viewport3D({ project, room, selectedId, onSelect, onDrag, showFronts = true, walk = false, measure = false, onMeasure }) {
  const mountRef = useRef(null);
  const ctx = useRef({});
  const [ready, setReady] = useState(false);
  /**
   * Lokalni pregled pomjeranja: `{ id, delta }` u milimetrima.
   * Mijenja samo položaj grupe u sceni (jedan `position.x/z`), bez diraња store-a,
   * pa ne povlači `resolveProject` + kalkulacije + rebuild ~500 mesh-ova.
   */
  const [dragPreview, setDragPreview] = useState(null);
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#EEF2F6');
    const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9a978d, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 0.7);
    key.position.set(3, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -7; key.shadow.camera.right = 7;
    key.shadow.camera.top = 7; key.shadow.camera.bottom = -7;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.25);
    fill.position.set(-4, 3, -3);
    scene.add(fill);
    const shell = new THREE.Group(); scene.add(shell);
    const gauge = new THREE.Group(); scene.add(gauge);
    const furniture = new THREE.Group(); scene.add(furniture);
    const wire = new THREE.Group(); scene.add(wire);
    const orbit = { theta: -Math.PI / 2 + 0.5, phi: 1.15, radius: 8, target: new THREE.Vector3(2, 1, 2) };
    const ptr = { down: false, mode: 'rotate', lx: 0, ly: 0, moved: 0 };
    const fp = { on: false, yaw: 0, pitch: 0, pos: new THREE.Vector3(2, 1.65, 2), keys: {}, last: 0 };
    ctx.current.fp = fp;
    const applyWalk = () => {
      camera.rotation.order = 'YXZ';
      camera.position.copy(fp.pos);
      camera.rotation.set(fp.pitch, fp.yaw, 0);
    };
    let frameReq = null;
    /** Traži jedan frame. Više poziva u istom ticku skupi se u jedan render. */
    const invalidate = () => {
      if (frameReq != null || fp.on) return;      // u hodanju radi stalna petlja
      frameReq = requestAnimationFrame(() => {
        frameReq = null;
        renderer.render(scene, camera);
      });
    };

    /* PERF-03: render na zahtjev.
       Ranije je `requestAnimationFrame` petlja radila 60 fps ZAUVIJEK — i kad se
       ništa ne mijenja. GPU ventilator radi non-stop, laptop troši bateriju, a na
       integriranoj grafici to usporava i ostatak stranice. Sada se crta jedan
       frame nakon svake promjene, a stalna petlja radi SAMO u režimu hodanja
       (gdje se kamera zaista pomjera svaki frame). */
    const applyCamera = () => {
      if (fp.on) { applyWalk(); return; }
      camera.rotation.order = 'XYZ';
      const { theta, phi, radius, target } = orbit;
      camera.position.set(
        target.x + radius * Math.sin(phi) * Math.cos(theta),
        target.y + radius * Math.cos(phi),
        target.z + radius * Math.sin(phi) * Math.sin(theta));
      camera.lookAt(target);
      invalidate();
    };
    const dom = renderer.domElement;
    const ray = new THREE.Raycaster();
    const onDown = (e) => {
      ptr.down = true; ptr.moved = 0; ptr.lx = e.clientX; ptr.ly = e.clientY;
      ptr.mode = (e.button === 2 || e.shiftKey) ? 'pan' : 'rotate';
      if (e.button === 0 && !e.shiftKey) {
        const rect = dom.getBoundingClientRect();
        ray.setFromCamera(new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
        const hits = ray.intersectObjects(furniture.children, true);
        let o = hits.length ? hits[0].object : null;
        while (o && !o.userData.elementId) o = o.parent;
        const id = o ? o.userData.elementId : null;
        if (id && id === ctx.current.selectedId) {
          const el = (ctx.current.project.elements || []).find((x) => x.instanceId === id);
          if (el) {
            ptr.mode = 'move';
            ctx.current.dragEl = el;
            const along = planeHit(e);
            ptr.grab = along != null ? along - el.offset : 0;
            ptr.lastCommit = el.offset;
          }
        }
      }
      dom.setPointerCapture(e.pointerId);
    };
    const onMove = (e) => {
      if (!ptr.down) return;
      const dx = e.clientX - ptr.lx, dy = e.clientY - ptr.ly;
      ptr.lx = e.clientX; ptr.ly = e.clientY;
      ptr.moved += Math.abs(dx) + Math.abs(dy);
      if (fp.on) {
        fp.yaw -= dx * 0.004;
        fp.pitch = Math.max(-1.2, Math.min(1.2, fp.pitch - dy * 0.004));
        applyWalk();
        return;
      }
      if (ptr.mode === 'move') {
        const along = planeHit(e);
        if (along == null) return;
        const el = ctx.current.dragEl;
        const raw = along - ptr.grab;
        /* PERF-02: pregled ide lokalno (jeftino), u store samo na svakih
           DRAG_COMMIT_MM i jednom na puštanje miša. Prije je svaki piksel
           pokretao punu rekonstrukciju scene. */
        setDragPreview({ id: el.instanceId, delta: Math.round(raw) - el.offset });
        if (Math.abs(raw - ptr.lastCommit) >= DRAG_COMMIT_MM) {
          ptr.lastCommit = raw;
          if (ctx.current.onDrag) ctx.current.onDrag(el.instanceId, raw);
        }
        return;
      }
      if (ptr.mode === 'rotate') {
        orbit.theta += dx * 0.006;
        orbit.phi = Math.max(0.12, Math.min(Math.PI / 2 - 0.02, orbit.phi - dy * 0.006));
      } else {
        const right = new THREE.Vector3(Math.sin(orbit.theta - Math.PI / 2), 0, -Math.cos(orbit.theta - Math.PI / 2));
        const k = orbit.radius * 0.0016;
        orbit.target.addScaledVector(right, -dx * k);
        orbit.target.y = Math.max(0, orbit.target.y + dy * k);
      }
      applyCamera();
    };
    const planeHit = (e) => {
      const rect = dom.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
      const el = ctx.current.dragEl;
      if (!el) return null;
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(el.elevation + 10) * S);
      const p = new THREE.Vector3();
      if (!ray.ray.intersectPlane(plane, p)) return null;
      const alongX = (el.wall === 'top' || el.wall === 'bottom');
      return (alongX ? p.x : p.z) / S;
    };
    const onUp = (e) => {
      if (ptr.down && ptr.moved < 6 && ctx.current.measure) {
        const rect = dom.getBoundingClientRect();
        ray.setFromCamera(new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
        const hits = ray.intersectObjects([].concat(furniture.children, shell.children), true);
        if (hits.length) {
          let pt = hits[0].point.clone();
          const pts = ctx.current.pts;
          if (pts.length >= 2) pts.length = 0;
          if (pts.length === 1) {
            const d = pt.clone().sub(pts[0]);
            const ax = Math.abs(d.x), ay = Math.abs(d.y), az = Math.abs(d.z);
            pt = pts[0].clone();
            if (ax >= ay && ax >= az) pt.x += d.x;
            else if (ay >= az) pt.y += d.y;
            else pt.z += d.z;
          }
          pts.push(pt);
          for (let i = gauge.children.length - 1; i >= 0; i--) {
            const c = gauge.children[i];
            if (c.geometry) c.geometry.dispose();
            gauge.remove(c);
          }
          const dotMat = new THREE.MeshBasicMaterial({ color: 0x0D9488 });
          pts.forEach((q) => {
            const dot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), dotMat);
            dot.position.copy(q); gauge.add(dot);
          });
          if (pts.length === 2) {
            const g2 = new THREE.BufferGeometry().setFromPoints(pts);
            gauge.add(new THREE.Line(g2, new THREE.LineBasicMaterial({ color: 0x0D9488 })));
          }
          if (ctx.current.onMeasure) {
            ctx.current.onMeasure(pts.length === 2 ? Math.round(pts[0].distanceTo(pts[1]) / S) : null, pts.length);
          }
          invalidate();
        }
        ptr.down = false;
        if (dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId);
        return;
      }
      /* Konačna pozicija se upisuje na puštanje miša (PERF-02), pa se lokalni
         pregled gasi. Nakon prevlačenja NE radimo raycast za odabir — inače bi
         otpuštanje miša nad praznim prostorom poništilo selekciju elementa koji
         je korisnik upravo pomjerio. */
      const wasMove = ptr.mode === 'move';
      if (wasMove && ctx.current.dragEl && ctx.current.onDrag) {
        const along = planeHit(e);
        if (along != null) ctx.current.onDrag(ctx.current.dragEl.instanceId, along - ptr.grab);
      }
      setDragPreview(null);
      if (wasMove || ptr.moved >= 6) {
        ptr.down = false;
        ptr.mode = 'rotate';
        ctx.current.dragEl = null;
        if (dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId);
        return;
      }
      if (ptr.down && ptr.moved < 6) {
        const rect = dom.getBoundingClientRect();
        ray.setFromCamera(new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
        const hits = ray.intersectObjects(furniture.children, true);
        let o = hits.length ? hits[0].object : null;
        while (o && !o.userData.elementId) o = o.parent;
        if (ctx.current.onSelect) ctx.current.onSelect(o ? o.userData.elementId : null);
      }
      ptr.down = false;
      if (dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId);
    };
    const onWheel = (e) => {
      e.preventDefault();
      orbit.radius = Math.max(1.2, Math.min(28, orbit.radius * (1 + Math.sign(e.deltaY) * 0.12)));
      applyCamera();
    };
    const noCtx = (e) => e.preventDefault();
    dom.addEventListener('pointerdown', onDown);
    dom.addEventListener('pointermove', onMove);
    dom.addEventListener('pointerup', onUp);
    dom.addEventListener('pointercancel', onUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('contextmenu', noCtx);
    const resize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount); resize(); applyCamera();
    const onKeyDown = (e) => { fp.keys[e.key.toLowerCase()] = true; };
    const onKeyUp = (e) => { fp.keys[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    /** Stalna petlja — pokreće se samo za režim hodanja. */
    let walkRaf = null;
    const walkLoop = (t) => {
      const dt = Math.min(0.05, (t - fp.last) / 1000 || 0.016);
      fp.last = t;
      const k = fp.keys;
      const fwd = (k.w || k.arrowup ? 1 : 0) - (k.s || k.arrowdown ? 1 : 0);
      const str = (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0);
      if (fwd || str) {
        const sp = (k.shift ? 3.2 : 1.7) * dt;
        const dirX = -Math.sin(fp.yaw), dirZ = -Math.cos(fp.yaw);
        fp.pos.x += (dirX * fwd + Math.cos(fp.yaw) * str) * sp;
        fp.pos.z += (dirZ * fwd - Math.sin(fp.yaw) * str) * sp;
        const W2 = ctx.current.roomW || 5, D2 = ctx.current.roomD || 4;
        fp.pos.x = Math.max(0.25, Math.min(W2 - 0.25, fp.pos.x));
        fp.pos.z = Math.max(0.25, Math.min(D2 - 0.25, fp.pos.z));
        applyWalk();
      }
      renderer.render(scene, camera);
      walkRaf = requestAnimationFrame(walkLoop);
    };
    const startWalkLoop = () => { if (walkRaf == null) { fp.last = 0; walkRaf = requestAnimationFrame(walkLoop); } };
    const stopWalkLoop = () => { if (walkRaf != null) { cancelAnimationFrame(walkRaf); walkRaf = null; } invalidate(); };

    ctx.current = {
      ...ctx.current, scene, camera, renderer, shell, furniture, wire, gauge, orbit,
      applyCamera, invalidate, startWalkLoop, stopWalkLoop,
      mats: new Map(), labelMats: new Map(), pts: [],
    };
    setReady(true);
    invalidate();
    return () => {
      stopWalkLoop();
      if (frameReq != null) cancelAnimationFrame(frameReq);
      ro.disconnect();
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerup', onUp);
      dom.removeEventListener('pointercancel', onUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('contextmenu', noCtx);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      /* PERF-04: oslobodi materijale i teksture iz keša. `clear()` oslobađa samo
         geometriju; keširani dekor-materijali i teksture naljepnica zidova bi
         bez ovoga ostali u GPU memoriji nakon unmount-a komponente. */
      ctx.current.mats.forEach((m) => { if (m.map) m.map.dispose(); if (m) m.dispose(); });
      ctx.current.mats.clear();
      ctx.current.labelMats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      ctx.current.labelMats.clear();
      renderer.dispose();
      if (mount.contains(dom)) mount.removeChild(dom);
    };
  }, []);
  useEffect(() => { ctx.current.onSelect = onSelect; }, [onSelect]);
  useEffect(() => {
    ctx.current.measure = measure;
    ctx.current.onMeasure = onMeasure;
    if (!measure && ctx.current.gauge) {
      for (let i = ctx.current.gauge.children.length - 1; i >= 0; i--) {
        const c = ctx.current.gauge.children[i];
        if (c.geometry) c.geometry.dispose();
        ctx.current.gauge.remove(c);
      }
      if (ctx.current.pts) ctx.current.pts.length = 0;
      if (ctx.current.invalidate) ctx.current.invalidate();
    }
  }, [measure, onMeasure]);
  useEffect(() => { ctx.current.onDrag = onDrag; ctx.current.selectedId = selectedId; ctx.current.project = project; },
    [onDrag, selectedId, project]);
  useEffect(() => {
    const c = ctx.current;
    if (!c.fp || !c.applyCamera) return;
    c.roomW = room.width * S; c.roomD = room.depth * S;
    if (walk && !c.fp.on) {
      c.fp.on = true;
      c.fp.pos.set(room.width / 2 * S, 1.65, room.depth * 0.75 * S);
      c.fp.yaw = 0; c.fp.pitch = -0.08; c.fp.last = 0;
      if (c.startWalkLoop) c.startWalkLoop();
    } else if (!walk && c.fp.on) {
      c.fp.on = false;
      if (c.stopWalkLoop) c.stopWalkLoop();
    }
    c.applyCamera();
  }, [walk, ready, room.width, room.depth]);
  const getDecorMat = useCallback((decorId) => {
    const m = ctx.current.mats;
    if (!m) return new THREE.MeshStandardMaterial({ color: 0xcccccc });
    if (!m.has(decorId)) {
      const d = decorById(decorId);
      const tex = new THREE.CanvasTexture(makeDecorCanvas(d));
      tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
      const r = ctx.current.renderer;
      tex.anisotropy = r ? r.capabilities.getMaxAnisotropy() : 4;
      m.set(decorId, new THREE.MeshStandardMaterial({
        map: tex, bumpMap: tex, bumpScale: d.tex.bump, roughness: d.tex.rough, metalness: 0.02,
      }));
    }
    return m.get(decorId);
  }, []);
  const getPlainMat = useCallback((key, color, rough) => {
    const m = ctx.current.mats;
    if (!m) return new THREE.MeshStandardMaterial({ color });
    if (!m.has(key)) m.set(key, new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: rough, metalness: 0.02 }));
    return m.get(key);
  }, []);
  /**
   * PERF-04: oslobađanje resursa grupe.
   *
   * Ranije se oslobađala SAMO geometrija. Materijali naljepnica zidova (svaki sa
   * vlastitom `CanvasTexture` od 512×128) stvarali su se iznova na svaku promjenu
   * dimenzija prostorije i nikad se nisu oslobađali — curenje GPU memorije.
   *
   * `shared` je skup materijala koji se dijele između više mesh-ova (iz `mats`
   * keša) i NE smiju se osloboditi ovdje — oni se čiste jednom, pri unmount-u.
   */
  const clear = (g, shared) => {
    for (let i = g.children.length - 1; i >= 0; i--) {
      const c = g.children[i];
      c.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material && o.material !== shared) {
          if (o.material.map) o.material.map.dispose();
          o.material.dispose();
        }
      });
      g.remove(c);
    }
  };

  /**
   * Materijal naljepnice zida, keširan po tekstu.
   * Dimenzije prostorije se često mijenjaju (kliznik), a tekstovi naljepnica su
   * uvijek isti („Zid 1 · Gornji" itd.), pa keš znači 0 novih tekstura umjesto 4
   * po svakoj promjeni.
   */
  const getLabelMat = (text) => {
    const cache = ctx.current.labelMats;
    if (!cache) return new THREE.MeshBasicMaterial({ color: 0xffffff });
    if (!cache.has(text)) {
      const tex = new THREE.CanvasTexture(makeLabelCanvas(text));
      cache.set(text, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    }
    return cache.get(text);
  };
  useEffect(() => {
    if (!ready) return;
    const { shell } = ctx.current;
    clear(shell);
    const wallMat = getPlainMat('wall', '#F6F8FA', 0.95);
    const W = room.width * S, D = room.depth * S, H = room.height * S;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.02, D), getPlainMat('floor', '#D6DBE1', 0.92));
    floor.position.set(W / 2, -0.01, D / 2);
    floor.receiveShadow = true;
    shell.add(floor);
    const active = (project.activeWalls && project.activeWalls.length)
      ? project.activeWalls : WALLS.map((x) => x.id);
    const mk = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      m.position.set(x, y, z); m.receiveShadow = true; shell.add(m);
    };
    const geomOf = {
      top:    () => mk(W, H, 0.1, W / 2, H / 2, -0.05),
      left:   () => mk(0.1, H, D, -0.05, H / 2, D / 2),
      right:  () => mk(0.1, H, D, W + 0.05, H / 2, D / 2),
      bottom: () => mk(W, H, 0.1, W / 2, H / 2, D + 0.05),
    };
    active.forEach((id) => geomOf[id] && geomOf[id]());
    active.forEach((id) => {
      const idx = WALLS.findIndex((x) => x.id === id);
      const label = idx >= 0 ? `Zid ${idx + 1} · ${WALLS[idx].label.split(' ')[0]}` : `Zid ${id}`;
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.225), getLabelMat(label));
      const y = Math.min(H - 0.25, 2.3);
      if (id === 'top')    { pl.position.set(W / 2, y, 0.01); }
      if (id === 'bottom') { pl.position.set(W / 2, y, D - 0.01); pl.rotation.y = Math.PI; }
      if (id === 'left')   { pl.position.set(0.01, y, D / 2); pl.rotation.y = Math.PI / 2; }
      if (id === 'right')  { pl.position.set(W - 0.01, y, D / 2); pl.rotation.y = -Math.PI / 2; }
      shell.add(pl);
    });
    (project.services || []).forEach((sv) => {
      const d = 60, sz = 90;
      const r = bandRect(sv.wall, sv.offset - sz / 2, sv.offset + sz / 2, room, 0, d);
      const geo = new THREE.BoxGeometry((r.x1 - r.x0) * S, sz * S, (r.z1 - r.z0) * S);
      const m = new THREE.Mesh(geo, getPlainMat('sv_' + sv.kind, sv.kind === 'voda' ? '#2563EB' : '#F59E0B', 0.5));
      m.position.set((r.x0 + r.x1) / 2 * S, (sv.heightMm || 500) * S, (r.z0 + r.z1) / 2 * S);
      shell.add(m);
    });
    project.obstacles.forEach((ob) => {
      const a = obstacleAABB(ob, room);
      const g = new THREE.BoxGeometry((a.x1 - a.x0) * S, (a.y1 - a.y0) * S, (a.z1 - a.z0) * S);
      const m = new THREE.Mesh(g, getPlainMat(ob.kind, ob.kind === 'prozor' ? '#AFCBCF' : '#C9B48D', 0.4));
      m.position.set((a.x0 + a.x1) / 2 * S, (a.y0 + a.y1) / 2 * S, (a.z0 + a.z1) / 2 * S);
      shell.add(m);
    });
    ctx.current.orbit.target.set(W / 2, 1.0, D / 2);
    ctx.current.orbit.radius = Math.max(4.5, Math.max(W, D) * 1.8);
    ctx.current.applyCamera();
  }, [ready, room.width, room.depth, room.height, project.obstacles, project.services, project.activeWalls, getPlainMat]);
  useEffect(() => {
    if (!ready) return;
    const { furniture, wire } = ctx.current;
    const lineMat = ctx.current.lineMat || (ctx.current.lineMat =
      new THREE.LineBasicMaterial({ color: 0x2B2925, transparent: true, opacity: 0.45 }));
    // `lineMat` je dijeljen između svih ivica — clear() ga ne smije osloboditi.
    clear(furniture, lineMat); clear(wire, lineMat);
    const hdfMat = getPlainMat('hdf', '#DCD7CB', 0.94);
    const hotMat = getPlainMat('hot', '#0E7C86', 0.45);
    project.elements.forEach((el) => {
      const sel = el.instanceId === selectedId;
      const g = new THREE.Group();
      const gw = new THREE.Group();
      g.userData.elementId = el.instanceId;
      const corpusMat = getDecorMat(el.corpus.decorId);
      const frontMat = getDecorMat(el.front.decorId);
      /* Paneli se računaju JEDNOM po elementu i dijele sa handlePlacements —
         prije su se računali dvaput (ovdje i u pozivu ispod), a computePanels
         uključuje mergeIdentical sa JSON.stringify poređenjem. */
      const elPanels = computePanels(el);
      elPanels.forEach((p) => {
        if (!showFronts && p.materialKey === 'front') return;
        const base = p.glass ? getPlainMat('glass', '#9EC5CC', 0.15)
          : p.materialKey === 'front' ? frontMat : p.materialKey === 'back' ? hdfMat : corpusMat;
        const mat = sel ? hotMat : base;
        const decor = p.materialKey === 'front' ? decorById(el.front.decorId) : decorById(el.corpus.decorId);
        const texM = decor.tex.texWorldMm * S;
        const L = p.finalMm.length;
        p.place.forEach((pl) => {
          const geo = new THREE.BoxGeometry(Math.max(pl.w, 1) * S, Math.max(pl.h, 1) * S, Math.max(pl.d, 1) * S);
          let axis = 'y';
          if (Math.abs(pl.w - L) < 1.5) axis = 'x';
          else if (Math.abs(pl.h - L) < 1.5) axis = 'y';
          else if (Math.abs(pl.d - L) < 1.5) axis = 'z';
          if (p.materialKey !== 'back') applyWorldUV(geo, texM, axis);
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set((pl.x + pl.w / 2) * S, (pl.y + pl.h / 2) * S, (pl.z + pl.d / 2) * S);
          mesh.castShadow = true; mesh.receiveShadow = true;
          mesh.userData.elementId = el.instanceId;
          g.add(mesh);
          const line = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), lineMat);
          line.position.copy(mesh.position);
          gw.add(line);
        });
      });
      const metalMat = getPlainMat('metal', '#9AA3AB', 0.35);
      (showFronts ? handlePlacements(el, elPanels, project) : []).forEach((pl) => {
        const geo = new THREE.BoxGeometry(pl.w * S, pl.h * S, pl.d * S);
        const m = new THREE.Mesh(geo, metalMat);
        m.position.set((pl.x + pl.w / 2) * S, (pl.y + pl.h / 2) * S, (pl.z + pl.d / 2) * S);
        m.castShadow = true;
        m.userData.elementId = el.instanceId;
        g.add(m);
      });
      const rot = { top: 0, bottom: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }[el.wall];
      const mo = el.mountOffsetMm || 0;
      const off = el.offset, W = el.dims.width;
      let pos;
      if (el.wall === 'top') pos = [off * S, el.elevation * S, mo * S];
      else if (el.wall === 'bottom') pos = [(off + W) * S, el.elevation * S, (room.depth - mo) * S];
      else if (el.wall === 'left') pos = [mo * S, el.elevation * S, (off + W) * S];
      else pos = [(room.width - mo) * S, el.elevation * S, off * S];
      // Lokalni pregled prevlačenja: pomjeramo samo prikaz, ne i store.
      if (dragPreview && dragPreview.id === el.instanceId && dragPreview.delta) {
        const alongX = (el.wall === 'top' || el.wall === 'bottom');
        const d = dragPreview.delta * S;
        if (alongX) pos[0] += el.wall === 'top' ? d : -d;
        else pos[2] += el.wall === 'left' ? d : -d;
      }
      [g, gw].forEach((grp) => { grp.rotation.y = rot; grp.position.set(pos[0], pos[1], pos[2]); });
      furniture.add(g);
      wire.add(gw);
    });
    const wtMat = getDecorMat(project.worktopDecorId);
    const wtTex = decorById(project.worktopDecorId).tex.texWorldMm * S;
    const wpDecorId = project.wallPanelDecorId || project.worktopDecorId;
    const wpMat = getDecorMat(wpDecorId);
    const wpTex = decorById(wpDecorId).tex.texWorldMm * S;
    const addSlab = (rect, y0, thickY, mat, tex, axis) => {
      const geo = new THREE.BoxGeometry((rect.x1 - rect.x0) * S, thickY * S, (rect.z1 - rect.z0) * S);
      applyWorldUV(geo, tex, axis);
      const m = new THREE.Mesh(geo, mat);
      m.position.set((rect.x0 + rect.x1) / 2 * S, (y0 + thickY / 2) * S, (rect.z0 + rect.z1) / 2 * S);
      m.castShadow = true; m.receiveShadow = true;
      furniture.add(m);
      const line = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), lineMat);
      line.position.copy(m.position);
      wire.add(line);
    };
    computeWorktops(project, room).pieces.forEach((pc) => {
      addSlab(pc.rect, pc.topY, WORKTOP.thicknessMm, wtMat, wtTex,
        (pc.wall === 'top' || pc.wall === 'bottom') ? 'x' : 'z');
    });
    const inoxMat = getPlainMat('inox', '#C3CAD0', 0.28);
    project.elements.forEach((el) => {
      if (!(templateById(el.templateId) || {}).sinkBasin) return;
      const a = elementAABB(el, room);
      const topY = el.elevation + el.dims.height + WORKTOP.thicknessMm;
      const cx = (a.x0 + a.x1) / 2, cz = (a.z0 + a.z1) / 2;
      const bw = Math.min(el.dims.width - 160, 520), bd = Math.min(el.dims.depth - 120, 420);
      const rim = new THREE.Mesh(new THREE.BoxGeometry(bw * S, 8 * S, bd * S), inoxMat);
      rim.position.set(cx * S, (topY - 2) * S, cz * S);
      rim.receiveShadow = true;
      furniture.add(rim);
      const basin = new THREE.Mesh(new THREE.BoxGeometry((bw - 60) * S, 150 * S, (bd - 60) * S),
        getPlainMat('basin', '#8B949B', 0.4));
      basin.position.set(cx * S, (topY - 80) * S, cz * S);
      furniture.add(basin);
      const tap = new THREE.Mesh(new THREE.CylinderGeometry(14 * S, 16 * S, 260 * S, 12), inoxMat);
      const back = (el.wall === 'top' || el.wall === 'bottom') ? cz + (el.wall === 'top' ? -bd / 2 - 45 : bd / 2 + 45) : cz;
      const bx2 = (el.wall === 'left' || el.wall === 'right') ? cx + (el.wall === 'left' ? -bd / 2 - 45 : bd / 2 + 45) : cx;
      tap.position.set(bx2 * S, (topY + 130) * S, back * S);
      tap.castShadow = true;
      furniture.add(tap);
      const spout = new THREE.Mesh(new THREE.BoxGeometry(20 * S, 18 * S, 170 * S), inoxMat);
      spout.position.set(bx2 * S, (topY + 250) * S, (back + (el.wall === 'top' ? 85 : -85)) * S);
      furniture.add(spout);
    });
    (project.cooktops || []).forEach((ctp) => {
      const w = ctp.widthMm || COOKTOP.widthMm;
      const r = bandRect(ctp.wall, ctp.offset - w / 2, ctp.offset + w / 2, room, 40, 40 + COOKTOP.depthMm);
      const base = project.elements.filter((e) => e.wall === ctp.wall && (templateById(e.templateId) || {}).worktop);
      const topY = base.length ? Math.max.apply(null, base.map((e) => e.elevation + e.dims.height)) + WORKTOP.thicknessMm : 908;
      const geo = new THREE.BoxGeometry((r.x1 - r.x0) * S, 10 * S, (r.z1 - r.z0) * S);
      const m2 = new THREE.Mesh(geo, getPlainMat('cooktop', '#1F2937', 0.18));
      m2.position.set((r.x0 + r.x1) / 2 * S, (topY - 2) * S, (r.z0 + r.z1) / 2 * S);
      furniture.add(m2);
      const line = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), lineMat);
      line.position.copy(m2.position);
      wire.add(line);
    });
    computeLedMask(project, room).pieces.forEach((pc) => {
      addSlab(pc.rect, pc.yBase, pc.thicknessMm, wpMat, wpTex,
        (pc.wall === 'top' || pc.wall === 'bottom') ? 'x' : 'z');
    });
    computeWallPanels(project, room).pieces.forEach((pc) => {
      addSlab(pc.rect, pc.topY + WORKTOP.thicknessMm, pc.crossMm, wpMat, wpTex,
        (pc.wall === 'top' || pc.wall === 'bottom') ? 'x' : 'z');
    });
    const skMat = getDecorMat(project.socleDecorId || project.worktopDecorId);
    computeSocle(project, room).pieces.forEach((pc) => {
      addSlab(pc.rect, pc.yBase, pc.crossMm, skMat, wtTex,
        (pc.wall === 'top' || pc.wall === 'bottom') ? 'x' : 'z');
    });
    const gmId = project.topMaskDecorId || project.wallPanelDecorId || project.worktopDecorId;
    const gmMat = getDecorMat(gmId);
    const gmTex = decorById(gmId).tex.texWorldMm * S;
    computeTopMask(project, room).pieces.forEach((pc) => {
      addSlab(pc.rect, pc.yBase, pc.crossMm, gmMat, gmTex,
        (pc.wall === 'top' || pc.wall === 'bottom') ? 'x' : 'z');
    });
    const zmId = project.endPanelDecorId || project.worktopDecorId;
    const zmMat = getDecorMat(zmId);
    const zmTex = decorById(zmId).tex.texWorldMm * S;
    computeEndPanels(project, room).pieces.forEach((pc) => {
      addSlab(pc.rect, pc.yBase, pc.lengthMm, zmMat, zmTex, 'y');
    });
    /* PERF-03: scena je upravo iznova izgrađena — bez ovoga se promjena ne bi
       vidjela do sljedećeg kadra stalne petlje (koje više nema). */
    if (ctx.current.invalidate) ctx.current.invalidate();
  }, [ready, project, room, selectedId, showFronts, getDecorMat, getPlainMat, dragPreview]);
  return <div ref={mountRef} className="w-full h-full" style={{ touchAction: 'none' }} />;
}