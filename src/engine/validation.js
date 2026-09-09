// src/engine/validation.js

import { profileOf } from '../data/tech';
import { templateById, templateExists, recipeOf } from '../data/catalog';
import { RUNNER_SYSTEMS, APPLIANCES, runnerCalibrated, runnerPartial } from '../data/hardware';
import { resolveFrontStack, resolveFrontLayout } from './panels';
import { collidesWithAny } from './geometry';

export function validateElement(el) {
  const errors = [], warnings = [];
  const P = profileOf(el);
  const tpl = templateById(el.templateId);
  ['width', 'height', 'depth'].forEach((k) => {
    const c = tpl.dims[k];
    if (el.dims[k] < c.min) errors.push(`${k}: ispod minimuma ${c.min} mm`);
    if (el.dims[k] > c.max) errors.push(`${k}: iznad maksimuma ${c.max} mm`);
  });
  const innerW = el.dims.width - 2 * el.corpus.thicknessMm;
  if (innerW < 100) errors.push(`Unutrašnja širina ${innerW} mm je premala za korpus.`);
  const drawers = resolveFrontStack(el, P) || [];
  if (drawers.some((d) => d.kind !== 'appliance' && d.kind !== 'door')) {
    const R = RUNNER_SYSTEMS[el.runnerSystemId];
    if (!R) errors.push('Sistem vodilica nije odabran.');
    else if (!runnerCalibrated(R)) errors.push(`${R.name}: sistem nije kalibrisan. ${R.source}`);
    else if (runnerPartial(R)) warnings.push(`${R.name}: djelimično kalibrisan. ${R.source}`);
    else {
      const innerD = P.backMount === 'groove'
        ? el.dims.depth - P.backGroove.insetMm - el.back.thicknessMm
        : el.dims.depth;
      if (innerW < R.constraints.minInnerWidthMm) errors.push(`Unutrašnja širina ${innerW} mm ispod minimuma za ${R.name} (${R.constraints.minInnerWidthMm} mm).`);
      if (innerD < R.constraints.minInnerDepthMm) errors.push(`Unutrašnja dubina ${innerD} mm ne prima nominalu ${R.nominalLengthMm} mm.`);
      if (R.boxKind === 'wooden_4side' && R.boxThicknessMm !== el.corpus.thicknessMm) {
        warnings.push(`Sanduk traži ploču ${R.boxThicknessMm} mm u dekoru korpusa, a korpus je ${el.corpus.thicknessMm} mm.`);
      }
    }
  }
  if (!drawers.length) {
    resolveFrontLayout(el, P).forEach((s) => {
      if (s.widthMm <= 0) errors.push(`Slot "${s.role}" izlazi na ${s.widthMm} mm — širina elementa je premala za fiksne fronte.`);
      else if (s.kind === 'door' && s.widthMm > 600) warnings.push(`Krilo od ${s.widthMm} mm je iznad preporuke od 600 mm — provjeriti šarke.`);
    });
  }
  drawers.forEach((d) => {
    if (d.frontHeightMm <= 0) errors.push(`Slot "${d.label}" izlazi na ${d.frontHeightMm} mm — visina elementa je premala.`);
  });
  const RC = recipeOf(el);
  const tplA = templateById(el.templateId);
  if (!templateExists(el.templateId)) {
    errors.push(`Tip elementa "${el.templateId}" nije u katalogu — vjerovatno je sačuvan sa starijom verzijom programa. Element se ne može izračunati ni naručiti.`);
    return { errors, warnings, valid: false };
  }
  if (tplA.applianceSlot) {
    const A = APPLIANCES[el.applianceId || tplA.applianceSlot];
    if (!A || !A.verified) {
      errors.push(`${A ? A.name : 'Aparat'}: nije kalibrisan. ${A ? A.source : ''}`);
    } else if (el.dims.height - 2 * el.corpus.thicknessMm < A.nicheHeightMm) {
      errors.push(`Unutrašnja visina ${el.dims.height - 2 * el.corpus.thicknessMm} mm je manja od niše aparata (${A.nicheHeightMm} mm).`);
    } else {
      const zazor = el.dims.height - 2 * el.corpus.thicknessMm - A.nicheHeightMm;
      if (zazor > 60) warnings.push(`Zazor iznad niše je ${zazor} mm — provjeriti da li fali maska.`);
      const st = resolveFrontStack(el, P) || [];
      const donja = st.find((x) => x.label === 'donja');
      if (donja && A.bottomFrontMm && donja.frontHeightMm !== A.bottomFrontMm) {
        warnings.push(`Donja fronta ${donja.frontHeightMm} mm odstupa od ${A.bottomFrontMm} mm za ${A.name}.`);
      }
    }
  }
  if (RC.back === 'none') {
    warnings.push('Korpus bez leđa: broj i pozicija ukruta su odluka pogona.');
  }
  if (el.mountOffsetMm > 0) {
    warnings.push(`Element je odmaknut ${el.mountOffsetMm} mm od zida. Zauzeće od zida je ${el.dims.depth + el.mountOffsetMm} mm, korpus ostaje ${el.dims.depth} mm.`);
  }
  return { errors, warnings, valid: errors.length === 0 };
}

