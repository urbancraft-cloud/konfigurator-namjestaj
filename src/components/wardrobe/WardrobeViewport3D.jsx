// src/components/wardrobe/WardrobeViewport3D.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { decorById } from '../../data/decors';
import {
  PANEL_T, BACK_T, DOOR_T, SIDE_MASK_T,
  DOOR_REVEAL_PER_SIDE_MM, DOOR_GAP_BETWEEN_MM, WARDROBE_LEGS_PER_SEGMENT,
} from '../../data/wardrobe';
import {
  segmentCount, segmentWidthMm, segmentInteriorWidthMm, carcassWidthMm,
  lowerCorpusHeightMm, upperCorpusHeightMm, topMaskHeightMm, bottomMaskHeightMm,
  sideMaskHeightMm, sideMaskDepthMm, doorHeightMm,
  hingedLeafWidthMm, hingedLeavesPerSegment, slidingLeafCount, slidingLeafWidthMm,
  drawerUnitWidthMm, itemSpan, shelfPositionsMm, drawerFrontPositionsMm,
  corpusInteriorBaseYMm,
} from '../../engine/wardrobeLayout';
import { makeDecorCanvas } from '../../utils/canvas';

const S = 0.001;

export function WardrobeViewport3D({
  room, wardrobe, showInterior = false, selectedSegmentIdx = null, selectedCorpus = null,
}) {
  const mountRef = useRef(null);
  const ctx = useRef({});
  const [ready, setReady] = useState(false);

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
    key.shadow.camera.left = -6; key.shadow.camera.right = 6;
    key.shadow.camera.top = 6; key.shadow.camera.bottom = -6;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.25);
    fill.position.set(-4, 3, -3);
    scene.add(fill);

    const shell = new THREE.Group(); scene.add(shell);
    const wardrobeGroup = new THREE.Group(); scene.add(wardrobeGroup);

    const orbit = { theta: -Math.PI / 2 + 0.5, phi: 1.1, radius: 6, target: new THREE.Vector3(1.5, 1.1, 1) };
    const ptr = { down: false, mode: 'rotate', lx: 0, ly: 0 };
    const applyCamera = () => {
      const { theta, phi, radius, target } = orbit;
      camera.position.set(
        target.x + radius * Math.sin(phi) * Math.cos(theta),
        target.y + radius * Math.cos(phi),
        target.z + radius * Math.sin(phi) * Math.sin(theta));
      camera.lookAt(target);
      // Bez stalne rAF petlje, svaka promjena kamere mora tražiti frame.
      if (ctx.current.invalidate) ctx.current.invalidate();
    };
    const dom = renderer.domElement;
    const onDown = (e) => {
      ptr.down = true; ptr.lx = e.clientX; ptr.ly = e.clientY;
      ptr.mode = (e.button === 2 || e.shiftKey) ? 'pan' : 'rotate';
      dom.setPointerCapture(e.pointerId);
    };
    const onMove = (e) => {
      if (!ptr.down) return;
      const dx = e.clientX - ptr.lx, dy = e.clientY - ptr.ly;
      ptr.lx = e.clientX; ptr.ly = e.clientY;
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
    const onUp = (e) => {
      ptr.down = false;
      if (dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId);
    };
    const onWheel = (e) => {
      e.preventDefault();
      orbit.radius = Math.max(1.0, Math.min(20, orbit.radius * (1 + Math.sign(e.deltaY) * 0.12)));
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

    /* PERF-03: stalna `requestAnimationFrame` petlja je renderovala 60 fps i kad
       se ništa ne mijenja. Ormar nema režim hodanja, pa stalna petlja ovdje uopšte
       nije potrebna — jedan frame nakon svake promjene je dovoljan. */
    let frameReq = null;
    const invalidate = () => {
      if (frameReq != null) return;
      frameReq = requestAnimationFrame(() => {
        frameReq = null;
        renderer.render(scene, camera);
      });
    };

    /* PERF-04: materijal ivica se dijeli između svih box-ova. `box()` je ranije
       stvarao NOV `LineBasicMaterial` za svaku ivicu svake kutije — za ormar od
       4 segmenta sa unutrašnjošću to je stotine materijala po rebuild-u, nijedan
       oslobođen. */
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x2B2925, transparent: true, opacity: 0.35 });

    ctx.current = { scene, camera, renderer, shell, wardrobeGroup, orbit, applyCamera, invalidate, edgeMat, mats: new Map() };
    setReady(true);
    invalidate();
    return () => {
      if (frameReq != null) cancelAnimationFrame(frameReq);
      ro.disconnect();
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerup', onUp);
      dom.removeEventListener('pointercancel', onUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('contextmenu', noCtx);
      // PERF-04: oslobodi keširane materijale i njihove teksture.
      ctx.current.mats.forEach((m) => { if (m && m.map) m.map.dispose(); if (m) m.dispose(); });
      ctx.current.mats.clear();
      if (ctx.current.edgeMat) ctx.current.edgeMat.dispose();
      renderer.dispose();
      if (mount.contains(dom)) mount.removeChild(dom);
    };
  }, []);

  const getMat = useCallback((key, decorId, fallbackColor) => {
    const m = ctx.current.mats;
    if (!m) return new THREE.MeshStandardMaterial({ color: fallbackColor || 0xcccccc });
    if (!m.has(key)) {
      const d = decorById(decorId);
      if (d && !d.missing) {
        const tex = new THREE.CanvasTexture(makeDecorCanvas(d));
        tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
        m.set(key, new THREE.MeshStandardMaterial({
          map: tex, bumpMap: tex, bumpScale: d.tex.bump, roughness: d.tex.rough, metalness: 0.02,
        }));
      } else {
        m.set(key, new THREE.MeshStandardMaterial({ color: fallbackColor || 0xcccccc, roughness: 0.8 }));
      }
    }
    return m.get(key);
  }, []);

  const getPlainMat = useCallback((key, color, rough) => {
    const m = ctx.current.mats;
    if (!m) return new THREE.MeshStandardMaterial({ color });
    if (!m.has(key)) m.set(key, new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: rough, metalness: 0.02 }));
    return m.get(key);
  }, []);

  /** Oslobađa geometriju; dijeljene materijale (`mats` keš i `edgeMat`) preskače. */
  const clear = (g) => {
    const shared = ctx.current.mats;
    const edgeMat = ctx.current.edgeMat;
    for (let i = g.children.length - 1; i >= 0; i--) {
      const c = g.children[i];
      c.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const m = o.material;
        if (m && m !== edgeMat && !(shared && [...shared.values()].includes(m))) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      });
      g.remove(c);
    }
  };

  const box = (parent, w, h, d, x, y, z, mat, castShadow) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w, 0.001), Math.max(h, 0.001), Math.max(d, 0.001)), mat);
    m.position.set(x, y, z);
    if (castShadow) { m.castShadow = true; m.receiveShadow = true; }
    parent.add(m);
    // Dijeljeni materijal ivica umjesto novog po svakoj kutiji (PERF-04).
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 20), ctx.current.edgeMat);
    edges.position.copy(m.position);
    parent.add(edges);
    return m;
  };

  // Room shell — floor + back wall, for spatial context.
  useEffect(() => {
    if (!ready) return;
    const { shell } = ctx.current;
    clear(shell);
    const W = room.width * S, D = room.depth * S, H = room.height * S;
    const wallMat = getPlainMat('room_wall', '#F6F8FA', 0.95);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.02, D), getPlainMat('room_floor', '#D6DBE1', 0.92));
    floor.position.set(W / 2, -0.01, D / 2);
    floor.receiveShadow = true;
    shell.add(floor);
    const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.06), wallMat);
    back.position.set(W / 2, H / 2, -0.03);
    back.receiveShadow = true;
    shell.add(back);
    if (ctx.current.invalidate) ctx.current.invalidate();
  }, [ready, room.width, room.depth, room.height, getPlainMat]);

  // Wardrobe: nogice, DVA odvojena korpusa (donji + gornji), gornja maska, vrata, enterijer.
  useEffect(() => {
    if (!ready) return;
    const { wardrobeGroup } = ctx.current;
    clear(wardrobeGroup);

    /* Sve dimenzije dolaze iz `wardrobeLayout`, ne iz konstanti — visine su sada
       ulazne veličine (donji korpus i gornja maska su editabilni), a bočne maske
       stoje VAN korpusa i idu punom visinom prostora. */
    const n = segmentCount(wardrobe);
    const hProstor = sideMaskHeightMm(wardrobe) * S;
    const wW = carcassWidthMm(wardrobe) * S;             // širina KORPUSA (bez maski)
    const wTotal = wardrobe.widthMm * S;                 // ukupno sa maskama
    const wD = (Number(wardrobe.depthMm) > 0 ? Number(wardrobe.depthMm) : 580) * S;
    const t = PANEL_T * S;
    const backT = BACK_T * S;
    const sideT = SIDE_MASK_T * S;
    const legH = bottomMaskHeightMm(wardrobe) * S;
    const lowerH = lowerCorpusHeightMm(wardrobe) * S;
    const upperHmm = Math.max(0, upperCorpusHeightMm(wardrobe));
    const upperH = upperHmm * S;
    const maskH = topMaskHeightMm(wardrobe) * S;
    const segW = segmentWidthMm(wardrobe) * S;
    const segIn = segmentInteriorWidthMm(wardrobe) * S;

    // Centriraj ormar uza zadnji zid, po sredini prostorije.
    const roomW = room.width * S;
    const x0 = Math.max(0, (roomW - wTotal) / 2) + sideT;   // x0 = početak KORPUSA
    const xMaskL = x0 - sideT;
    const xMaskR = x0 + wW;
    const z0 = 0.03;

    const corpusMat = getMat('corpus', wardrobe.corpusDecorId, 0xdadada);
    const doorMat = getMat('door', wardrobe.doorDecorId, 0xf1efe9);
    const hwMat = getPlainMat('hardware', '#9CA3AF', 0.35);
    const legMat = getPlainMat('leg', '#6B7280', 0.4);

    /* --- Nogice: 5 po segmentu, raspoređene po dubini i širini ------------ */
    const legSize = 0.028;
    if (legH > 0) {
      const poSegmentu = WARDROBE_LEGS_PER_SEGMENT;
      for (let i = 0; i < n; i++) {
        const sx0 = x0 + i * segW;
        for (let k = 0; k < poSegmentu; k++) {
          const fx = poSegmentu === 1 ? 0.5 : k / (poSegmentu - 1);
          const px = sx0 + segW * (0.08 + 0.84 * fx);
          box(wardrobeGroup, legSize, legH, legSize, px, legH / 2, z0 + legSize, legMat, true);
          box(wardrobeGroup, legSize, legH, legSize, px, legH / 2, z0 + wD - legSize, legMat, true);
        }
      }
    }

    /* --- Donja maska (visina = nogice), preko širine korpusa -------------- */
    if (legH > 0) {
      box(wardrobeGroup, wW, legH, t, x0 + wW / 2, legH / 2, z0 + wD - t / 2, corpusMat, true);
    }

    /* --- Korpusi: svaki segment ima SVOJA dva boka (nema zasebnih pregrada
           između segmenata, jer bi inače ukupna širina bila veća od svijetlog
           otvora i vrata se ne bi poklopila). */
    const drawCorpus = (baseY, heightM) => {
      if (heightM <= 0) return;
      for (let i = 0; i < n; i++) {
        const sx0 = x0 + i * segW;
        box(wardrobeGroup, t, heightM, wD, sx0 + t / 2, baseY + heightM / 2, z0 + wD / 2, corpusMat, true);
        box(wardrobeGroup, t, heightM, wD, sx0 + segW - t / 2, baseY + heightM / 2, z0 + wD / 2, corpusMat, true);
        box(wardrobeGroup, segW - 2 * t, t, wD, sx0 + segW / 2, baseY + heightM - t / 2, z0 + wD / 2, corpusMat, true);
        box(wardrobeGroup, segW - 2 * t, t, wD, sx0 + segW / 2, baseY + t / 2, z0 + wD / 2, corpusMat, true);
        // Leđa (lesomal) po segmentu
        box(wardrobeGroup, segW - 2 * t, heightM - 2 * t, backT, sx0 + segW / 2, baseY + heightM / 2, z0 + backT / 2, corpusMat, true);
      }
    };
    const lowerBaseY = legH;
    const upperBaseY = legH + lowerH;
    drawCorpus(lowerBaseY, lowerH);
    drawCorpus(upperBaseY, upperH);

    /* --- Gornja maska (editabilna visina), preko širine korpusa ----------- */
    const maskBaseY = legH + lowerH + upperH;
    if (maskH > 0) {
      box(wardrobeGroup, wW, maskH, t, x0 + wW / 2, maskBaseY + maskH / 2, z0 + wD - t / 2, corpusMat, true);
    }

    /* --- Bočne maske: 18 mm, PUNA visina prostora, VAN korpusa ------------
       Dubina im je 3 + D + 18, ali se može ručno prepisati zasebno za lijevu i
       desnu stranu (kad je maska uz zid, ne ide puna dubina). */
    const dMaskL = sideMaskDepthMm(wardrobe, 'left') * S;
    const dMaskR = sideMaskDepthMm(wardrobe, 'right') * S;
    box(wardrobeGroup, sideT, hProstor, dMaskL, xMaskL + sideT / 2, hProstor / 2, z0 + dMaskL / 2, corpusMat, true);
    box(wardrobeGroup, sideT, hProstor, dMaskR, xMaskR + sideT / 2, hProstor / 2, z0 + dMaskR / 2, corpusMat, true);

    /* --- Vrata -------------------------------------------------------------
       Iz jednog komada po visini; prekrivaju ISKLJUČIVO vertikalu korpusa
       (donji + gornji), bez gornje i donje maske. Visina je editabilna. */
    const doorH = doorHeightMm(wardrobe) * S;
    const doorBaseY = legH;
    if (!showInterior) {
      if (wardrobe.doorType === 'klizna') {
        const leaves = slidingLeafCount(wardrobe);
        const leafW = slidingLeafWidthMm(wardrobe) * S;
        for (let l = 0; l < leaves; l++) {
          const px = x0 + (l + 0.5) * (wW / leaves);
          box(wardrobeGroup, leafW, doorH, DOOR_T * S, px, doorBaseY + doorH / 2, z0 + wD + DOOR_T * S / 2 + 0.001 * (l % 2), doorMat, true);
        }
      } else {
        const perSeg = hingedLeavesPerSegment(wardrobe);
        const leafW = hingedLeafWidthMm(wardrobe) * S;
        for (let i = 0; i < n; i++) {
          const sx0 = x0 + i * segW;
          for (let l = 0; l < perSeg; l++) {
            const slot = (segW - 2 * DOOR_REVEAL_PER_SIDE_MM * S - (perSeg - 1) * DOOR_GAP_BETWEEN_MM * S) / perSeg;
            const px = sx0 + DOOR_REVEAL_PER_SIDE_MM * S + l * (slot + DOOR_GAP_BETWEEN_MM * S) + leafW / 2;
            box(wardrobeGroup, leafW, doorH, DOOR_T * S, px, doorBaseY + doorH / 2, z0 + wD + DOOR_T * S / 2, doorMat, true);
          }
        }
      }
    } else {
      /* --- Unutrašnji elementi, po segmentu i po korpusu -------------------
         `yMm` je relativan na unutrašnje dno SVOG korpusa; apsolutna visina od
         poda = corpusInteriorBaseYMm(wardrobe, corpus) + yMm. */
      for (let i = 0; i < n; i++) {
        const sx0 = x0 + i * segW;
        const cx = sx0 + segW / 2;
        const seg = wardrobe.segments[i];
        if (!seg) continue;

        [['lower', lowerBaseY, lowerH], ['upper', upperBaseY, upperH]].forEach(([corpus, baseY, heightM]) => {
          if (heightM <= 0) return;
          const interiorBottomMm = corpusInteriorBaseYMm(wardrobe, corpus);
          const highlight = selectedSegmentIdx === i && selectedCorpus === corpus;
          const unitW = drawerUnitWidthMm(wardrobe) * S;

          (seg[corpus].items || []).forEach((it) => {
            const { y0, y1 } = itemSpan(it);
            if (it.type === 'ladicar') {
              // Fronte sa STVARNIM visinama iz auto podjele (ne fiksnih 174 mm)
              drawerFrontPositionsMm(it).forEach((f) => {
                const hF = (f.heightMm || 180) * S;
                const fy = (interiorBottomMm + f.y) * S + hF / 2;
                const front = box(wardrobeGroup, unitW, hF, DOOR_T * S, cx, fy, z0 + wD - DOOR_T * S / 2, doorMat, true);
                front.userData.wardrobeItem = true;
                box(wardrobeGroup, unitW * 0.35, 0.012, 0.012, cx, fy, z0 + wD + 0.002, hwMat, false);
              });
            } else if (it.type === 'sipka') {
              const yMm = (y0 + y1) / 2;
              const rod = new THREE.Mesh(
                new THREE.CylinderGeometry(0.009, 0.009, Math.max(0.01, segIn - 0.02), 12),
                hwMat,
              );
              rod.rotation.z = Math.PI / 2;
              rod.position.set(cx, (interiorBottomMm + yMm) * S, z0 + wD - 0.05);
              rod.castShadow = true;
              wardrobeGroup.add(rod);
            } else if (it.type === 'polica') {
              shelfPositionsMm(it).forEach((yMm) => {
                box(wardrobeGroup, Math.max(0.01, segIn), PANEL_T * S, wD - 0.03, cx, (interiorBottomMm + yMm) * S, z0 + wD / 2, corpusMat, true);
              });
            }
          });

          if (highlight) {
            const outline = new THREE.LineSegments(
              new THREE.EdgesGeometry(new THREE.BoxGeometry(Math.max(0.01, segW), Math.max(0.01, heightM - t * 2), Math.max(0.01, wD - t)), 1),
              ctx.current.edgeMat);
            outline.position.set(cx, baseY + heightM / 2, z0 + wD / 2);
            wardrobeGroup.add(outline);
          }
        });
      }
    }

    ctx.current.orbit.target.set(x0 + wW / 2, hProstor / 2, z0 + wD / 2);
    ctx.current.orbit.radius = Math.max(2.2, wTotal * 1.7);
    ctx.current.applyCamera();
    if (ctx.current.invalidate) ctx.current.invalidate();
  }, [ready, room.width, wardrobe, showInterior, selectedSegmentIdx, selectedCorpus, getMat, getPlainMat]);

  return <div ref={mountRef} className="w-full h-full" />;
}
