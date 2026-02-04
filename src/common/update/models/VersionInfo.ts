/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

type VersionInfoInit = {
  current: string;
  latest: string;
  minimumRequired?: string;
  releaseNotes?: string;
};

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;

type ParsedSemver = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
};

const parseSemver = (v: string): ParsedSemver | null => {
  const m = SEMVER_RE.exec(v);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ?? null,
  };
};

const cmpNum = (a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0);

// Minimal SemVer comparator sufficient for update UX:
// - compares major/minor/patch
// - treats prerelease as lower precedence than stable
// - compares prerelease identifiers (numeric < non-numeric)
const compareParsed = (a: ParsedSemver, b: ParsedSemver): number => {
  const major = cmpNum(a.major, b.major);
  if (major !== 0) return major;
  const minor = cmpNum(a.minor, b.minor);
  if (minor !== 0) return minor;
  const patch = cmpNum(a.patch, b.patch);
  if (patch !== 0) return patch;

  const ap = a.prerelease;
  const bp = b.prerelease;
  if (!ap && !bp) return 0;
  if (!ap && bp) return 1;
  if (ap && !bp) return -1;

  const aParts = (ap || '').split('.');
  const bParts = (bp || '').split('.');
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const ai = aParts[i];
    const bi = bParts[i];
    if (ai === undefined) return -1;
    if (bi === undefined) return 1;
    if (ai === bi) continue;
    const aNum = /^\d+$/.test(ai);
    const bNum = /^\d+$/.test(bi);
    if (aNum && bNum) {
      const n = cmpNum(Number(ai), Number(bi));
      if (n !== 0) return n;
      continue;
    }
    if (aNum && !bNum) return -1;
    if (!aNum && bNum) return 1;
    return ai < bi ? -1 : 1;
  }
  return 0;
};

export class VersionInfo {
  public readonly current: string;
  public readonly latest: string;
  public readonly minimumRequired?: string;
  public readonly releaseNotes?: string;

  private constructor(init: VersionInfoInit) {
    this.current = init.current;
    this.latest = init.latest;
    this.minimumRequired = init.minimumRequired;
    this.releaseNotes = init.releaseNotes;
  }

  public static isValidVersion(version: string): boolean {
    return Boolean(parseSemver(version));
  }

  public static compareVersions(a: string, b: string): number {
    const pa = parseSemver(a);
    const pb = parseSemver(b);
    if (!pa || !pb) {
      // Be strict: invalid versions are considered non-comparable.
      throw new Error('Invalid version format');
    }
    return compareParsed(pa, pb);
  }

  public static create(init: VersionInfoInit): VersionInfo {
    if (!this.isValidVersion(init.current)) {
      throw new Error('Invalid current version format');
    }
    if (!this.isValidVersion(init.latest)) {
      throw new Error('Invalid latest version format');
    }
    if (init.minimumRequired && !this.isValidVersion(init.minimumRequired)) {
      throw new Error('Invalid minimum required version format');
    }
    return new VersionInfo(init);
  }

  public get isUpdateAvailable(): boolean {
    return VersionInfo.compareVersions(this.current, this.latest) < 0;
  }

  public get isForced(): boolean {
    if (!this.minimumRequired) return false;
    return VersionInfo.compareVersions(this.current, this.minimumRequired) < 0;
  }

  public requiresForceUpdate(): boolean {
    return this.isForced;
  }

  public satisfiesMinimumVersion(): boolean {
    return !this.isForced;
  }

  public getUpdateType(): 'none' | 'patch' | 'minor' | 'major' {
    if (!this.isUpdateAvailable) return 'none';
    const cur = parseSemver(this.current);
    const lat = parseSemver(this.latest);
    if (!cur || !lat) return 'none';
    if (lat.major !== cur.major) return 'major';
    if (lat.minor !== cur.minor) return 'minor';
    if (lat.patch !== cur.patch) return 'patch';
    return 'none';
  }

  public isBreakingUpdate(): boolean {
    return this.getUpdateType() === 'major';
  }

  public getVersionGap(): string {
    if (!this.isUpdateAvailable) return 'Up to date';
    return `${this.current} -> ${this.latest}`;
  }

  public withLatestVersion(latest: string, releaseNotes?: string): VersionInfo {
    return VersionInfo.create({
      current: this.current,
      latest,
      minimumRequired: this.minimumRequired,
      releaseNotes,
    });
  }

  public afterUpgrade(newCurrent: string): VersionInfo {
    return VersionInfo.create({
      current: newCurrent,
      latest: this.latest,
      minimumRequired: this.minimumRequired,
      releaseNotes: this.releaseNotes,
    });
  }

  public toJSON(): VersionInfoInit {
    return {
      current: this.current,
      latest: this.latest,
      minimumRequired: this.minimumRequired,
      releaseNotes: this.releaseNotes,
    };
  }

  public static fromJSON(json: VersionInfoInit): VersionInfo {
    return VersionInfo.create(json);
  }

  public equals(other: VersionInfo): boolean {
    return this.current === other.current && this.latest === other.latest && this.minimumRequired === other.minimumRequired && this.releaseNotes === other.releaseNotes;
  }
}
