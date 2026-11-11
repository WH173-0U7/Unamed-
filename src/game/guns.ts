/**
 * Guns, from the gun store (your own ID, and a background check). A gun is
 * a weapon item whose `doses` are the rounds loaded in it; its ammunition is
 * a separate box (a misc item whose `doses` are the rounds left). Firing is
 * loud: every shot gets called in.
 */
export interface Gun {
  name: string;
  desc: string;
  /** Rounds it holds. */
  holds: number;
  /** What it takes (the ammo box's name). */
  ammo: string;
  /** How likely to hit, close up, before your Weapons and your nerves. */
  acc: number;
  /** How much a hit does (1 = a handgun). */
  power: number;
  /** Damage when you hit someone with it instead (pistol-whipping). */
  club: number;
}

export const GUNS: Gun[] = [
  {
    name: 'Compact 9mm pistol',
    desc: 'A small black semi-automatic, fifteen rounds in the magazine. Light enough for a holster or a cargo pocket.',
    holds: 15,
    ammo: '9mm rounds',
    acc: 0.6,
    power: 1,
    club: 5,
  },
  {
    name: '.38 revolver',
    desc: 'A snub-nosed revolver, five rounds in the cylinder. It rarely jams, but it kicks.',
    holds: 5,
    ammo: '.38 rounds',
    acc: 0.56,
    power: 1.1,
    club: 5,
  },
  {
    name: 'Pump shotgun',
    desc: 'A twelve-gauge pump with an eighteen-inch barrel, five shells. Devastating up close, and there’s no hiding it.',
    holds: 5,
    ammo: '12-gauge shells',
    acc: 0.82,
    power: 1.9,
    club: 7,
  },
];

/** A gun by its name. */
export const gunOf = (name: string | undefined): Gun | undefined => (name ? GUNS.find((g) => g.name === name) : undefined);
/** The gun this box of ammunition is for. */
export const ammoFor = (name: string | undefined): Gun | undefined => (name ? GUNS.find((g) => g.ammo === name) : undefined);
