// Gen 3 Pokémon: pk3 format (80 bytes in a box, 100 in the party). Port of src/swg3/gen3/pk3.py. Layout: include/pokemon.h.
// The 48 secure bytes are four 12-byte substructures shuffled by `personality % 24` (GetSubstruct, src/pokemon.c) and XORed
// with `personality ^ otId` (EncryptBoxMon). "Plain" means decrypted, substructures in canonical order (growth, moves, EVs, misc).

import * as charset from "./charset";
import { t } from "../../i18n";

export const BOX_SIZE = 80;
export const PARTY_SIZE = 100;
export const SECURE = 0x20;
export const SECURE_SIZE = 48;
export const SUBSTRUCT_SIZE = 12;

/** ORDER[personality % 24][type] = slot where the substructure of that type is stored. */
export const ORDER: readonly (readonly [number, number, number, number])[] = [
  [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 3, 1, 2], [0, 2, 3, 1], [0, 3, 2, 1],
  [1, 0, 2, 3], [1, 0, 3, 2], [2, 0, 1, 3], [3, 0, 1, 2], [2, 0, 3, 1], [3, 0, 2, 1],
  [1, 2, 0, 3], [1, 3, 0, 2], [2, 1, 0, 3], [3, 1, 0, 2], [2, 3, 0, 1], [3, 2, 0, 1],
  [1, 2, 3, 0], [1, 3, 2, 0], [2, 1, 3, 0], [3, 1, 2, 0], [2, 3, 1, 0], [3, 2, 1, 0],
];

export const STATS = ["hp", "attack", "defense", "speed", "sp_attack", "sp_defense"] as const;
export type Stat = (typeof STATS)[number];
/** One value per stat (IVs, EVs, stats), in STATS order. */
export type StatValues = Record<Stat, number>;
export type PartyStats = StatValues & { current_hp: number };

export const CONTEST = ["cool", "beauty", "cute", "smart", "tough", "sheen"] as const;
export type Contest = Record<(typeof CONTEST)[number], number>;

export const NATURES = [
  "Hardy", "Lonely", "Brave", "Adamant", "Naughty", "Bold", "Docile", "Relaxed",
  "Impish", "Lax", "Timid", "Hasty", "Serious", "Jolly", "Naive", "Modest", "Mild",
  "Quiet", "Bashful", "Rash", "Calm", "Gentle", "Sassy", "Careful", "Quirky",
] as const;
export type Nature = (typeof NATURES)[number];

// Offsets in the plain data.
const PID = 0x00, OTID = 0x04, NICK = 0x08, LANG = 0x12, FLAGS = 0x13, OT = 0x14, MARKS = 0x1b, CHECKSUM = 0x1c;
const S0 = SECURE, S1 = SECURE + SUBSTRUCT_SIZE, S2 = SECURE + 2 * SUBSTRUCT_SIZE, S3 = SECURE + 3 * SUBSTRUCT_SIZE;
const PARTY = BOX_SIZE;
export const LANGUAGE_JAPANESE = 1; // include/constants/global.h
export const MAIL_NONE = 0xff; // include/constants/items.h; written by CreateMon (src/pokemon.c)

const view = (data: Uint8Array) => new DataView(data.buffer, data.byteOffset, data.byteLength);

function checkSize(data: Uint8Array) {
  if (data.length !== BOX_SIZE && data.length !== PARTY_SIZE)
    throw new Error(t("tamanho {size}, esperado {box} ou {party}", { size: data.length, box: BOX_SIZE, party: PARTY_SIZE }));
}

function xor(data: Uint8Array, key: number): Uint8Array {
  const out = data.slice();
  const dv = view(out);
  for (let i = 0; i + 4 <= out.length; i += 4) dv.setUint32(i, (dv.getUint32(i, true) ^ key) >>> 0, true);
  return out;
}

/** 16-bit sum over the 48 decrypted secure bytes (CalculateBoxMonChecksum). */
export function checksum(plain: Uint8Array): number {
  const dv = view(plain);
  let sum = 0;
  for (let i = 0; i < SECURE_SIZE; i += 2) sum += dv.getUint16(SECURE + i, true);
  return sum & 0xffff;
}

export function decrypt(raw: Uint8Array): Uint8Array {
  checkSize(raw);
  const dv = view(raw);
  const pid = dv.getUint32(0, true), otid = dv.getUint32(4, true);
  const secure = xor(raw.subarray(SECURE, SECURE + SECURE_SIZE), pid ^ otid);
  const order = ORDER[pid % 24];
  const out = raw.slice();
  for (let kind = 0; kind < 4; kind++) {
    const at = order[kind] * SUBSTRUCT_SIZE;
    out.set(secure.subarray(at, at + SUBSTRUCT_SIZE), SECURE + kind * SUBSTRUCT_SIZE);
  }
  return out;
}