/* Širina zone oko instalacije koju treba držati slobodnom (mm, mjereno uz zid). */
const SERVICE_ZONE_MM = 120;

/**
 * Da li element ima SANDUKE koji se uvlače u korpus (ladice).
 * Takav element ne može preko odvoda ili cijevi — sanduk fizički udara u njih.
 * Element sa vratima može, jer se leđa izbuše na licu mjesta.
 */
function hasDrawerBoxes(el, P) {
  const stack = resolveFrontStack(el, P) || [];
  return stack.some((s) => s.kind === 'drawer');
}

/**
 * Provjera instalacija (odvod, utičnice).
 *
 * Namjerno je OPREZNA: odvod se postavlja UPRAVO zato da sudoper dođe preko
 * njega, pa bi javljanje svakog preklapanja značilo upozorenje na svakom
 * projektu. Upozoravamo samo na stvarno nemoguće kombinacije:
 *   - element sa ladicama preko odvoda (sanduk udara u cijev),
 *   - aparat sa fiksnim leđima preko utičnice (ne može se izbušiti),
 *   - element preko utičnice koji nije predviđen za aparat.
 */
export function serviceWarnings(el, project, room) {
  const out = [];
  const services = project.services || [];
  if (!services.length) return out;
  const P = profileOf(el);
  const tpl = templateById(el.templateId);
  const drawers = hasDrawerBoxes(el, P);
  const len = el.wall === 'top' || el.wall === 'bottom' ? room.width : room.depth;

  services.forEach((sv) => {
    if (sv.wall !== el.wall) return;
    const e0 = el.offset, e1 = el.offset + el.dims.width;
    const s0 = sv.offset - SERVICE_ZONE_MM / 2, s1 = sv.offset + SERVICE_ZONE_MM / 2;
    // Bez preklapanja po dužini zida
    if (e1 <= s0 || s1 <= e0) return;

    // Vertikalno: instalacija mora biti unutar visinskog raspona elementa
    const sy = sv.heightMm != null ? sv.heightMm : (sv.kind === 'voda' ? 500 : 1150);
    if (sy < el.elevation || sy > el.elevation + el.dims.height) return;

    const naziv = sv.kind === 'voda' ? 'odvoda' : 'utičnice';
    if (sv.kind === 'voda' && drawers) {
      out.push(`Element ima ladice, a preko njega je na ${sv.offset} mm od početka zida izvod ${naziv} — sanduk će udariti u cijev. Pomjerite element ili izvod.`);
    } else if (sv.kind === 'struja' && tpl.applianceSlot) {
      // Aparat preko utičnice je normalno, ali leđa moraju biti otvorena/izbušena
      const rc = recipeOf(el);
      if (rc.back !== 'none' && rc.back !== 'strips') {
        out.push(`Iza aparata na ${sv.offset} mm je utičnica, a leđa su puna — predvidite izrez ili nišu za utičnicu.`);
      }
    } else if (sv.kind === 'struja' && drawers) {
      out.push(`Preko ladica na ${sv.offset} mm prolazi utičnica — provjerite da li sanduk ima mjesta za instalaciju.`);
    }
    void len;
  });
  return out;
}

export function validateInProject(el, project, room) {
  const base = validateElement(el);
  const errors = base.errors.slice(), warnings = base.warnings.slice();
  const hit = collidesWithAny(el, project, room);
  if (hit) errors.push(hit === 'ZID' ? 'Element izlazi izvan gabarita prostorije.'
                                     : 'Preklapanje sa drugim elementom ili preprekom.');
  serviceWarnings(el, project, room).forEach((w) => warnings.push(w));
  const mine = el.dims.depth + (el.mountOffsetMm || 0);
  project.elements.forEach((o) => {
    if (o.instanceId === el.instanceId || o.wall !== el.wall || o.type !== el.type) return;
    const touch = Math.abs((o.offset + o.dims.width) - el.offset) < 2 || Math.abs((el.offset + el.dims.width) - o.offset) < 2;
    const theirs = o.dims.depth + (o.mountOffsetMm || 0);
    if (touch && theirs !== mine) warnings.push(`Prednja ravan ne poklapa se sa susjedom (razlika ${Math.abs(theirs - mine)} mm).`);
  });
  return { errors, warnings, valid: errors.length === 0 };
}