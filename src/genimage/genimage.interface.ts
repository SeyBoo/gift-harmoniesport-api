export interface CardParams {
  id?: string;
  filename: string;
  width: number;
  height: number;
  background: string;
  cover: string;
  season: {
    label: string;
    font: string;
    color?: string;
    top: number;
    left?: number;
    background?: {
      path: string;
      top: number;
      left?: number;
    };
  };
  player: { path: string; number?: { font: string; value: string; color?: string; } };
  club: {
    url: string;
    top: number;
    left: number;
  };
  name:
    | {
        type: 'two_lines';
        firstname: {
          label: string;
          font: string;
          color?: string;
        };
        lastname: {
          label: string;
          font: string;
          color?: string;
        };
      }
    | {
        type: 'one_line';
        background?: string;
        name: {
          label: string;
          font: string;
          color?: string;
        };
      };
}