/** Plain data to game format, recomputing the checksum. */
export function encrypt(plain: Uint8Array): Uint8Array {
  checkSize(plain);
  const out = plain.slice();
  const dv = view(out);
  dv.setUint16(CHECKSUM, checksum(out), true);
  const pid = dv.getUint32(0, true), otid = dv.getUint32(4, true);
  const order = ORDER[pid % 24];
  const stored = new Uint8Array(SECURE_SIZE);
  for (let kind = 0; kind < 4; kind++) {
    const start = SECURE + kind * SUBSTRUCT_SIZE;
    stored.set(out.subarray(start, start + SUBSTRUCT_SIZE), order[kind] * SUBSTRUCT_SIZE);
  }
  out.set(xor(stored, pid ^ otid), SECURE);
  return out;
}

/** Reads a file in game format (encrypted) or plain, decided by the checksum; if neither matches, the decrypted reading. */
export function load(data: Uint8Array): [mon: Pk3, encrypted: boolean] {
  const decrypted = Pk3.fromRaw(data);
  if (decrypted.checksumOk) return [decrypted, true];
  const plain = new Pk3(data);
  if (plain.checksumOk) return [plain, false];
  return [decrypted, true];
}

function checkRange(value: number, max: number, what: string) {
  if (!Number.isInteger(value) || value < 0 || value > max) throw new Error(`${what} ${value} out of 0..${max}`);
}

export class Pk3 {
  readonly data: Uint8Array;
  private readonly dv: DataView;

  constructor(plain: Uint8Array) {
    checkSize(plain);
    this.data = plain.slice();
    this.dv = view(this.data);
  }

  static fromRaw(raw: Uint8Array): Pk3 {
    return new Pk3(decrypt(raw));
  }

  toRaw(): Uint8Array {
    return encrypt(this.data);
  }

  toBox(): Pk3 {
    return new Pk3(this.data.subarray(0, BOX_SIZE));
  }

  get isParty(): boolean {
    return this.data.length === PARTY_SIZE;
  }

  updateChecksum(): void {
    this.setU16(CHECKSUM, checksum(this.data));
  }

  get storedChecksum(): number {
    return this.u16(CHECKSUM);
  }

  get checksumOk(): boolean {
    return this.u16(CHECKSUM) === checksum(this.data);
  }

  u8(off: number): number { return this.data[off]; }
  u16(off: number): number { return this.dv.getUint16(off, true); }
  u32(off: number): number { return this.dv.getUint32(off, true); }
  setU8(off: number, v: number): void { this.data[off] = v & 0xff; }
  setU16(off: number, v: number): void { this.dv.setUint16(off, v & 0xffff, true); }
  setU32(off: number, v: number): void { this.dv.setUint32(off, v >>> 0, true); }

  bits(off: number, shift: number, width: number): number {
    return (this.u32(off) >>> shift) & (2 ** width - 1);
  }

  setBits(off: number, shift: number, width: number, value: number): void {
    const mask = ((2 ** width - 1) * 2 ** shift) >>> 0;
    this.setU32(off, (this.u32(off) & ~mask) | ((value << shift) & mask));
  }

  get personality(): number { return this.u32(PID); }
  set personality(v: number) { this.setU32(PID, v); }
  get otId(): number { return this.u32(OTID); }
  set otId(v: number) { this.setU32(OTID, v); }
  get tid(): number { return this.otId & 0xffff; }
  get sid(): number { return this.otId >>> 16; }
  get language(): number { return this.u8(LANG); }
  set language(v: number) { this.setU8(LANG, v); }
  get isBadEgg(): boolean { return (this.u8(FLAGS) & 1) !== 0; }
  get hasSpecies(): boolean { return (this.u8(FLAGS) & 2) !== 0; }
  set hasSpecies(v: boolean) { this.setU8(FLAGS, (this.u8(FLAGS) & ~2) | (v ? 2 : 0)); }
  get markings(): number { return this.u8(MARKS); }
  set markings(v: number) { this.setU8(MARKS, v); }

  get nickname(): string {
    return charset.decode(this.data.subarray(NICK, NICK + 10), this.language === LANGUAGE_JAPANESE);
  }
  set nickname(text: string) {
    this.data.set(charset.encode(text, 10), NICK);
  }

  get otName(): string {
    return charset.decode(this.data.subarray(OT, OT + 7), this.language === LANGUAGE_JAPANESE);
  }
  set otName(text: string) {
    this.data.set(charset.encode(text, 7), OT);
  }

  // Substructure 0: growth.
  get species(): number { return this.u16(S0); }
  set species(v: number) { this.setU16(S0, v); }
  get heldItem(): number { return this.u16(S0 + 2); }
  set heldItem(v: number) { this.setU16(S0 + 2, v); }
  get experience(): number { return this.u32(S0 + 4); }
  set experience(v: number) { this.setU32(S0 + 4, v); }
  get ppBonuses(): number { return this.u8(S0 + 8); }
  set ppBonuses(v: number) { this.setU8(S0 + 8, v); }
  get friendship(): number { return this.u8(S0 + 9); }
  set friendship(v: number) { this.setU8(S0 + 9, v); }

  // Substructure 1: moves.
  get moves(): number[] {
    return [0, 1, 2, 3].map((i) => this.u16(S1 + 2 * i));
  }
  set moves(values: readonly number[]) {
    if (values.length !== 4) throw new Error(`expected 4 moves, got ${values.length}`);
    values.forEach((v, i) => { checkRange(v, 0xffff, "move"); this.setU16(S1 + 2 * i, v); });
  }

