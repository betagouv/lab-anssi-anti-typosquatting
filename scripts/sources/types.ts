export interface NomDHoteCandidat {
  readonly nomDHote: string;
  readonly joignable: boolean;
}

export interface Source {
  readonly id: string;
  readonly litLesNomsDHote: () => Promise<NomDHoteCandidat[]>;
}