  get pp(): number[] {
    return Array.from(this.data.subarray(S1 + 8, S1 + 12));
  }
  set pp(values: readonly number[]) {
    if (values.length !== 4) throw new Error(`expected 4 PPs, got ${values.length}`);
    values.forEach((v) => checkRange(v, 0xff, "PP"));
    this.data.set(values, S1 + 8);
  }

  // Substructure 2: EVs and contest.
  get evs(): StatValues {
    return Object.fromEntries(STATS.map((k, i) => [k, this.data[S2 + i]])) as StatValues;
  }
  set evs(values: StatValues) {
    STATS.forEach((k) => checkRange(values[k], 0xff, `EV ${k}`));
    this.data.set(STATS.map((k) => values[k]), S2);
  }

  get contest(): Contest {
    return Object.fromEntries(CONTEST.map((k, i) => [k, this.data[S2 + 6 + i]])) as Contest;
  }

  // Substructure 3: misc.
  get pokerus(): number { return this.u8(S3); }
  set pokerus(v: number) { this.setU8(S3, v); }
  get metLocation(): number { return this.u8(S3 + 1); }
  set metLocation(v: number) { this.setU8(S3 + 1, v); }

  private setOrigin(shift: number, width: number, value: number) {
    const mask = (2 ** width - 1) << shift;
    this.setU16(S3 + 2, (this.u16(S3 + 2) & ~mask) | ((value << shift) & mask));
  }

  get metLevel(): number { return this.u16(S3 + 2) & 0x7f; }
  set metLevel(v: number) { this.setOrigin(0, 7, v); }
  get metGame(): number { return (this.u16(S3 + 2) >> 7) & 0xf; }
  set metGame(v: number) { this.setOrigin(7, 4, v); }
  get ball(): number { return (this.u16(S3 + 2) >> 11) & 0xf; }
  set ball(v: number) { this.setOrigin(11, 4, v); }
  get otGender(): number { return this.u16(S3 + 2) >> 15; }
  set otGender(v: number) { this.setOrigin(15, 1, v); }
  get isEgg(): boolean { return this.bits(S3 + 4, 30, 1) === 1; }
  get abilityNum(): number { return this.bits(S3 + 4, 31, 1); }
  set abilityNum(v: number) { this.setBits(S3 + 4, 31, 1, v); }
  get fateful(): boolean { return this.bits(S3 + 8, 31, 1) === 1; }
  set fateful(v: boolean) { this.setBits(S3 + 8, 31, 1, v ? 1 : 0); }
  /** Bits 0 to 30 of PokemonSubstruct3 (ribbons); bit 31 is the fateful flag (include/pokemon.h). */
  get ribbons(): number { return this.u32(S3 + 8) & 0x7fffffff; }
  set ribbons(v: number) { this.setBits(S3 + 8, 0, 31, v); }

  get ivs(): StatValues {
    return Object.fromEntries(STATS.map((k, i) => [k, this.bits(S3 + 4, 5 * i, 5)])) as StatValues;
  }
  set ivs(values: StatValues) {
    STATS.forEach((k, i) => {
      if (!(values[k] >= 0 && values[k] <= 31)) throw new Error(t("IV {stat}={value} fora de 0..31", { stat: k, value: values[k] }));
      this.setBits(S3 + 4, 5 * i, 5, values[k]);
    });
  }

  get nature(): Nature {
    return NATURES[this.personality % 25];
  }

  get isShiny(): boolean {
    const pid = this.personality;
    return (this.tid ^ this.sid ^ (pid >>> 16) ^ (pid & 0xffff)) < 8;
  }

  // Party tail (100-byte format only).
  private party() {
    if (!this.isParty) throw new Error(t("campo só existe no formato de party (100 bytes)"));
  }

  get level(): number {
    this.party();
    return this.u8(PARTY + 4);
  }

  /** Party tail (struct Pokemon): status 0, level, empty mail, current HP and stats. */
  setParty(level: number, stats: StatValues, currentHp: number | null = null): void {
    this.party();
    checkRange(level, 0xff, "level");
    const hp = currentHp ?? stats.hp;
    const values = [hp, stats.hp, stats.attack, stats.defense, stats.speed, stats.sp_attack, stats.sp_defense];
    values.forEach((v) => checkRange(v, 0xffff, "stat"));
    this.setU32(PARTY, 0);
    this.setU8(PARTY + 4, level);
    this.setU8(PARTY + 5, MAIL_NONE);
    values.forEach((v, i) => this.setU16(PARTY + 6 + 2 * i, v));
  }

  get stats(): PartyStats {
    this.party();
    const [hp, maxHp, attack, defense, speed, spAttack, spDefense] = [0, 1, 2, 3, 4, 5, 6].map((i) => this.u16(PARTY + 6 + 2 * i));
    return { hp: maxHp, attack, defense, speed, sp_attack: spAttack, sp_defense: spDefense, current_hp: hp };
  }
}
